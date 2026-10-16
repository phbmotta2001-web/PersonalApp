-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 3, ajuste): tabela de valores do personal.
--
-- Decisões de 16/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • O personal cadastra o valor de CADA AULA conforme a frequência semanal do aluno
--   (1x/semana, 2x/semana…). Uma tabela só, para qualquer duração de aula.
-- • Mensalidade = valor da aula × vezes por semana × 4. Na matrícula ela já sai
--   pronta; "valor fora do padrão" é a exceção, digitada à mão.
-- • Fase 2: o perfil público mostra "a partir de" (menor valor por aula) e a tabela.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261016100000_matriculas_e_aulas.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Tabela de valores ────────────────────────────────────────────────────
create table public.precos_aula (
  personal_id          uuid not null references public.personais (id) on delete cascade,
  vezes_semana         smallint not null check (vezes_semana between 1 and 7),
  valor_aula_centavos  integer not null check (valor_aula_centavos between 100 and 1000000),
  primary key (personal_id, vezes_semana)
);

comment on table public.precos_aula is
  'Valor de cada aula conforme quantas vezes por semana o aluno treina. Mensalidade = aula × vezes × 4.';

alter table public.precos_aula enable row level security;

-- O personal lê a própria tabela; gravar, só pela função abaixo.
-- (Fase 2: a busca mostrará os valores de quem estiver visível na busca.)
create policy "personal vê os próprios valores" on public.precos_aula
  for select to authenticated using ((select auth.uid()) = personal_id);

-- p_precos: [{"vezes": 1, "valor_aula_centavos": 20000}, ...] — substitui a tabela toda.
create or replace function public.salvar_precos(p_precos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal uuid := auth.uid();
begin
  if v_personal is null or not exists (select 1 from public.personais where id = v_personal) then
    raise exception 'Só personais podem cadastrar valores.';
  end if;
  if jsonb_typeof(p_precos) <> 'array' or jsonb_array_length(p_precos) > 7 then
    raise exception 'Tabela de valores inválida.';
  end if;

  delete from public.precos_aula where personal_id = v_personal;
  insert into public.precos_aula (personal_id, vezes_semana, valor_aula_centavos)
  select v_personal, p.vezes, p.valor_aula_centavos
    from jsonb_to_recordset(p_precos) as p(vezes smallint, valor_aula_centavos integer);
end
$$;

revoke all on function public.salvar_precos(jsonb) from public, anon;
grant execute on function public.salvar_precos(jsonb) to authenticated;

-- ─── Matrícula: valor pela tabela ou fora do padrão ───────────────────────
alter table public.matriculas
  add column valor_fora_do_padrao boolean not null default false;

comment on column public.matriculas.valor_fora_do_padrao is
  'true = valor digitado à mão (exceção). false = calculado pela tabela do personal ao salvar.';

-- A função ganha um parâmetro: a versão antiga sai para não haver duas.
drop function public.salvar_matricula(uuid, jsonb, integer, text, integer, integer, date, date, date);

create or replace function public.salvar_matricula(
  p_vinculo         uuid,
  p_horarios        jsonb,
  p_duracao         integer,
  p_local           text,
  p_valor_fora_do_padrao boolean,
  p_valor_centavos  integer,
  p_dia_vencimento  integer,
  p_inicio          date,
  p_fim             date,
  p_a_partir        date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v        public.vinculos;
  m        public.matriculas;
  v_hoje   date := public.hoje_brasilia();
  v_desde  date;
  v_fim    date;
  v_id     uuid;
  choque   text;
  v_valor  integer;
begin
  select * into v from public.vinculos
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;

  if p_duracao not in (30, 45, 60, 90) then
    raise exception 'Escolha uma duração de aula de 30, 45, 60 ou 90 minutos.';
  end if;
  if jsonb_typeof(p_horarios) <> 'array' or jsonb_array_length(p_horarios) not between 1 and 7 then
    raise exception 'Escolha de 1 a 7 horários fixos.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_horarios) as h(dia integer, inicio_min integer)
     where h.dia not between 0 and 6 or h.inicio_min % 30 <> 0
        or h.inicio_min < 0 or h.inicio_min + p_duracao > 1440
  ) then
    raise exception 'Confira os horários: de 30 em 30 minutos, terminando até meia-noite.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_horarios) with ordinality as a(h, n)
      join jsonb_array_elements(p_horarios) with ordinality as b(h, n)
        on (a.h ->> 'dia')::integer = (b.h ->> 'dia')::integer and a.n < b.n
       and abs((a.h ->> 'inicio_min')::integer - (b.h ->> 'inicio_min')::integer) < p_duracao
  ) then
    raise exception 'Dois horários da matrícula se sobrepõem no mesmo dia.';
  end if;

  select * into m from public.matriculas where vinculo_id = p_vinculo and situacao = 'ativa';

  if m.id is null then
    if p_inicio is null then
      raise exception 'Escolha a data de início.';
    end if;
    v_desde := p_inicio;
  else
    v_desde := greatest(coalesce(p_a_partir, v_hoje), v_hoje);
  end if;
  v_fim := p_fim;
  if v_fim is not null and v_fim < coalesce(m.inicio, p_inicio) then
    raise exception 'A data de fim tem que ser depois do início.';
  end if;
  if m.id is not null and v_fim is not null and v_fim < v_hoje then
    raise exception 'Para terminar antes de hoje, use "Encerrar matrícula".';
  end if;

  -- Mensalidade: pela tabela do personal (aula × vezes × 4), ou o valor digitado.
  if p_valor_fora_do_padrao then
    v_valor := p_valor_centavos;
  else
    select p.valor_aula_centavos * jsonb_array_length(p_horarios) * 4
      into v_valor
      from public.precos_aula p
     where p.personal_id = v.personal_id and p.vezes_semana = jsonb_array_length(p_horarios);
  end if;

  -- Decisão 1: horário de outro aluno fica indisponível.
  select public.nome_do_horario(h.dia, h.inicio_min) || ' já é de ' ||
         coalesce(al.nome_completo, vo.nome_convite)
    into choque
    from jsonb_to_recordset(p_horarios) as h(dia integer, inicio_min integer)
    join public.matriculas o
      on o.personal_id = v.personal_id and o.situacao = 'ativa'
     and o.id is distinct from m.id
     and (o.fim is null or o.fim >= v_desde)
     and (v_fim is null or greatest(o.inicio, o.horarios_desde) <= v_fim)
    join public.matricula_horarios oh
      on oh.matricula_id = o.id and oh.dia_semana = h.dia
     and h.inicio_min < oh.inicio_min + o.duracao_min
     and oh.inicio_min < h.inicio_min + p_duracao
    join public.vinculos vo on vo.id = o.vinculo_id
    left join public.alunos al on al.id = o.aluno_id
   limit 1;
  if choque is not null then
    raise exception 'O horário de %.', choque;
  end if;

  if m.id is null then
    insert into public.matriculas
      (vinculo_id, personal_id, aluno_id, duracao_min, local, valor_centavos, valor_fora_do_padrao,
       dia_vencimento, inicio, fim, horarios_desde)
    values
      (p_vinculo, v.personal_id, v.aluno_id, p_duracao, nullif(btrim(p_local), ''), v_valor,
       coalesce(p_valor_fora_do_padrao, false), p_dia_vencimento, p_inicio, v_fim, v_desde)
    returning id into v_id;
  else
    v_id := m.id;
    update public.matriculas
       set duracao_min = p_duracao, local = nullif(btrim(p_local), ''),
           valor_centavos = v_valor, valor_fora_do_padrao = coalesce(p_valor_fora_do_padrao, false),
           dia_vencimento = p_dia_vencimento,
           fim = v_fim, horarios_desde = v_desde
     where id = v_id;

    -- Refaz só as aulas futuras que ainda estão só agendadas.
    delete from public.aulas
     where matricula_id = v_id and situacao = 'agendada' and inicio > now()
       and (inicio >= public.instante_brasilia(v_desde, 0)
            or (v_fim is not null and inicio >= public.instante_brasilia(v_fim + 1, 0)));

    delete from public.matricula_horarios where matricula_id = v_id;
  end if;

  insert into public.matricula_horarios (matricula_id, dia_semana, inicio_min)
  select v_id, h.dia, h.inicio_min
    from jsonb_to_recordset(p_horarios) as h(dia integer, inicio_min integer);

  perform public.gerar_aulas(v_id);
  return v_id;
end
$$;

revoke all on function public.salvar_matricula(uuid, jsonb, integer, text, boolean, integer, integer, date, date, date) from public, anon;
grant execute on function public.salvar_matricula(uuid, jsonb, integer, text, boolean, integer, integer, date, date, date) to authenticated;

commit;
