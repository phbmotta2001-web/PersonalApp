-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: alunos online e híbridos.
--
-- Decisões de 20/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Tipo de acompanhamento na matrícula: presencial, online ou híbrido.
--   - Online: sem dias e horários fixos, sem aulas na agenda; mensalidade normal.
--   - Híbrido: online + aulas presenciais de rotina (ex.: a cada 15 dias), que
--     entram na agenda. Aparece na lista de alunos online com a etiqueta "híbrido".
-- • Frequência das aulas fixas: toda semana ou a cada 15 dias.
-- • Tabela de valores online: plano mensal, trimestral, semestral ou anual; o valor
--   é o total do período, cobrado uma vez a cada período.
-- • A 1ª cobrança continua no início e proporcional até o primeiro vencimento normal.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261018140000_cobrancas.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Matrícula: tipo, frequência das aulas e ciclo de cobrança ────────────
alter table public.matriculas
  add column modalidade        text not null default 'presencial'
                                 check (modalidade in ('presencial', 'online', 'hibrido')),
  add column intervalo_semanas smallint not null default 1 check (intervalo_semanas in (1, 2)),
  add column ciclo_meses       smallint not null default 1 check (ciclo_meses in (1, 3, 6, 12));

comment on column public.matriculas.modalidade is
  'presencial: aulas na agenda; online: sem agenda; hibrido: online com aulas presenciais de rotina.';
comment on column public.matriculas.intervalo_semanas is
  'Aulas fixas toda semana (1) ou a cada 15 dias (2).';
comment on column public.matriculas.ciclo_meses is
  'De quantos em quantos meses a mensalidade é cobrada (planos online: 1, 3, 6 ou 12).';

-- ─── Tabela de valores online ─────────────────────────────────────────────
create table public.precos_online (
  personal_id     uuid not null references public.personais (id) on delete cascade,
  ciclo_meses     smallint not null check (ciclo_meses in (1, 3, 6, 12)),
  valor_centavos  integer not null check (valor_centavos between 100 and 10000000),
  primary key (personal_id, ciclo_meses)
);

comment on table public.precos_online is
  'Planos online do personal: valor TOTAL de cada período (mensal, trimestral, semestral, anual).';

alter table public.precos_online enable row level security;
create policy "personal vê os próprios planos online" on public.precos_online
  for select to authenticated using ((select auth.uid()) = personal_id);

-- p_precos: [{"ciclo_meses": 3, "valor_centavos": 90000}, ...] — substitui a tabela toda.
create or replace function public.salvar_precos_online(p_precos jsonb)
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
  if jsonb_typeof(p_precos) <> 'array' or jsonb_array_length(p_precos) > 4 then
    raise exception 'Tabela de valores inválida.';
  end if;
  delete from public.precos_online where personal_id = v_personal;
  insert into public.precos_online (personal_id, ciclo_meses, valor_centavos)
  select v_personal, p.ciclo_meses, p.valor_centavos
    from jsonb_to_recordset(p_precos) as p(ciclo_meses smallint, valor_centavos integer);
end
$$;

-- ─── Ajudante: o mesmo dia do mês, N meses depois (último dia, se faltar) ─
create or replace function public.somar_meses_no_dia(p_data date, p_meses integer, p_dia integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(extract(year from m)::int, extract(month from m)::int,
                   least(p_dia, extract(day from (m + interval '1 month' - interval '1 day'))::int))
    from (select (date_trunc('month', p_data) + make_interval(months => p_meses))::date as m) x
$$;

-- ─── Aulas fixas: toda semana ou a cada 15 dias ───────────────────────────
create or replace function public.gerar_aulas(p_matricula uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m      public.matriculas;
  v_de   date;
  v_ate  date;
  v_base date;
  n      integer;
begin
  select * into m from public.matriculas where id = p_matricula and situacao = 'ativa';
  if not found or m.modalidade = 'online' then
    return 0;
  end if;

  v_de  := greatest(m.inicio, m.horarios_desde, public.hoje_brasilia());
  v_ate := least(coalesce(m.fim, public.hoje_brasilia() + 56), public.hoje_brasilia() + 56);
  -- Semana de referência (segunda-feira da semana em que os horários começaram a valer).
  v_base := date_trunc('week', m.horarios_desde)::date;

  insert into public.aulas (personal_id, aluno_id, vinculo_id, matricula_id, inicio, fim, local, origem)
  select m.personal_id, m.aluno_id, m.vinculo_id, m.id,
         public.instante_brasilia(d.dia::date, h.inicio_min),
         public.instante_brasilia(d.dia::date, h.inicio_min) + make_interval(mins => m.duracao_min),
         m.local, 'fixa'
    from generate_series(v_de, v_ate, interval '1 day') as d(dia)
    join public.matricula_horarios h
      on h.matricula_id = m.id and h.dia_semana = extract(dow from d.dia)
   where public.instante_brasilia(d.dia::date, h.inicio_min) > now()
     and ((d.dia::date - v_base) / 7) % m.intervalo_semanas = 0
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end
$$;

-- ─── Cobranças: ciclo de 1, 3, 6 ou 12 meses ──────────────────────────────
create or replace function public.gerar_cobrancas(p_matricula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          public.matriculas;
  v_limite   date := public.hoje_brasilia() + 7;
  v_criada   date;
  v_primeiro date;
  v_cheio    integer;
  v_dias     integer;
  d          date;
begin
  select * into m from public.matriculas where id = p_matricula and situacao = 'ativa';
  if not found or m.valor_centavos is null or m.dia_vencimento is null then
    return;
  end if;
  v_criada := (m.criada_em at time zone 'America/Sao_Paulo')::date;
  -- Primeiro vencimento normal: no dia escolhido, depois de um ciclo inteiro do início.
  v_primeiro := public.proxima_data_no_dia(
                  (m.inicio + make_interval(months => m.ciclo_meses - 1))::date, m.dia_vencimento);

  -- 1ª cobrança: no início, proporcional aos dias até o primeiro vencimento normal.
  if m.inicio <= v_limite and m.inicio >= v_criada then
    v_cheio := (m.inicio + make_interval(months => m.ciclo_meses))::date - m.inicio;
    v_dias  := v_primeiro - m.inicio;
    insert into public.cobrancas (personal_id, vinculo_id, aluno_id, matricula_id, tipo, periodo_inicio, periodo_fim,
                                  vencimento, valor_centavos)
    values (m.personal_id, m.vinculo_id, m.aluno_id, m.id, 'mensalidade', m.inicio, v_primeiro - 1, m.inicio,
            case when v_dias >= v_cheio then m.valor_centavos
                 else greatest(1, round(m.valor_centavos::numeric * v_dias / v_cheio)::integer) end)
    on conflict (matricula_id, vencimento) where tipo = 'mensalidade' do nothing;
  end if;

  -- As seguintes: cheias, uma por ciclo, no dia do vencimento.
  d := v_primeiro;
  while d <= v_limite and (m.fim is null or d <= m.fim) loop
    if d >= v_criada then
      insert into public.cobrancas (personal_id, vinculo_id, aluno_id, matricula_id, tipo, periodo_inicio, periodo_fim,
                                    vencimento, valor_centavos)
      values (m.personal_id, m.vinculo_id, m.aluno_id, m.id, 'mensalidade', d,
              public.somar_meses_no_dia(d, m.ciclo_meses, m.dia_vencimento) - 1, d, m.valor_centavos)
      on conflict (matricula_id, vencimento) where tipo = 'mensalidade' do nothing;
    end if;
    d := public.somar_meses_no_dia(d, m.ciclo_meses, m.dia_vencimento);
  end loop;
end
$$;

-- ─── Salvar a matrícula (presencial, online ou híbrida) ───────────────────
-- p_dados: {modalidade, horarios: [{dia, inicio_min}], intervalo_semanas, duracao, local,
--           ciclo_meses, valor_fora_do_padrao, valor_centavos, dia_vencimento, inicio, fim, a_partir}
drop function public.salvar_matricula(uuid, jsonb, integer, text, boolean, integer, integer, date, date, date);

create or replace function public.salvar_matricula(p_vinculo uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v           public.vinculos;
  m           public.matriculas;
  v_hoje      date := public.hoje_brasilia();
  v_mod       text := coalesce(p_dados ->> 'modalidade', 'presencial');
  v_horarios  jsonb := case when coalesce(p_dados ->> 'modalidade', 'presencial') = 'online' then '[]'::jsonb
                            else coalesce(p_dados -> 'horarios', '[]'::jsonb) end;
  v_intervalo integer := coalesce((p_dados ->> 'intervalo_semanas')::integer, 1);
  v_duracao   integer := coalesce((p_dados ->> 'duracao')::integer, 60);
  v_ciclo     integer := case when coalesce(p_dados ->> 'modalidade', 'presencial') = 'presencial' then 1
                              else coalesce((p_dados ->> 'ciclo_meses')::integer, 1) end;
  v_fora      boolean := coalesce((p_dados ->> 'valor_fora_do_padrao')::boolean, false);
  v_venc      integer := (p_dados ->> 'dia_vencimento')::integer;
  v_inicio    date := (p_dados ->> 'inicio')::date;
  v_fim       date := (p_dados ->> 'fim')::date;
  v_a_partir  date := (p_dados ->> 'a_partir')::date;
  v_local     text := nullif(btrim(coalesce(p_dados ->> 'local', '')), '');
  v_desde     date;
  v_id        uuid;
  choque      text;
  v_valor     integer;
  v_n         integer;
begin
  select * into v from public.vinculos
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;

  if v_mod not in ('presencial', 'online', 'hibrido') then
    raise exception 'Escolha o tipo de acompanhamento.';
  end if;
  if v_intervalo not in (1, 2) or v_ciclo not in (1, 3, 6, 12) then
    raise exception 'Confira a frequência e o plano.';
  end if;
  if v_duracao not in (30, 45, 60, 90) then
    raise exception 'Escolha uma duração de aula de 30, 45, 60 ou 90 minutos.';
  end if;
  if v_local is not null and char_length(v_local) > 80 then
    raise exception 'Use até 80 caracteres no local.';
  end if;
  if jsonb_typeof(v_horarios) <> 'array' then
    raise exception 'Confira os horários.';
  end if;
  v_n := jsonb_array_length(v_horarios);
  if v_mod <> 'online' and v_n not between 1 and 7 then
    raise exception 'Escolha de 1 a 7 horários fixos.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer)
     where h.dia not between 0 and 6 or h.inicio_min % 30 <> 0
        or h.inicio_min < 0 or h.inicio_min + v_duracao > 1440
  ) then
    raise exception 'Confira os horários: de 30 em 30 minutos, terminando até meia-noite.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_horarios) with ordinality as a(h, n)
      join jsonb_array_elements(v_horarios) with ordinality as b(h, n)
        on (a.h ->> 'dia')::integer = (b.h ->> 'dia')::integer and a.n < b.n
       and abs((a.h ->> 'inicio_min')::integer - (b.h ->> 'inicio_min')::integer) < v_duracao
  ) then
    raise exception 'Dois horários da matrícula se sobrepõem no mesmo dia.';
  end if;

  select * into m from public.matriculas where vinculo_id = p_vinculo and situacao = 'ativa';

  if m.id is null then
    if v_inicio is null then
      raise exception 'Escolha a data de início.';
    end if;
    v_desde := v_inicio;
  else
    v_desde := greatest(coalesce(v_a_partir, v_hoje), v_hoje);
  end if;
  if v_fim is not null and v_fim < coalesce(m.inicio, v_inicio) then
    raise exception 'A data de fim tem que ser depois do início.';
  end if;
  if m.id is not null and v_fim is not null and v_fim < v_hoje then
    raise exception 'Para terminar antes de hoje, use "Encerrar matrícula".';
  end if;

  -- Valor: presencial pela tabela por aula (aula × vezes × 4); online e híbrido pelo
  -- plano online (total do período); ou o valor digitado (fora do padrão).
  if v_fora then
    v_valor := (p_dados ->> 'valor_centavos')::integer;
  elsif v_mod = 'presencial' then
    select p.valor_aula_centavos * v_n * 4 into v_valor
      from public.precos_aula p where p.personal_id = v.personal_id and p.vezes_semana = v_n;
  else
    select p.valor_centavos into v_valor
      from public.precos_online p where p.personal_id = v.personal_id and p.ciclo_meses = v_ciclo;
  end if;
  if v_valor is not null and v_valor not between 1 and 10000000 then
    raise exception 'Confira o valor.';
  end if;

  -- Horário de outro aluno fica indisponível (vale para quinzenais também, por segurança).
  if v_n > 0 then
    select public.nome_do_horario(h.dia, h.inicio_min) || ' já é de ' ||
           coalesce(al.nome_completo, vo.nome_convite)
      into choque
      from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer)
      join public.matriculas o
        on o.personal_id = v.personal_id and o.situacao = 'ativa'
       and o.id is distinct from m.id
       and (o.fim is null or o.fim >= v_desde)
       and (v_fim is null or greatest(o.inicio, o.horarios_desde) <= v_fim)
      join public.matricula_horarios oh
        on oh.matricula_id = o.id and oh.dia_semana = h.dia
       and h.inicio_min < oh.inicio_min + o.duracao_min
       and oh.inicio_min < h.inicio_min + v_duracao
      join public.vinculos vo on vo.id = o.vinculo_id
      left join public.alunos al on al.id = o.aluno_id
     limit 1;
    if choque is not null then
      raise exception 'O horário de %.', choque;
    end if;
  end if;

  if m.id is null then
    insert into public.matriculas
      (vinculo_id, personal_id, aluno_id, modalidade, intervalo_semanas, ciclo_meses, duracao_min, local,
       valor_centavos, valor_fora_do_padrao, dia_vencimento, inicio, fim, horarios_desde)
    values
      (p_vinculo, v.personal_id, v.aluno_id, v_mod, v_intervalo, v_ciclo, v_duracao, v_local,
       v_valor, v_fora, v_venc, v_inicio, v_fim, v_desde)
    returning id into v_id;
  else
    v_id := m.id;
    update public.matriculas
       set modalidade = v_mod, intervalo_semanas = v_intervalo, ciclo_meses = v_ciclo,
           duracao_min = v_duracao, local = v_local,
           valor_centavos = v_valor, valor_fora_do_padrao = v_fora, dia_vencimento = v_venc,
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
    from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer);

  perform public.gerar_aulas(v_id);
  -- (As cobranças são geradas pelo gatilho matriculas_gerar_cobrancas.)
  return v_id;
end
$$;

revoke all on function public.salvar_precos_online(jsonb)          from public, anon;
revoke all on function public.somar_meses_no_dia(date, integer, integer) from public, anon, authenticated;
revoke all on function public.salvar_matricula(uuid, jsonb)        from public, anon;
grant execute on function public.salvar_precos_online(jsonb)       to authenticated;
grant execute on function public.salvar_matricula(uuid, jsonb)     to authenticated;

commit;
