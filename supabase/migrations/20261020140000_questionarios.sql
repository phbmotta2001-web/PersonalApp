-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: questionários de acompanhamento (alunos online e híbridos).
--
-- Decisões de 20/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • O personal monta modelos de questionário (já vem um "Check-in semanal" pronto
--   e editável) com perguntas de nota (0 a 10), número, sim/não, múltipla escolha
--   e texto.
-- • Programação por aluno: semanal, quinzenal ou mensal, num dia e hora.
-- • Na data, o questionário fica pendente para o aluno responder no app; o personal
--   manda o link pelo WhatsApp com um toque (envio automático: etapa 9).
-- • As respostas guardam a cópia das perguntas daquele dia (mudar o modelo depois
--   não altera o que já foi respondido).
-- • Sem fotos por enquanto.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261020100000_alunos_online_e_hibridos.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Modelos de questionário ──────────────────────────────────────────────
-- perguntas: [{"id": "p1", "tipo": "nota"|"numero"|"sim_nao"|"escolha"|"texto",
--              "texto": "...", "obrigatoria": true, "opcoes": [...], "unidade": "h"}]
create table public.questionarios (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null references public.personais (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 2 and 60),
  perguntas      jsonb not null check (jsonb_typeof(perguntas) = 'array' and jsonb_array_length(perguntas) between 1 and 30),
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.questionarios is 'Modelos de questionário de acompanhamento do personal.';
create index questionarios_por_personal on public.questionarios (personal_id);

-- ─── Programação: qual questionário, para qual aluno, quando ──────────────
create table public.programacoes_questionario (
  id              uuid primary key default gen_random_uuid(),
  personal_id     uuid not null references public.personais (id) on delete cascade,
  questionario_id uuid not null references public.questionarios (id) on delete cascade,
  vinculo_id      uuid not null references public.vinculos (id) on delete cascade,
  frequencia      text not null check (frequencia in ('semanal', 'quinzenal', 'mensal')),
  dia_semana      smallint check (dia_semana between 0 and 6),
  dia_mes         smallint check (dia_mes between 1 and 31),
  hora_min        integer not null check (hora_min between 0 and 1410 and hora_min % 30 = 0),
  inicio          date not null,
  ativa           boolean not null default true,
  criada_em       timestamptz not null default now(),
  check ((frequencia = 'mensal' and dia_mes is not null) or (frequencia <> 'mensal' and dia_semana is not null))
);

create index programacoes_por_vinculo on public.programacoes_questionario (vinculo_id);

-- ─── Check-ins: cada envio, com as respostas ──────────────────────────────
create table public.checkins (
  id              uuid primary key default gen_random_uuid(),
  personal_id     uuid not null references public.personais (id) on delete cascade,
  vinculo_id      uuid not null references public.vinculos (id) on delete cascade,
  aluno_id        uuid references public.alunos (id) on delete set null,
  programacao_id  uuid references public.programacoes_questionario (id) on delete set null,
  titulo          text not null,
  -- Cópia das perguntas no dia do envio.
  perguntas       jsonb not null,
  disponivel_em   timestamptz not null,
  enviado_em      timestamptz,
  respondido_em   timestamptz,
  respostas       jsonb,
  criado_em       timestamptz not null default now(),
  unique (programacao_id, disponivel_em)
);

comment on table public.checkins is 'Cada questionário enviado a um aluno e as respostas dele.';
create index checkins_por_vinculo on public.checkins (vinculo_id, disponivel_em desc);
create index checkins_por_personal on public.checkins (personal_id, disponivel_em desc);

-- ─── Avisos: o aluno respondeu ────────────────────────────────────────────
alter table public.avisos add column checkin_id uuid references public.checkins (id) on delete cascade;
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('cancelou_com_reposicao', 'cancelou_em_cima', 'marcou_reposicao', 'remarcou',
                  'pediu_reposicao', 'pediu_remarcacao', 'aceitou_sugestao', 'recusou_sugestao',
                  'avisou_pagamento', 'respondeu_checkin'));

-- ─── Conferir as perguntas de um modelo ───────────────────────────────────
create or replace function public.perguntas_validas(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 30
     and not exists (
       select 1 from jsonb_array_elements(p) q
        where coalesce(q ->> 'id', '') = ''
           or q ->> 'tipo' not in ('nota', 'numero', 'sim_nao', 'escolha', 'texto')
           or char_length(btrim(coalesce(q ->> 'texto', ''))) not between 2 and 140
           or (q ->> 'tipo' = 'escolha' and (jsonb_typeof(q -> 'opcoes') <> 'array'
                                              or jsonb_array_length(q -> 'opcoes') not between 2 and 8))
     )
     and (select count(distinct q ->> 'id') from jsonb_array_elements(p) q) = jsonb_array_length(p)
$$;

-- ─── Questionário pronto: "Check-in semanal" ──────────────────────────────
create or replace function public.criar_questionario_padrao()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só personais podem criar questionários.';
  end if;
  select id into v_id from public.questionarios where personal_id = auth.uid() limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.questionarios (personal_id, nome, perguntas)
  values (auth.uid(), 'Check-in semanal', jsonb_build_array(
    jsonb_build_object('id', 'treinos', 'tipo', 'numero', 'texto', 'Quantos treinos você fez nesta semana?', 'unidade', 'treinos', 'obrigatoria', true),
    jsonb_build_object('id', 'adesao', 'tipo', 'nota', 'texto', 'De 0 a 10, quanto você seguiu o protocolo de treino?', 'obrigatoria', true),
    jsonb_build_object('id', 'satisfacao', 'tipo', 'nota', 'texto', 'De 0 a 10, qual a sua satisfação com o protocolo?', 'obrigatoria', true),
    jsonb_build_object('id', 'sono_qualidade', 'tipo', 'nota', 'texto', 'De 0 a 10, como foi a qualidade do seu sono na semana?', 'obrigatoria', true),
    jsonb_build_object('id', 'sono_horas', 'tipo', 'numero', 'texto', 'Quantas horas você dormiu por noite, em média?', 'unidade', 'h', 'obrigatoria', true),
    jsonb_build_object('id', 'carga', 'tipo', 'escolha', 'texto', 'Conseguiu progredir nas cargas?', 'obrigatoria', true,
                       'opcoes', jsonb_build_array('Sim, na maioria dos exercícios', 'Em alguns exercícios', 'Não, mantive', 'Precisei diminuir')),
    jsonb_build_object('id', 'aerobico', 'tipo', 'numero', 'texto', 'Quantas vezes você fez aeróbico nesta semana?', 'unidade', 'vezes', 'obrigatoria', true),
    jsonb_build_object('id', 'alimentacao', 'tipo', 'nota', 'texto', 'De 0 a 10, que nota você dá para a qualidade da sua alimentação?', 'obrigatoria', true),
    jsonb_build_object('id', 'comentario', 'tipo', 'texto', 'texto', 'Quer contar algo para o seu personal? (dor, viagem, dúvida…)', 'obrigatoria', false)
  ))
  returning id into v_id;
  return v_id;
end
$$;

-- ─── Personal: salvar e arquivar modelos ──────────────────────────────────
create or replace function public.salvar_questionario(p_id uuid, p_nome text, p_perguntas jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só personais podem criar questionários.';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 60 then
    raise exception 'Dê um nome ao questionário (até 60 caracteres).';
  end if;
  if not public.perguntas_validas(p_perguntas) then
    raise exception 'Confira as perguntas: cada uma precisa de um texto, e a múltipla escolha, de 2 a 8 opções.';
  end if;
  if p_id is null then
    insert into public.questionarios (personal_id, nome, perguntas)
    values (auth.uid(), btrim(p_nome), p_perguntas) returning id into v_id;
  else
    update public.questionarios set nome = btrim(p_nome), perguntas = p_perguntas, atualizado_em = now()
     where id = p_id and personal_id = auth.uid() returning id into v_id;
    if v_id is null then
      raise exception 'Questionário não encontrado.';
    end if;
  end if;
  return v_id;
end
$$;

create or replace function public.arquivar_questionario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.questionarios set arquivado = true, atualizado_em = now()
   where id = p_id and personal_id = auth.uid();
  if not found then
    raise exception 'Questionário não encontrado.';
  end if;
  -- Programações dele param de enviar.
  update public.programacoes_questionario set ativa = false where questionario_id = p_id;
end
$$;

-- ─── Quando cai o envio mais recente de uma programação ───────────────────
create or replace function public.ultimo_envio(p public.programacoes_questionario)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(public.instante_brasilia(d, p.hora_min))
    from (
      select dia::date as d
        from generate_series(p.inicio, public.hoje_brasilia(), interval '1 day') as g(dia)
       where case p.frequencia
               when 'semanal'   then extract(dow from dia) = p.dia_semana
               when 'quinzenal' then extract(dow from dia) = p.dia_semana
                                     and ((dia::date - p.inicio) / 7) % 2 = 0
               else extract(day from dia) = least(p.dia_mes,
                      extract(day from (date_trunc('month', dia) + interval '1 month' - interval '1 day')))
             end
    ) datas
   where public.instante_brasilia(d, p.hora_min) <= now()
$$;

-- ─── Robô: cria os check-ins que chegaram na data ─────────────────────────
-- Só o envio mais recente de cada programação (nada de acumular atrasados), e só
-- depois que a programação foi criada.
create or replace function public.gerar_checkins()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_quando timestamptz;
  n      integer := 0;
begin
  for r in
    select p as prog, p.id, p.personal_id, p.vinculo_id, p.criada_em,
           q.nome as q_nome, q.perguntas as q_perguntas, v.aluno_id as v_aluno
      from public.programacoes_questionario p
      join public.questionarios q on q.id = p.questionario_id and not q.arquivado
      join public.vinculos v on v.id = p.vinculo_id and v.situacao = 'ativo'
     where p.ativa
  loop
    v_quando := public.ultimo_envio(r.prog);
    if v_quando is not null and v_quando >= r.criada_em - interval '1 day' then
      insert into public.checkins (personal_id, vinculo_id, aluno_id, programacao_id, titulo, perguntas, disponivel_em)
      values (r.personal_id, r.vinculo_id, r.v_aluno, r.id, r.q_nome, r.q_perguntas, v_quando)
      on conflict (programacao_id, disponivel_em) do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end
$$;

-- ─── Personal: programar, pausar e excluir ────────────────────────────────
create or replace function public.salvar_programacao(
  p_id uuid, p_questionario uuid, p_vinculo uuid, p_frequencia text,
  p_dia_semana integer, p_dia_mes integer, p_hora_min integer, p_inicio date, p_ativa boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo') then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;
  if not exists (select 1 from public.questionarios where id = p_questionario and personal_id = auth.uid() and not arquivado) then
    raise exception 'Questionário não encontrado.';
  end if;
  if p_frequencia not in ('semanal', 'quinzenal', 'mensal') then
    raise exception 'Escolha a frequência.';
  end if;
  if p_inicio is null then
    raise exception 'Escolha a data de início.';
  end if;
  if p_id is null then
    insert into public.programacoes_questionario
      (personal_id, questionario_id, vinculo_id, frequencia, dia_semana, dia_mes, hora_min, inicio, ativa)
    values (auth.uid(), p_questionario, p_vinculo, p_frequencia,
            case when p_frequencia = 'mensal' then null else p_dia_semana end,
            case when p_frequencia = 'mensal' then p_dia_mes end,
            p_hora_min, p_inicio, coalesce(p_ativa, true))
    returning id into v_id;
  else
    update public.programacoes_questionario
       set questionario_id = p_questionario, frequencia = p_frequencia,
           dia_semana = case when p_frequencia = 'mensal' then null else p_dia_semana end,
           dia_mes = case when p_frequencia = 'mensal' then p_dia_mes end,
           hora_min = p_hora_min, inicio = p_inicio, ativa = coalesce(p_ativa, true)
     where id = p_id and personal_id = auth.uid() and vinculo_id = p_vinculo
    returning id into v_id;
    if v_id is null then
      raise exception 'Programação não encontrada.';
    end if;
  end if;
  perform public.gerar_checkins();
  return v_id;
end
$$;

create or replace function public.excluir_programacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.programacoes_questionario where id = p_id and personal_id = auth.uid();
  if not found then
    raise exception 'Programação não encontrada.';
  end if;
end
$$;

-- Enviar agora (fora da programação): cria um check-in avulso.
create or replace function public.enviar_questionario_agora(p_questionario uuid, p_vinculo uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v  public.vinculos;
  q  public.questionarios;
  v_id uuid;
begin
  select * into v from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;
  select * into q from public.questionarios where id = p_questionario and personal_id = auth.uid() and not arquivado;
  if not found then
    raise exception 'Questionário não encontrado.';
  end if;
  insert into public.checkins (personal_id, vinculo_id, aluno_id, titulo, perguntas, disponivel_em)
  values (v.personal_id, v.id, v.aluno_id, q.nome, q.perguntas, now())
  returning id into v_id;
  return v_id;
end
$$;

-- Marca que o personal mandou o link pelo WhatsApp.
create or replace function public.marcar_checkin_enviado(p_checkin uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.checkins set enviado_em = coalesce(enviado_em, now())
   where id = p_checkin and personal_id = auth.uid()
$$;

-- ─── Aluno: responder ─────────────────────────────────────────────────────
-- p_respostas: {"<id da pergunta>": valor, ...}
create or replace function public.responder_checkin(p_checkin uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c   public.checkins;
  q   jsonb;
  r   jsonb;
begin
  select * into c from public.checkins where id = p_checkin and aluno_id = auth.uid() for update;
  if not found then
    raise exception 'Questionário não encontrado.';
  end if;
  perform public.vinculo_do_aluno(c.vinculo_id);
  if c.respondido_em is not null then
    raise exception 'Você já respondeu este questionário.';
  end if;
  if jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'Respostas inválidas.';
  end if;

  for q in select * from jsonb_array_elements(c.perguntas) loop
    r := p_respostas -> (q ->> 'id');
    if r is null or r = 'null'::jsonb or (jsonb_typeof(r) = 'string' and btrim(r #>> '{}') = '') then
      if coalesce((q ->> 'obrigatoria')::boolean, false) then
        raise exception 'Responda: "%".', q ->> 'texto';
      end if;
      continue;
    end if;
    if (q ->> 'tipo' = 'nota' and (jsonb_typeof(r) <> 'number' or (r #>> '{}')::numeric not between 0 and 10))
       or (q ->> 'tipo' = 'numero' and (jsonb_typeof(r) <> 'number' or (r #>> '{}')::numeric not between 0 and 100000))
       or (q ->> 'tipo' = 'sim_nao' and jsonb_typeof(r) <> 'boolean')
       or (q ->> 'tipo' = 'escolha' and not ((q -> 'opcoes') ? (r #>> '{}')))
       or (q ->> 'tipo' = 'texto' and (jsonb_typeof(r) <> 'string' or char_length(r #>> '{}') > 1000)) then
      raise exception 'Confira a resposta de "%".', q ->> 'texto';
    end if;
  end loop;

  -- Guarda só as respostas das perguntas que existem.
  update public.checkins
     set respostas = (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                        from jsonb_each(p_respostas) as e(k, v)
                       where exists (select 1 from jsonb_array_elements(c.perguntas) pq where pq ->> 'id' = k)),
         respondido_em = now()
   where id = c.id;

  insert into public.avisos (personal_id, vinculo_id, tipo, checkin_id)
  values (c.personal_id, c.vinculo_id, 'respondeu_checkin', c.id);
end
$$;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.questionarios              enable row level security;
alter table public.programacoes_questionario  enable row level security;
alter table public.checkins                   enable row level security;

create policy "personal vê os próprios questionários" on public.questionarios
  for select to authenticated using ((select auth.uid()) = personal_id);
create policy "personal vê as próprias programações" on public.programacoes_questionario
  for select to authenticated using ((select auth.uid()) = personal_id);
create policy "personal e aluno veem os próprios check-ins" on public.checkins
  for select to authenticated using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

revoke all on function public.perguntas_validas(jsonb)                       from public, anon, authenticated;
revoke all on function public.ultimo_envio(public.programacoes_questionario) from public, anon, authenticated;
revoke all on function public.gerar_checkins()                              from public, anon, authenticated;
revoke all on function public.criar_questionario_padrao()                   from public, anon;
revoke all on function public.salvar_questionario(uuid, text, jsonb)        from public, anon;
revoke all on function public.arquivar_questionario(uuid)                   from public, anon;
revoke all on function public.salvar_programacao(uuid, uuid, uuid, text, integer, integer, integer, date, boolean) from public, anon;
revoke all on function public.excluir_programacao(uuid)                     from public, anon;
revoke all on function public.enviar_questionario_agora(uuid, uuid)         from public, anon;
revoke all on function public.marcar_checkin_enviado(uuid)                  from public, anon;
revoke all on function public.responder_checkin(uuid, jsonb)                from public, anon;

grant execute on function public.criar_questionario_padrao()                to authenticated;
grant execute on function public.salvar_questionario(uuid, text, jsonb)     to authenticated;
grant execute on function public.arquivar_questionario(uuid)                to authenticated;
grant execute on function public.salvar_programacao(uuid, uuid, uuid, text, integer, integer, integer, date, boolean) to authenticated;
grant execute on function public.excluir_programacao(uuid)                  to authenticated;
grant execute on function public.enviar_questionario_agora(uuid, uuid)      to authenticated;
grant execute on function public.marcar_checkin_enviado(uuid)               to authenticated;
grant execute on function public.responder_checkin(uuid, jsonb)             to authenticated;

-- A cada 15 minutos: os questionários que chegaram na data ficam pendentes.
select cron.schedule('pienel-gerar-checkins', '*/15 * * * *', $$select public.gerar_checkins()$$);

commit;
