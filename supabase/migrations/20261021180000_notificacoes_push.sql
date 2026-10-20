-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1, etapa 4b: notificações no celular (push).
--
-- Decisões de 20/10/2026:
-- • Personal recebe: aluno avisou que pagou, questionário respondido, pedidos e
--   avisos de aula (cancelar, remarcar, reposição) e "vence hoje a mensalidade de X".
-- • Aluno recebe: resposta ao pedido (aceito, recusado, outro horário sugerido),
--   matrícula vencendo em 2 dias, matrícula suspensa, questionário novo, aula
--   cancelada pelo personal e lembrete 1 h antes da aula.
-- • Silêncio das 22h às 7h (Brasília): o que cair nesse intervalo sai às 7h. O
--   lembrete de aula que cairia no silêncio vai na véspera, às 21h.
--
-- Como funciona: o banco põe cada notificação numa fila (public.notificacoes). A
-- cada minuto, o pg_cron chama o site (/api/push) com uma senha só dele; o site
-- busca a fila com essa senha, envia pelo serviço de push do celular e devolve o
-- resultado. A chave privada do push fica só no site (Vercel), nunca no banco.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261021140000_inicio_do_ciclo.sql. Depois, rodar a linha de
-- configuração (configurar_push) do jeito explicado na conversa.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create extension if not exists pg_net;

-- ─── Aparelhos inscritos ───────────────────────────────────────────────────
create table public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  criada_em   timestamptz not null default now()
);

comment on table public.push_inscricoes is
  'Celulares/navegadores que aceitaram receber notificações do Pienel (um por aparelho).';

create index push_inscricoes_por_usuario on public.push_inscricoes (usuario_id);

-- ─── Fila de notificações ──────────────────────────────────────────────────
create table public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  tipo           text not null,
  titulo         text not null check (char_length(titulo) <= 120),
  corpo          text not null check (char_length(corpo) <= 300),
  url            text not null default '/inicio',
  -- Evita repetir a mesma notificação (ex.: 'lembrete:<aula>:<início>').
  chave          text unique,
  -- O que ela comenta, para conferir na hora de enviar se ainda vale.
  aula_id        uuid references public.aulas (id) on delete cascade,
  cobranca_id    uuid references public.cobrancas (id) on delete cascade,
  checkin_id     uuid references public.checkins (id) on delete cascade,
  vinculo_id     uuid references public.vinculos (id) on delete cascade,
  enviar_em      timestamptz not null default now(),
  enviada_em     timestamptz,
  descartada_em  timestamptz,
  criada_em      timestamptz not null default now()
);

comment on table public.notificacoes is
  'Fila das notificações push. Só as funções do banco leem e gravam.';

create index notificacoes_pendentes on public.notificacoes (enviar_em)
  where enviada_em is null and descartada_em is null;

-- Configuração do envio: endereço do site e a senha que o pg_cron manda para ele.
create table public.push_config (
  id       boolean primary key default true check (id),
  url      text not null check (url ~ '^https://'),
  segredo  text not null check (char_length(segredo) >= 32)
);

alter table public.push_inscricoes enable row level security;
alter table public.notificacoes    enable row level security;
alter table public.push_config     enable row level security;
-- Sem políticas: ninguém lê ou grava direto; só pelas funções abaixo.

-- ─── Ajudantes ─────────────────────────────────────────────────────────────

-- Horário de silêncio (22h–7h em Brasília): empurra para as 7h.
create or replace function public.fora_do_silencio(p timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local timestamp := p at time zone 'America/Sao_Paulo';
  h integer := extract(hour from local);
begin
  if h >= 22 then
    return public.instante_brasilia(local::date + 1, 420);
  elsif h < 7 then
    return public.instante_brasilia(local::date, 420);
  end if;
  return p;
end
$$;

-- "qui, 22/10 às 07:00"
create or replace function public.texto_da_aula_push(p timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select (array['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'])[extract(dow from p at time zone 'America/Sao_Paulo')::int + 1]
         || ', ' || to_char(p at time zone 'America/Sao_Paulo', 'DD/MM') || ' às '
         || to_char(p at time zone 'America/Sao_Paulo', 'HH24:MI');
$$;

-- "R$ 1.234,50"
create or replace function public.reais_push(p_centavos integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || regexp_replace((p_centavos / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
         || ',' || lpad((p_centavos % 100)::text, 2, '0');
$$;

-- Primeiro nome do aluno de um vínculo (ou o nome do convite).
create or replace function public.primeiro_nome_do_aluno(p_vinculo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(btrim(coalesce(a.nome_completo, v.nome_convite)), ' ', 1)
    from public.vinculos v
    left join public.alunos a on a.id = v.aluno_id
   where v.id = p_vinculo;
$$;

create or replace function public.primeiro_nome_do_personal(p_personal uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(btrim(nome_completo), ' ', 1) from public.personais where id = p_personal;
$$;

-- Põe uma notificação na fila (só se a pessoa tem algum aparelho inscrito).
create or replace function public.notificar(
  p_usuario uuid, p_tipo text, p_titulo text, p_corpo text, p_url text,
  p_quando timestamptz default now(), p_chave text default null,
  p_aula uuid default null, p_cobranca uuid default null, p_checkin uuid default null,
  p_vinculo uuid default null, p_respeita_silencio boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_usuario is null
     or not exists (select 1 from public.push_inscricoes where usuario_id = p_usuario) then
    return;
  end if;
  insert into public.notificacoes
    (usuario_id, tipo, titulo, corpo, url, chave, aula_id, cobranca_id, checkin_id, vinculo_id, enviar_em)
  values
    (p_usuario, p_tipo, left(p_titulo, 120), left(p_corpo, 300), p_url, p_chave,
     p_aula, p_cobranca, p_checkin, p_vinculo,
     case when p_respeita_silencio then public.fora_do_silencio(greatest(p_quando, now()))
          else greatest(p_quando, now()) end)
  on conflict (chave) do nothing;
end
$$;

-- ─── Inscrição do aparelho (chamada pelo site) ─────────────────────────────

create or replace function public.salvar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta de novo.';
  end if;
  insert into public.push_inscricoes (usuario_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth;
end
$$;

create or replace function public.remover_inscricao_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and usuario_id = auth.uid();
$$;

-- ─── Personal: o que chega no sininho também vira notificação ──────────────

create or replace function public.avisos_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome   text := coalesce(public.primeiro_nome_do_aluno(new.vinculo_id), 'Um aluno');
  quando text;
  titulo text;
  corpo  text;
  url    text := '/agenda/avisos';
begin
  select public.texto_da_aula_push(inicio) into quando from public.aulas where id = coalesce(new.aula_nova_id, new.aula_id);
  quando := coalesce('Aula de ' || quando || '.', '');
  case new.tipo
    when 'cancelou_com_reposicao' then titulo := nome || ' cancelou uma aula'; corpo := quando || ' Avisou com antecedência: ganhou uma reposição.';
    when 'cancelou_em_cima'       then titulo := nome || ' cancelou em cima da hora'; corpo := quando;
    when 'marcou_reposicao'       then titulo := nome || ' marcou uma reposição'; corpo := quando;
    when 'remarcou'               then titulo := nome || ' remarcou uma aula'; corpo := quando;
    when 'pediu_reposicao'        then titulo := nome || ' pediu uma reposição'; corpo := quando || ' Toque para aceitar ou recusar.'; url := '/agenda';
    when 'pediu_remarcacao'       then titulo := nome || ' pediu para remarcar'; corpo := quando || ' Toque para aceitar ou recusar.'; url := '/agenda';
    when 'aceitou_sugestao'       then titulo := nome || ' aceitou o horário que você sugeriu'; corpo := quando;
    when 'recusou_sugestao'       then titulo := nome || ' recusou o horário que você sugeriu'; corpo := quando;
    when 'avisou_pagamento'       then titulo := nome || ' avisou que pagou'; corpo := 'Confira no banco e confirme no Pienel.'; url := '/agenda/cobrancas';
    when 'respondeu_checkin'      then titulo := nome || ' respondeu o questionário'; corpo := 'Toque para ver as respostas.'; url := '/agenda/online/' || new.vinculo_id;
    else return new;
  end case;
  perform public.notificar(new.personal_id, 'aviso_' || new.tipo, titulo, btrim(coalesce(corpo, '')), url,
                           p_chave => 'aviso:' || new.id);
  return new;
end
$$;

create trigger avisos_notificar
  after insert on public.avisos
  for each row execute function public.avisos_notificar();

-- ─── Aluno: respostas do personal e aula cancelada ─────────────────────────

create or replace function public.aulas_notificar_aluno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal text := coalesce(public.primeiro_nome_do_personal(new.personal_id), 'Seu personal');
  quando   text := public.texto_da_aula_push(new.inicio);
  url      text := '/aluno/personal/' || new.vinculo_id;
begin
  if new.aluno_id is null or new.vinculo_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.situacao = 'pendente' and new.proposta_por = 'personal' then
      perform public.notificar(new.aluno_id, 'sugestao', personal || ' sugeriu outro horário',
        'Aula de ' || quando || '. Toque para aceitar ou recusar.', url,
        p_chave => 'sugestao:' || new.id, p_aula => new.id);
    end if;
    return new;
  end if;

  -- Pedido do aluno respondido pelo personal.
  if old.situacao = 'pendente' and old.proposta_por = 'aluno' then
    if new.situacao = 'agendada' then
      perform public.notificar(new.aluno_id, 'pedido_aceito', personal || ' aceitou seu pedido',
        'Aula marcada: ' || quando || '.', url, p_chave => 'aceito:' || new.id);
    elsif new.situacao = 'recusada' and auth.uid() = new.personal_id then
      perform public.notificar(new.aluno_id, 'pedido_recusado', personal || ' não aceitou seu pedido',
        coalesce(new.resposta, 'Aula de ' || quando || '. Fale com ' || personal || ' para combinar outro horário.'), url,
        p_chave => 'recusado:' || new.id);
    end if;
  end if;

  -- Aula cancelada pelo personal.
  if old.situacao in ('agendada', 'confirmada')
     and new.situacao in ('cancelada_com_aviso', 'cancelada_em_cima')
     and new.cancelada_por = 'personal' and new.inicio > now() then
    perform public.notificar(new.aluno_id, 'aula_cancelada', personal || ' cancelou sua aula',
      'Aula de ' || quando || '.', url, p_chave => 'cancelada:' || new.id);
  end if;
  return new;
end
$$;

create trigger aulas_notificar_aluno
  after insert or update on public.aulas
  for each row execute function public.aulas_notificar_aluno();

-- ─── Aluno: questionário novo ──────────────────────────────────────────────

create or replace function public.checkins_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notificar(new.aluno_id, 'questionario',
    'Questionário de ' || coalesce(public.primeiro_nome_do_personal(new.personal_id), 'seu personal'),
    new.titulo || ': leva uns 2 minutos.', '/aluno/questionario/' || new.id,
    p_quando => new.disponivel_em, p_chave => 'checkin:' || new.id, p_checkin => new.id);
  return new;
end
$$;

create trigger checkins_notificar
  after insert on public.checkins
  for each row execute function public.checkins_notificar();

-- ─── Lembretes e vencimentos (a cada 5 minutos) ────────────────────────────

create or replace function public.gerar_notificacoes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  hoje    date := public.hoje_brasilia();
  as_9h   timestamptz := public.instante_brasilia(public.hoje_brasilia(), 540);
  alvo    timestamptz;
  h       integer;
  titulo  text;
begin
  -- Lembrete 1 h antes da aula. Se cair no silêncio, vai na véspera às 21h.
  for r in
    select a.id, a.aluno_id, a.inicio, a.local, a.personal_id, a.vinculo_id
      from public.aulas a
     where a.situacao in ('agendada', 'confirmada') and a.aluno_id is not null and a.vinculo_id is not null
       and a.inicio > now() + interval '10 minutes' and a.inicio <= now() + interval '12 hours'
  loop
    alvo := r.inicio - interval '1 hour';
    h := extract(hour from alvo at time zone 'America/Sao_Paulo');
    if h >= 22 then
      alvo := public.instante_brasilia((alvo at time zone 'America/Sao_Paulo')::date, 1260);
    elsif h < 7 then
      alvo := public.instante_brasilia((alvo at time zone 'America/Sao_Paulo')::date - 1, 1260);
    end if;
    titulo := case when (r.inicio at time zone 'America/Sao_Paulo')::date = (greatest(alvo, now()) at time zone 'America/Sao_Paulo')::date
                   then 'Aula hoje às ' else 'Aula amanhã às ' end
              || to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24:MI');
    perform public.notificar(r.aluno_id, 'lembrete_aula', titulo,
      concat_ws(' · ', 'Com ' || public.primeiro_nome_do_personal(r.personal_id), r.local),
      '/aluno/personal/' || r.vinculo_id, p_quando => alvo,
      p_chave => 'lembrete:' || r.id || ':' || extract(epoch from r.inicio)::bigint,
      p_aula => r.id, p_respeita_silencio => false);
  end loop;

  -- Mensalidades abertas: aluno 2 dias antes; personal no dia do vencimento.
  for r in
    select c.id, c.aluno_id, c.personal_id, c.vinculo_id, c.vencimento, c.valor_centavos,
           coalesce(m.suspender_se_atrasar, false) as suspende
      from public.cobrancas c
      left join public.matriculas m on m.id = c.matricula_id
     where c.tipo = 'mensalidade' and c.situacao = 'aberta' and c.vencimento between hoje and hoje + 2
  loop
    if r.vencimento = hoje + 2 then
      perform public.notificar(r.aluno_id, 'vence_em_2_dias', 'Sua matrícula vence em 2 dias',
        public.reais_push(r.valor_centavos) || ' com '
          || public.primeiro_nome_do_personal(r.personal_id) || ', vence ' || to_char(r.vencimento, 'DD/MM') || '.'
          || case when r.suspende then ' Se não for paga até lá, a matrícula fica suspensa.' else '' end,
        '/aluno/personal/' || r.vinculo_id, p_quando => as_9h,
        p_chave => 'vence2:' || r.id, p_cobranca => r.id);
    elsif r.vencimento = hoje then
      perform public.notificar(r.personal_id, 'vence_hoje', 'Vence hoje: mensalidade de ' || public.primeiro_nome_do_aluno(r.vinculo_id),
        public.reais_push(r.valor_centavos) || '. Toque para ver ou cobrar.',
        '/agenda/cobrancas/' || r.id, p_quando => as_9h,
        p_chave => 'vencehoje:' || r.id, p_cobranca => r.id);
    end if;
  end loop;

  -- Matrícula suspensa hoje (dia seguinte ao vencimento sem pagamento).
  for r in
    select m.vinculo_id, m.aluno_id, m.personal_id
      from public.matriculas m
     where m.situacao = 'ativa' and m.suspender_se_atrasar
       and public.suspensa_desde(m.vinculo_id) = hoje
  loop
    perform public.notificar(r.aluno_id, 'suspensa', 'Sua matrícula está suspensa',
      'A mensalidade com ' || public.primeiro_nome_do_personal(r.personal_id)
        || ' venceu sem pagamento. Pague pelo Pienel para liberar suas aulas.',
      '/aluno/personal/' || r.vinculo_id, p_quando => as_9h,
      p_chave => 'suspensa:' || r.vinculo_id || ':' || hoje, p_vinculo => r.vinculo_id);
  end loop;

  -- Faxina: notificações com mais de 30 dias.
  delete from public.notificacoes where criada_em < now() - interval '30 days';
end
$$;

-- ─── Envio (o site busca a fila com a senha do push_config) ────────────────

create or replace function public.configurar_push(p_url text, p_segredo text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_config (id, url, segredo) values (true, p_url, p_segredo)
  on conflict (id) do update set url = excluded.url, segredo = excluded.segredo;
$$;

create or replace function public.push_pendentes(p_segredo text, p_limite integer default 200)
returns table (notificacao_id uuid, endpoint text, p256dh text, auth text, titulo text, corpo text, url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_segredo is null or not exists (select 1 from public.push_config where segredo = p_segredo) then
    raise exception 'Acesso negado.';
  end if;

  -- Descarta o que não vale mais (aula desmarcada, mensalidade paga, questionário respondido…).
  update public.notificacoes n
     set descartada_em = now()
   where n.enviada_em is null and n.descartada_em is null and n.enviar_em <= now()
     and (
       (n.tipo in ('lembrete_aula', 'sugestao')
          and not exists (select 1 from public.aulas a where a.id = n.aula_id
                            and a.situacao in ('agendada', 'confirmada', 'pendente') and a.inicio > now()))
       or (n.cobranca_id is not null
          and not exists (select 1 from public.cobrancas c where c.id = n.cobranca_id and c.situacao = 'aberta'))
       or (n.checkin_id is not null
          and exists (select 1 from public.checkins k where k.id = n.checkin_id and k.respondido_em is not null))
       or (n.tipo = 'suspensa' and public.suspensa_desde(n.vinculo_id) is null)
       or n.enviar_em < now() - interval '1 day'
       or not exists (select 1 from public.push_inscricoes i where i.usuario_id = n.usuario_id)
     );

  return query
    select n.id, i.endpoint, i.p256dh, i.auth, n.titulo, n.corpo, n.url
      from (select * from public.notificacoes
             where enviada_em is null and descartada_em is null and enviar_em <= now()
             order by enviar_em limit greatest(1, least(p_limite, 500))) n
      join public.push_inscricoes i on i.usuario_id = n.usuario_id;
end
$$;

create or replace function public.push_resultado(p_segredo text, p_enviadas uuid[], p_aparelhos_mortos text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_segredo is null or not exists (select 1 from public.push_config where segredo = p_segredo) then
    raise exception 'Acesso negado.';
  end if;
  update public.notificacoes set enviada_em = now()
   where id = any (coalesce(p_enviadas, '{}')) and enviada_em is null;
  delete from public.push_inscricoes where endpoint = any (coalesce(p_aparelhos_mortos, '{}'));
end
$$;

-- A cada minuto: se há algo na fila, chama o site para enviar.
create or replace function public.disparar_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.push_config;
begin
  select * into cfg from public.push_config where id;
  if not found then
    return;
  end if;
  if exists (select 1 from public.notificacoes
              where enviada_em is null and descartada_em is null and enviar_em <= now()) then
    perform net.http_post(
      url := cfg.url,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-pienel-segredo', cfg.segredo),
      timeout_milliseconds := 20000
    );
  end if;
end
$$;

revoke all on function public.fora_do_silencio(timestamptz)          from public, anon, authenticated;
revoke all on function public.texto_da_aula_push(timestamptz)        from public, anon, authenticated;
revoke all on function public.reais_push(integer)                    from public, anon, authenticated;
revoke all on function public.primeiro_nome_do_aluno(uuid)           from public, anon, authenticated;
revoke all on function public.primeiro_nome_do_personal(uuid)        from public, anon, authenticated;
revoke all on function public.notificar(uuid, text, text, text, text, timestamptz, text, uuid, uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.avisos_notificar()                      from public, anon, authenticated;
revoke all on function public.aulas_notificar_aluno()                 from public, anon, authenticated;
revoke all on function public.checkins_notificar()                    from public, anon, authenticated;
revoke all on function public.gerar_notificacoes()                    from public, anon, authenticated;
revoke all on function public.disparar_push()                         from public, anon, authenticated;
revoke all on function public.configurar_push(text, text)             from public, anon, authenticated;
revoke all on function public.salvar_inscricao_push(text, text, text) from public, anon;
revoke all on function public.remover_inscricao_push(text)            from public, anon;
revoke all on function public.push_pendentes(text, integer)           from public;
revoke all on function public.push_resultado(text, uuid[], text[])    from public;
grant execute on function public.salvar_inscricao_push(text, text, text) to authenticated;
grant execute on function public.remover_inscricao_push(text)            to authenticated;
-- O site chama sem login, com a senha do push_config.
grant execute on function public.push_pendentes(text, integer)        to anon, authenticated;
grant execute on function public.push_resultado(text, uuid[], text[]) to anon, authenticated;

select cron.schedule('pienel-gerar-notificacoes', '*/5 * * * *', $$select public.gerar_notificacoes()$$);
select cron.schedule('pienel-enviar-push', '* * * * *', $$select public.disparar_push()$$);

commit;
