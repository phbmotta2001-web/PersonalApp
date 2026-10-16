-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 6): o aluno cancela, remarca e marca reposição sozinho.
--
-- Decisões de 17/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • O aluno cancela pelo app. Com a antecedência mínima do personal (padrão 12 h)
--   ganha reposição na hora; em cima da hora, a aula conta como dada.
-- • O aluno marca a reposição nos horários livres do personal; entra DIRETO na agenda.
-- • Remarcar num passo só (cancelar + escolher outro horário), só com antecedência.
-- • Reposição e remarcação: pelo menos 8 h antes do novo horário (ajustável), para o
--   personal ter tempo de ver.
-- • O personal recebe um aviso de cada mudança (sininho na agenda). WhatsApp: etapa 9.
-- • O aluno só vê HORÁRIOS livres do personal, nunca quem ocupa os outros.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261017100000_dia_a_dia_da_agenda.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Regra nova: antecedência para o aluno marcar reposição ou remarcar ───
alter table public.personais
  add column antecedencia_reposicao_h integer not null default 8
    check (antecedencia_reposicao_h between 0 and 168);

comment on column public.personais.antecedencia_reposicao_h is
  'Com quantas horas de antecedência o aluno pode marcar reposição ou remarcar pelo app.';

drop function public.salvar_regras(integer);

create or replace function public.salvar_regras(p_antecedencia_h integer, p_antecedencia_reposicao_h integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_antecedencia_h is null or p_antecedencia_h not between 0 and 168
     or p_antecedencia_reposicao_h is null or p_antecedencia_reposicao_h not between 0 and 168 then
    raise exception 'Escolha uma antecedência de 0 a 168 horas.';
  end if;
  update public.personais
     set antecedencia_cancelamento_h = p_antecedencia_h,
         antecedencia_reposicao_h = p_antecedencia_reposicao_h
   where id = auth.uid();
  if not found then
    raise exception 'Só personais podem definir regras.';
  end if;
end
$$;

-- ─── Avisos para o personal ───────────────────────────────────────────────
create table public.avisos (
  id            uuid primary key default gen_random_uuid(),
  personal_id   uuid not null references public.personais (id) on delete cascade,
  vinculo_id    uuid references public.vinculos (id) on delete cascade,
  tipo          text not null check (tipo in ('cancelou_com_reposicao', 'cancelou_em_cima', 'marcou_reposicao', 'remarcou')),
  -- Aula atingida e, quando houver, a aula nova (reposição ou remarcação).
  aula_id       uuid references public.aulas (id) on delete set null,
  aula_nova_id  uuid references public.aulas (id) on delete set null,
  criado_em     timestamptz not null default now(),
  lido_em       timestamptz
);

comment on table public.avisos is
  'O que os alunos fizeram pelo app (cancelar, remarcar, marcar reposição), para o personal ver.';

create index avisos_por_personal on public.avisos (personal_id, criado_em desc);

-- ─── Ajudante: o vínculo ativo do aluno logado ────────────────────────────
create or replace function public.vinculo_do_aluno(p_vinculo uuid)
returns public.vinculos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
begin
  select * into v from public.vinculos
   where id = p_vinculo and aluno_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Você não está ligado a este personal.';
  end if;
  return v;
end
$$;

-- Duração das aulas do aluno com o personal: a da matrícula, ou a padrão do personal.
create or replace function public.duracao_do_vinculo(p_vinculo uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select m.duracao_min from public.matriculas m where m.vinculo_id = p_vinculo and m.situacao = 'ativa'),
    (select p.duracao_aula_min from public.personais p join public.vinculos v on v.personal_id = p.id where v.id = p_vinculo))
$$;

-- ─── Aluno: horários livres do personal (só os horários) ──────────────────
-- Cortados na duração da aula do aluno a partir do início de cada faixa de trabalho,
-- sem aulas nem bloqueios, e com a antecedência mínima do personal.
create or replace function public.livres_para_aluno(p_vinculo uuid, p_de date, p_ate date)
returns table (inicio timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v       public.vinculos := public.vinculo_do_aluno(p_vinculo);
  v_dur   integer := public.duracao_do_vinculo(p_vinculo);
  v_minimo timestamptz := now() + make_interval(hours =>
             (select antecedencia_reposicao_h from public.personais where id = v.personal_id));
begin
  return query
  select s.ini
    from generate_series(p_de, least(p_ate, p_de + 45), interval '1 day') as d(dia)
    join public.horarios_trabalho h
      on h.personal_id = v.personal_id and h.dia_semana = extract(dow from d.dia)
    cross join lateral generate_series(h.inicio_min, h.fim_min - v_dur, v_dur) as m(minuto)
    cross join lateral (select public.instante_brasilia(d.dia::date, m.minuto) as ini) s
   where s.ini >= v_minimo
     and not exists (
       select 1 from public.aulas a
        where a.personal_id = v.personal_id
          and a.situacao in ('agendada', 'confirmada', 'realizada', 'falta')
          and a.inicio < s.ini + make_interval(mins => v_dur) and a.fim > s.ini)
     and not exists (
       select 1 from public.bloqueios b
        where b.personal_id = v.personal_id
          and b.inicio < s.ini + make_interval(mins => v_dur) and b.fim > s.ini)
   order by 1;
end
$$;

-- O horário escolhido pelo aluno tem que estar entre os livres.
create or replace function public.horario_livre_para_aluno(p_vinculo uuid, p_inicio timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.livres_para_aluno(p_vinculo, (p_inicio at time zone 'America/Sao_Paulo')::date,
                                    (p_inicio at time zone 'America/Sao_Paulo')::date) l
     where l.inicio = p_inicio)
$$;

-- ─── Aluno: cancelar uma aula ─────────────────────────────────────────────
create or replace function public.aluno_cancelar_aula(p_aula uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a          public.aulas;
  v          public.vinculos;
  com_aviso  boolean;
  v_validade date;
begin
  select * into a from public.aulas where id = p_aula and aluno_id = auth.uid() for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  v := public.vinculo_do_aluno(a.vinculo_id);
  if a.situacao not in ('agendada', 'confirmada') or a.inicio <= now() then
    raise exception 'Esta aula não pode mais ser cancelada.';
  end if;

  com_aviso := a.inicio - now() >= make_interval(hours =>
                 (select antecedencia_cancelamento_h from public.personais where id = v.personal_id));

  update public.aulas
     set situacao = case when com_aviso then 'cancelada_com_aviso' else 'cancelada_em_cima' end,
         cancelada_por = 'aluno', atualizada_em = now()
   where id = a.id;

  if com_aviso then
    v_validade := public.validade_da_reposicao(v.id, (a.inicio at time zone 'America/Sao_Paulo')::date);
    insert into public.creditos_reposicao (personal_id, vinculo_id, aluno_id, aula_origem_id, valido_ate)
    values (a.personal_id, v.id, a.aluno_id, a.id, v_validade);
  end if;

  insert into public.avisos (personal_id, vinculo_id, tipo, aula_id)
  values (a.personal_id, v.id, case when com_aviso then 'cancelou_com_reposicao' else 'cancelou_em_cima' end, a.id);

  return jsonb_build_object('com_reposicao', com_aviso, 'valido_ate', v_validade);
end
$$;

-- ─── Aluno: marcar reposição ──────────────────────────────────────────────
create or replace function public.aluno_marcar_reposicao(p_vinculo uuid, p_inicio timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v         public.vinculos := public.vinculo_do_aluno(p_vinculo);
  v_dur     integer := public.duracao_do_vinculo(p_vinculo);
  v_credito uuid;
  v_aula    uuid;
begin
  select id into v_credito
    from public.creditos_reposicao
   where vinculo_id = v.id and usado_em_aula_id is null
     and valido_ate >= (p_inicio at time zone 'America/Sao_Paulo')::date
   order by valido_ate
   limit 1
   for update;
  if v_credito is null then
    raise exception 'Você não tem reposição válida para essa data.';
  end if;
  if not public.horario_livre_para_aluno(v.id, p_inicio) then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end if;

  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem)
    values (v.personal_id, v.aluno_id, v.id, p_inicio, p_inicio + make_interval(mins => v_dur),
            (select local from public.matriculas where vinculo_id = v.id and situacao = 'ativa'), 'reposicao')
    returning id into v_aula;
  exception when exclusion_violation then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end;

  update public.creditos_reposicao set usado_em_aula_id = v_aula where id = v_credito;
  insert into public.avisos (personal_id, vinculo_id, tipo, aula_nova_id)
  values (v.personal_id, v.id, 'marcou_reposicao', v_aula);
  return v_aula;
end
$$;

-- ─── Aluno: remarcar (só com a antecedência mínima de cancelamento) ───────
create or replace function public.aluno_remarcar_aula(p_aula uuid, p_inicio timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas;
  v      public.vinculos;
  v_nova uuid;
begin
  select * into a from public.aulas where id = p_aula and aluno_id = auth.uid() for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  v := public.vinculo_do_aluno(a.vinculo_id);
  if a.situacao not in ('agendada', 'confirmada') or a.inicio <= now() then
    raise exception 'Esta aula não pode mais ser remarcada.';
  end if;
  if a.inicio - now() < make_interval(hours =>
       (select antecedencia_cancelamento_h from public.personais where id = v.personal_id)) then
    raise exception 'Está muito em cima da hora para remarcar. Fale com seu personal.';
  end if;
  if not public.horario_livre_para_aluno(v.id, p_inicio) then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end if;

  update public.aulas set situacao = 'remarcada', atualizada_em = now() where id = a.id;
  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, aula_original_id)
    values (a.personal_id, a.aluno_id, a.vinculo_id, p_inicio, p_inicio + (a.fim - a.inicio), a.local, a.origem, a.id)
    returning id into v_nova;
  exception when exclusion_violation then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end;

  update public.creditos_reposicao set usado_em_aula_id = v_nova where usado_em_aula_id = a.id;
  insert into public.avisos (personal_id, vinculo_id, tipo, aula_id, aula_nova_id)
  values (a.personal_id, v.id, 'remarcou', a.id, v_nova);
  return v_nova;
end
$$;

-- ─── Aluno: as regras do personal (para avisar antes de confirmar) ────────
create or replace function public.regras_para_aluno(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos := public.vinculo_do_aluno(p_vinculo);
begin
  return (select jsonb_build_object('cancelamento_h', p.antecedencia_cancelamento_h,
                                    'reposicao_h', p.antecedencia_reposicao_h)
            from public.personais p where p.id = v.personal_id);
end
$$;

-- ─── Personal: marcar os avisos como lidos ────────────────────────────────
create or replace function public.marcar_avisos_lidos()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.avisos set lido_em = now() where personal_id = auth.uid() and lido_em is null
$$;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.avisos enable row level security;

create policy "personal vê os próprios avisos" on public.avisos
  for select to authenticated using ((select auth.uid()) = personal_id);

revoke all on function public.salvar_regras(integer, integer)              from public, anon;
revoke all on function public.vinculo_do_aluno(uuid)                       from public, anon, authenticated;
revoke all on function public.livres_para_aluno(uuid, date, date)          from public, anon;
revoke all on function public.horario_livre_para_aluno(uuid, timestamptz)  from public, anon, authenticated;
revoke all on function public.aluno_cancelar_aula(uuid)                    from public, anon;
revoke all on function public.aluno_marcar_reposicao(uuid, timestamptz)    from public, anon;
revoke all on function public.aluno_remarcar_aula(uuid, timestamptz)       from public, anon;
revoke all on function public.marcar_avisos_lidos()                        from public, anon;
revoke all on function public.regras_para_aluno(uuid)                      from public, anon;

grant execute on function public.salvar_regras(integer, integer)           to authenticated;
grant execute on function public.livres_para_aluno(uuid, date, date)       to authenticated;
grant execute on function public.aluno_cancelar_aula(uuid)                 to authenticated;
grant execute on function public.aluno_marcar_reposicao(uuid, timestamptz) to authenticated;
grant execute on function public.aluno_remarcar_aula(uuid, timestamptz)    to authenticated;
grant execute on function public.marcar_avisos_lidos()                     to authenticated;
grant execute on function public.regras_para_aluno(uuid)                   to authenticated;

commit;
