-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 1): horários de trabalho e bloqueios do personal.
--
-- Decisões de 15/10/2026 (ver docs/plano-fase-1-agenda.md e src/lib/expediente.ts):
-- • Segunda a domingo; horas de 30 em 30 minutos (guardadas em minutos: 360 = 06:00).
-- • Uma duração padrão de aula por personal: 30, 45, 60 ou 90 minutos.
-- • Bloqueios: dia inteiro, vários dias ou algumas horas, com motivo opcional que
--   só o personal vê.
-- • Cada personal vê e mexe só nos próprios horários e bloqueios.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261015100000_conta_personal.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Duração padrão da aula ───────────────────────────────────────────────
alter table public.personais
  add column duracao_aula_min integer not null default 60
    check (duracao_aula_min in (30, 45, 60, 90));

comment on column public.personais.duracao_aula_min is
  'Duração padrão da aula, em minutos (30, 45, 60 ou 90).';

-- ─── Horários de trabalho ─────────────────────────────────────────────────
create table public.horarios_trabalho (
  id           bigint generated always as identity primary key,
  personal_id  uuid not null references public.personais (id) on delete cascade,
  dia_semana   smallint not null check (dia_semana between 0 and 6),   -- 0 = domingo
  inicio_min   integer not null check (inicio_min between 0 and 1410 and inicio_min % 30 = 0),
  fim_min      integer not null check (fim_min between 30 and 1440 and fim_min % 30 = 0),
  check (fim_min > inicio_min)
);

comment on table public.horarios_trabalho is
  'Faixas semanais em que o personal trabalha (minutos desde 00:00, horário de Brasília).';

create index horarios_trabalho_por_personal on public.horarios_trabalho (personal_id, dia_semana);

-- ─── Bloqueios ────────────────────────────────────────────────────────────
create table public.bloqueios (
  id           uuid primary key default gen_random_uuid(),
  personal_id  uuid not null references public.personais (id) on delete cascade,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  dia_inteiro  boolean not null default false,
  motivo       text not null default '' check (char_length(motivo) <= 80),
  criado_em    timestamptz not null default now(),
  check (fim > inicio),
  check (fim - inicio <= interval '366 days')
);

comment on table public.bloqueios is
  'Períodos em que o personal não atende (férias, feriados, compromissos). O motivo é só dele.';

create index bloqueios_por_personal on public.bloqueios (personal_id, fim);

-- ─── Salvar os horários de trabalho de uma vez ────────────────────────────
-- Troca todas as faixas do personal logado pelas novas e grava a duração padrão,
-- num passo só: se algo estiver errado (ex.: faixas sobrepostas), nada muda.
create or replace function public.salvar_horarios_trabalho(p_duracao integer, p_faixas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal uuid := auth.uid();
begin
  if v_personal is null or not exists (select 1 from public.personais where id = v_personal) then
    raise exception 'Só personais podem definir horários de trabalho.';
  end if;

  if p_duracao not in (30, 45, 60, 90) then
    raise exception 'Escolha uma duração de aula de 30, 45, 60 ou 90 minutos.';
  end if;

  if jsonb_typeof(p_faixas) <> 'array' or jsonb_array_length(p_faixas) > 28 then
    raise exception 'Lista de horários inválida.';
  end if;

  delete from public.horarios_trabalho where personal_id = v_personal;

  insert into public.horarios_trabalho (personal_id, dia_semana, inicio_min, fim_min)
  select v_personal, f.dia, f.inicio_min, f.fim_min
    from jsonb_to_recordset(p_faixas) as f(dia smallint, inicio_min integer, fim_min integer);

  if exists (
    select 1
      from public.horarios_trabalho a
      join public.horarios_trabalho b
        on b.personal_id = a.personal_id
       and b.dia_semana = a.dia_semana
       and b.id > a.id
       and a.inicio_min < b.fim_min
       and b.inicio_min < a.fim_min
     where a.personal_id = v_personal
  ) then
    raise exception 'Há faixas sobrepostas no mesmo dia.';
  end if;

  if exists (
    select 1 from public.horarios_trabalho
     where personal_id = v_personal
     group by dia_semana having count(*) > 4
  ) then
    raise exception 'Use no máximo 4 faixas por dia.';
  end if;

  update public.personais set duracao_aula_min = p_duracao where id = v_personal;
end
$$;

revoke all on function public.salvar_horarios_trabalho(integer, jsonb) from public, anon;
grant execute on function public.salvar_horarios_trabalho(integer, jsonb) to authenticated;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.horarios_trabalho enable row level security;
alter table public.bloqueios         enable row level security;

-- Horários: o personal lê os seus; gravar, só pela função acima.
create policy "personal vê os próprios horários" on public.horarios_trabalho
  for select to authenticated using ((select auth.uid()) = personal_id);

-- Bloqueios: o personal lê, cria e apaga os seus.
create policy "personal vê os próprios bloqueios" on public.bloqueios
  for select to authenticated using ((select auth.uid()) = personal_id);
create policy "personal cria os próprios bloqueios" on public.bloqueios
  for insert to authenticated with check ((select auth.uid()) = personal_id);
create policy "personal apaga os próprios bloqueios" on public.bloqueios
  for delete to authenticated using ((select auth.uid()) = personal_id);

commit;
