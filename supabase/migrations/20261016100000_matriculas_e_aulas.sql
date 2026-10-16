-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 3): matrículas e aulas fixas.
--
-- Decisões de 16/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Matrícula = horários fixos do aluno com o personal (ex.: seg e qui às 07:00),
--   duração (a padrão do personal, ou outra), local, valor mensal e dia de
--   vencimento (só anotados; a cobrança é a etapa 7), início e fim.
-- • Um horário aceito por um aluno fica INDISPONÍVEL para os outros: o banco não
--   deixa dois alunos no mesmo horário do mesmo personal.
-- • Horário fora do expediente PODE (o app só avisa).
-- • As aulas viram registros de verdade para as próximas 8 semanas; um robô diário
--   estende a janela. Mudar os horários refaz só as aulas futuras.
-- • Encerrar a matrícula, ou o vínculo, apaga as aulas futuras ainda agendadas.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261015200000_convites_e_vinculos.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Para o banco impedir duas aulas no mesmo horário do mesmo personal.
create extension if not exists btree_gist with schema extensions;

-- ─── Matrículas ───────────────────────────────────────────────────────────
create table public.matriculas (
  id               uuid primary key default gen_random_uuid(),
  vinculo_id       uuid not null references public.vinculos (id) on delete cascade,
  personal_id      uuid not null references public.personais (id) on delete cascade,
  aluno_id         uuid references public.alunos (id) on delete set null,
  situacao         text not null default 'ativa' check (situacao in ('ativa', 'encerrada')),
  duracao_min      integer not null check (duracao_min in (30, 45, 60, 90)),
  local            text check (local is null or char_length(local) <= 80),
  valor_centavos   integer check (valor_centavos is null or valor_centavos between 1 and 10000000),
  dia_vencimento   smallint check (dia_vencimento is null or dia_vencimento between 1 and 31),
  inicio           date not null,
  fim              date check (fim is null or fim >= inicio),
  -- Os horários atuais valem a partir desta data (antes dela ficam as aulas já criadas).
  horarios_desde   date not null,
  criada_em        timestamptz not null default now(),
  encerrada_em     timestamptz
);

comment on table public.matriculas is
  'Horários fixos, duração, local e valor combinados entre personal e aluno.';

create index matriculas_por_personal on public.matriculas (personal_id, situacao);
create index matriculas_por_aluno on public.matriculas (aluno_id);
-- Uma matrícula ativa por vínculo.
create unique index matriculas_uma_ativa_por_vinculo on public.matriculas (vinculo_id)
  where situacao = 'ativa';

create table public.matricula_horarios (
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  inicio_min    integer not null check (inicio_min between 0 and 1410 and inicio_min % 30 = 0),
  primary key (matricula_id, dia_semana, inicio_min)
);

comment on table public.matricula_horarios is
  'Horários fixos da matrícula: dia da semana (0 = domingo) e hora de início em minutos.';

-- ─── Aulas ────────────────────────────────────────────────────────────────
create table public.aulas (
  id            uuid primary key default gen_random_uuid(),
  personal_id   uuid not null references public.personais (id) on delete cascade,
  aluno_id      uuid references public.alunos (id) on delete set null,
  vinculo_id    uuid references public.vinculos (id) on delete set null,
  matricula_id  uuid references public.matriculas (id) on delete set null,
  inicio        timestamptz not null,
  fim           timestamptz not null check (fim > inicio),
  local         text check (local is null or char_length(local) <= 80),
  origem        text not null default 'fixa'
                  check (origem in ('fixa', 'avulsa', 'reposicao', 'experimental')),
  -- Etapa 3 só cria "agendada"; as outras chegam com o dia a dia da agenda (etapa 5).
  situacao      text not null default 'agendada'
                  check (situacao in ('agendada', 'confirmada', 'realizada', 'falta',
                                      'cancelada_com_aviso', 'cancelada_em_cima', 'remarcada')),
  criada_em     timestamptz not null default now(),
  -- A mesma aula fixa não é criada duas vezes.
  unique (matricula_id, inicio),
  -- Decisão 1 (16/10): o horário de um aluno fica indisponível para os outros.
  constraint aulas_sem_choque exclude using gist (
    personal_id extensions.gist_uuid_ops with =,
    tstzrange(inicio, fim) with &&
  ) where (situacao in ('agendada', 'confirmada', 'realizada', 'falta'))
);

comment on table public.aulas is
  'Cada aula real (data e hora). As fixas são criadas a partir da matrícula, 8 semanas à frente.';

create index aulas_por_personal on public.aulas (personal_id, inicio);
create index aulas_por_aluno on public.aulas (aluno_id, inicio);

-- ─── Ajudantes ────────────────────────────────────────────────────────────
-- Data de hoje em Brasília.
create or replace function public.hoje_brasilia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Data + minutos (horário de Brasília) → instante.
create or replace function public.instante_brasilia(p_data date, p_min integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_data + make_interval(mins => p_min)) at time zone 'America/Sao_Paulo'
$$;

-- "segunda às 07:00"
create or replace function public.nome_do_horario(p_dia integer, p_min integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['domingo','segunda','terça','quarta','quinta','sexta','sábado'])[p_dia + 1]
         || ' às ' || lpad((p_min / 60)::text, 2, '0') || ':' || lpad((p_min % 60)::text, 2, '0')
$$;

-- ─── Criar as aulas fixas (8 semanas à frente) ────────────────────────────
create or replace function public.gerar_aulas(p_matricula uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m     public.matriculas;
  v_de  date;
  v_ate date;
  n     integer;
begin
  select * into m from public.matriculas where id = p_matricula and situacao = 'ativa';
  if not found then
    return 0;
  end if;

  v_de  := greatest(m.inicio, m.horarios_desde, public.hoje_brasilia());
  v_ate := least(coalesce(m.fim, public.hoje_brasilia() + 56), public.hoje_brasilia() + 56);

  -- "on conflict do nothing": não repete aula já criada nem cria aula em horário ocupado.
  insert into public.aulas (personal_id, aluno_id, vinculo_id, matricula_id, inicio, fim, local, origem)
  select m.personal_id, m.aluno_id, m.vinculo_id, m.id,
         public.instante_brasilia(d.dia::date, h.inicio_min),
         public.instante_brasilia(d.dia::date, h.inicio_min) + make_interval(mins => m.duracao_min),
         m.local, 'fixa'
    from generate_series(v_de, v_ate, interval '1 day') as d(dia)
    join public.matricula_horarios h
      on h.matricula_id = m.id and h.dia_semana = extract(dow from d.dia)
   where public.instante_brasilia(d.dia::date, h.inicio_min) > now()
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end
$$;

-- Robô diário: mantém todas as matrículas ativas com 8 semanas de aulas.
create or replace function public.gerar_aulas_de_todos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.matriculas where situacao = 'ativa' loop
    perform public.gerar_aulas(r.id);
  end loop;
end
$$;

-- Fecha a matrícula e apaga as aulas futuras ainda agendadas.
create or replace function public.fechar_matricula(p_matricula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matriculas
     set situacao = 'encerrada', encerrada_em = now(),
         fim = greatest(inicio, least(coalesce(fim, public.hoje_brasilia()), public.hoje_brasilia()))
   where id = p_matricula and situacao = 'ativa';

  delete from public.aulas
   where matricula_id = p_matricula and situacao = 'agendada' and inicio > now();
end
$$;

-- ─── Personal: criar ou alterar a matrícula ───────────────────────────────
-- p_horarios: [{"dia": 1, "inicio_min": 420}, ...]
-- p_a_partir: só ao alterar; data a partir da qual os horários novos valem.
create or replace function public.salvar_matricula(
  p_vinculo         uuid,
  p_horarios        jsonb,
  p_duracao         integer,
  p_local           text,
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
      (vinculo_id, personal_id, aluno_id, duracao_min, local, valor_centavos, dia_vencimento,
       inicio, fim, horarios_desde)
    values
      (p_vinculo, v.personal_id, v.aluno_id, p_duracao, nullif(btrim(p_local), ''), p_valor_centavos,
       p_dia_vencimento, p_inicio, v_fim, v_desde)
    returning id into v_id;
  else
    v_id := m.id;
    update public.matriculas
       set duracao_min = p_duracao, local = nullif(btrim(p_local), ''),
           valor_centavos = p_valor_centavos, dia_vencimento = p_dia_vencimento,
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

-- ─── Personal: encerrar a matrícula ───────────────────────────────────────
create or replace function public.encerrar_matricula(p_matricula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.matriculas
     where id = p_matricula and personal_id = auth.uid() and situacao = 'ativa'
  ) then
    raise exception 'Matrícula não encontrada.';
  end if;
  perform public.fechar_matricula(p_matricula);
end
$$;

-- ─── Vínculo encerrado (por qualquer lado, ou conta excluída) ─────────────
create or replace function public.vinculos_ao_encerrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if old.situacao = 'ativo' and new.situacao <> 'ativo' then
    for r in select id from public.matriculas where vinculo_id = new.id and situacao = 'ativa' loop
      perform public.fechar_matricula(r.id);
    end loop;
  end if;
  return new;
end
$$;

create trigger vinculos_ao_encerrar
  after update of situacao on public.vinculos
  for each row execute function public.vinculos_ao_encerrar();

-- ─── Segurança por linha ──────────────────────────────────────────────────
-- Personal e aluno leem as próprias matrículas e aulas; gravar, só pelas funções.
alter table public.matriculas         enable row level security;
alter table public.matricula_horarios enable row level security;
alter table public.aulas              enable row level security;

create policy "personal e aluno veem as próprias matrículas" on public.matriculas
  for select to authenticated
  using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

create policy "horários de matrículas visíveis" on public.matricula_horarios
  for select to authenticated
  using (exists (select 1 from public.matriculas m where m.id = matricula_id));

create policy "personal e aluno veem as próprias aulas" on public.aulas
  for select to authenticated
  using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

revoke all on function public.gerar_aulas(uuid)                from public, anon, authenticated;
revoke all on function public.gerar_aulas_de_todos()            from public, anon, authenticated;
revoke all on function public.fechar_matricula(uuid)            from public, anon, authenticated;
revoke all on function public.vinculos_ao_encerrar()            from public, anon, authenticated;
revoke all on function public.salvar_matricula(uuid, jsonb, integer, text, integer, integer, date, date, date)
  from public, anon;
revoke all on function public.encerrar_matricula(uuid)          from public, anon;

grant execute on function public.salvar_matricula(uuid, jsonb, integer, text, integer, integer, date, date, date)
  to authenticated;
grant execute on function public.encerrar_matricula(uuid)       to authenticated;

-- Todo dia às 03:00 (00:00 em Brasília): estende as aulas fixas.
select cron.schedule('pienel-gerar-aulas', '0 3 * * *', $$select public.gerar_aulas_de_todos()$$);

commit;
