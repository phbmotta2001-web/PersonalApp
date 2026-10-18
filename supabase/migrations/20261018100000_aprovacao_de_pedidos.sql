-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 6, ajuste): o personal aprova os pedidos do aluno.
--
-- Decisões de 18/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Reposição e remarcação pedidas pelo aluno entram como "pendente": o horário
--   fica RESERVADO e o personal aceita, recusa ou sugere outro horário.
--   (Ex.: o horário das 16h está livre, mas o personal está do outro lado da cidade.)
-- • Na remarcação, a aula original continua valendo até o personal aceitar.
-- • Recusado (ou sem resposta), a reposição volta para o aluno.
-- • Sem resposta, o pedido expira 2 horas antes do horário pedido.
-- • Sugestão do personal: o aluno aceita ou recusa.
-- • Sem "aceitar automaticamente": remarcações são ocasionais.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261017180000_aniversarios.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Aulas: pedido pendente e resposta ────────────────────────────────────
alter table public.aulas drop constraint aulas_situacao_check;
alter table public.aulas add constraint aulas_situacao_check
  check (situacao in ('agendada', 'confirmada', 'realizada', 'falta', 'cancelada_com_aviso',
                      'cancelada_em_cima', 'remarcada', 'pendente', 'recusada'));

alter table public.aulas
  add column proposta_por text check (proposta_por in ('aluno', 'personal')),
  add column resposta     text check (resposta is null or char_length(resposta) <= 200);

comment on column public.aulas.proposta_por is
  'Pedido pendente: quem propôs o horário atual (o aluno pediu, ou o personal sugeriu outro).';
comment on column public.aulas.resposta is
  'Motivo da recusa (escrito pelo personal) ou "Expirou sem resposta".';

-- O pedido pendente reserva o horário.
alter table public.aulas drop constraint aulas_sem_choque;
alter table public.aulas add constraint aulas_sem_choque exclude using gist (
  personal_id extensions.gist_uuid_ops with =,
  tstzrange(inicio, fim) with &&
) where (situacao in ('agendada', 'confirmada', 'realizada', 'falta', 'pendente'));

-- ─── Avisos: tipos novos ──────────────────────────────────────────────────
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('cancelou_com_reposicao', 'cancelou_em_cima', 'marcou_reposicao', 'remarcou',
                  'pediu_reposicao', 'pediu_remarcacao', 'aceitou_sugestao', 'recusou_sugestao'));

-- ─── Ajudantes ────────────────────────────────────────────────────────────
-- Antecedência mínima para o personal responder: o pedido expira 2 h antes.
create or replace function public.pedido_expirado(p_inicio timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_inicio - interval '2 hours' <= now()
$$;

-- Pedido aceito: vira aula marcada; na remarcação, a aula original sai da agenda.
create or replace function public.efetivar_pedido(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas where id = p_aula;
  update public.aulas
     set situacao = 'agendada', proposta_por = null, atualizada_em = now()
   where id = a.id;
  if a.aula_original_id is not null then
    update public.aulas set situacao = 'remarcada', atualizada_em = now()
     where id = a.aula_original_id and situacao in ('agendada', 'confirmada');
    -- Se a original era uma reposição, a reposição passa para a aula nova.
    update public.creditos_reposicao set usado_em_aula_id = a.id where usado_em_aula_id = a.aula_original_id;
  end if;
end
$$;

-- Pedido recusado (ou expirado): libera o horário e devolve a reposição.
create or replace function public.recusar_pedido(p_aula uuid, p_resposta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.aulas
     set situacao = 'recusada', proposta_por = null, resposta = left(nullif(btrim(p_resposta), ''), 200),
         atualizada_em = now()
   where id = p_aula;
  update public.creditos_reposicao set usado_em_aula_id = null where usado_em_aula_id = p_aula;
end
$$;

-- Robô: pedidos sem resposta expiram 2 h antes do horário.
create or replace function public.expirar_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.aulas where situacao = 'pendente' and public.pedido_expirado(inicio) loop
    perform public.recusar_pedido(r.id, 'Expirou sem resposta.');
  end loop;
end
$$;

-- ─── Livres para o aluno: o pedido pendente também ocupa ──────────────────
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
          and a.situacao in ('agendada', 'confirmada', 'realizada', 'falta', 'pendente')
          and a.inicio < s.ini + make_interval(mins => v_dur) and a.fim > s.ini)
     and not exists (
       select 1 from public.bloqueios b
        where b.personal_id = v.personal_id
          and b.inicio < s.ini + make_interval(mins => v_dur) and b.fim > s.ini)
   order by 1;
end
$$;

-- ─── Aluno: pedir reposição (fica pendente) ───────────────────────────────
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
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, situacao, proposta_por)
    values (v.personal_id, v.aluno_id, v.id, p_inicio, p_inicio + make_interval(mins => v_dur),
            (select local from public.matriculas where vinculo_id = v.id and situacao = 'ativa'),
            'reposicao', 'pendente', 'aluno')
    returning id into v_aula;
  exception when exclusion_violation then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end;

  -- A reposição fica reservada para o pedido; volta se for recusado.
  update public.creditos_reposicao set usado_em_aula_id = v_aula where id = v_credito;
  insert into public.avisos (personal_id, vinculo_id, tipo, aula_nova_id)
  values (v.personal_id, v.id, 'pediu_reposicao', v_aula);
  return v_aula;
end
$$;

-- ─── Aluno: pedir remarcação (a aula original continua até o aceite) ──────
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
  if exists (select 1 from public.aulas where aula_original_id = a.id and situacao = 'pendente') then
    raise exception 'Você já pediu para remarcar esta aula. Aguarde a resposta.';
  end if;
  if not public.horario_livre_para_aluno(v.id, p_inicio) then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end if;

  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, aula_original_id,
                              situacao, proposta_por)
    values (a.personal_id, a.aluno_id, a.vinculo_id, p_inicio, p_inicio + (a.fim - a.inicio), a.local, a.origem, a.id,
            'pendente', 'aluno')
    returning id into v_nova;
  exception when exclusion_violation then
    raise exception 'Esse horário não está mais livre. Escolha outro.';
  end;

  insert into public.avisos (personal_id, vinculo_id, tipo, aula_id, aula_nova_id)
  values (a.personal_id, v.id, 'pediu_remarcacao', a.id, v_nova);
  return v_nova;
end
$$;

-- ─── Aluno: desistir de um pedido ainda pendente ──────────────────────────
create or replace function public.aluno_desistir_pedido(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.aulas where id = p_aula and aluno_id = auth.uid() and situacao = 'pendente') then
    raise exception 'Pedido não encontrado.';
  end if;
  -- Apagar o pedido libera o horário; a reposição reservada volta sozinha.
  update public.creditos_reposicao set usado_em_aula_id = null where usado_em_aula_id = p_aula;
  delete from public.avisos where aula_nova_id = p_aula and lido_em is null;
  delete from public.aulas where id = p_aula;
end
$$;

-- ─── Personal: aceitar ou recusar ─────────────────────────────────────────
create or replace function public.responder_pedido(p_aula uuid, p_aceitar boolean, p_resposta text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas
   where id = p_aula and personal_id = auth.uid() and situacao = 'pendente' for update;
  if not found then
    raise exception 'Pedido não encontrado: talvez já tenha sido respondido ou expirado.';
  end if;
  if a.proposta_por = 'personal' then
    raise exception 'Você já sugeriu outro horário: aguarde a resposta do aluno.';
  end if;
  if public.pedido_expirado(a.inicio) then
    raise exception 'Este pedido expirou (faltam menos de 2 horas).';
  end if;
  if p_aceitar then
    perform public.efetivar_pedido(a.id);
  else
    perform public.recusar_pedido(a.id, p_resposta);
  end if;
end
$$;

-- ─── Personal: sugerir outro horário ──────────────────────────────────────
create or replace function public.sugerir_horario(p_aula uuid, p_data date, p_inicio_min integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a     public.aulas;
  v_ini timestamptz;
begin
  select * into a from public.aulas
   where id = p_aula and personal_id = auth.uid() and situacao = 'pendente' for update;
  if not found then
    raise exception 'Pedido não encontrado: talvez já tenha sido respondido ou expirado.';
  end if;
  if p_inicio_min is null or p_inicio_min < 0 or p_inicio_min % 15 <> 0
     or p_inicio_min * interval '1 minute' + (a.fim - a.inicio) > interval '24 hours' then
    raise exception 'Escolha um horário válido.';
  end if;
  v_ini := public.instante_brasilia(p_data, p_inicio_min);
  if public.pedido_expirado(v_ini) then
    raise exception 'Sugira um horário com pelo menos 2 horas de antecedência.';
  end if;
  begin
    update public.aulas
       set inicio = v_ini, fim = v_ini + (a.fim - a.inicio), proposta_por = 'personal', atualizada_em = now()
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado por outra aula.';
  end;
end
$$;

-- ─── Aluno: responder à sugestão do personal ──────────────────────────────
create or replace function public.aluno_responder_sugestao(p_aula uuid, p_aceitar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas
   where id = p_aula and aluno_id = auth.uid() and situacao = 'pendente' and proposta_por = 'personal' for update;
  if not found then
    raise exception 'Sugestão não encontrada: talvez já tenha expirado.';
  end if;
  if public.pedido_expirado(a.inicio) then
    raise exception 'Esta sugestão expirou.';
  end if;
  if p_aceitar then
    perform public.efetivar_pedido(a.id);
  else
    perform public.recusar_pedido(a.id, 'Você recusou o horário sugerido.');
  end if;
  insert into public.avisos (personal_id, vinculo_id, tipo, aula_id, aula_nova_id)
  values (a.personal_id, a.vinculo_id, case when p_aceitar then 'aceitou_sugestao' else 'recusou_sugestao' end,
          a.aula_original_id, a.id);
end
$$;

-- ─── Personal: marcar aula e encerrar vínculo levam o pedido em conta ─────
-- Pedido pendente não aceita "dada/falta/cancelada": antes, o personal responde.
create or replace function public.bloquear_marcacao_de_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.situacao = 'pendente'
     and new.situacao in ('realizada', 'falta', 'cancelada_com_aviso', 'cancelada_em_cima', 'remarcada') then
    raise exception 'Responda o pedido antes (aceitar, recusar ou sugerir outro horário).';
  end if;
  return new;
end
$$;

create trigger aulas_pedido_pendente
  before update of situacao on public.aulas
  for each row execute function public.bloquear_marcacao_de_pedido();

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
    delete from public.aulas
     where vinculo_id = new.id and situacao in ('agendada', 'pendente') and inicio > now();
  end if;
  return new;
end
$$;

revoke all on function public.pedido_expirado(timestamptz)                  from public, anon, authenticated;
revoke all on function public.efetivar_pedido(uuid)                         from public, anon, authenticated;
revoke all on function public.recusar_pedido(uuid, text)                    from public, anon, authenticated;
revoke all on function public.expirar_pedidos()                             from public, anon, authenticated;
revoke all on function public.bloquear_marcacao_de_pedido()                 from public, anon, authenticated;
revoke all on function public.aluno_desistir_pedido(uuid)                   from public, anon;
revoke all on function public.responder_pedido(uuid, boolean, text)         from public, anon;
revoke all on function public.sugerir_horario(uuid, date, integer)          from public, anon;
revoke all on function public.aluno_responder_sugestao(uuid, boolean)       from public, anon;

grant execute on function public.aluno_desistir_pedido(uuid)                to authenticated;
grant execute on function public.responder_pedido(uuid, boolean, text)      to authenticated;
grant execute on function public.sugerir_horario(uuid, date, integer)       to authenticated;
grant execute on function public.aluno_responder_sugestao(uuid, boolean)    to authenticated;

-- A cada 15 minutos: pedidos sem resposta expiram.
select cron.schedule('pienel-expirar-pedidos', '*/15 * * * *', $$select public.expirar_pedidos()$$);

commit;
