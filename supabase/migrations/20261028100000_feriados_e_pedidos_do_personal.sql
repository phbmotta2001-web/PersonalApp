-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: feriados, pedido de remarcação feito pelo personal e primeiro acesso.
--
-- Decisões de 28/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Feriados nacionais + Carnaval (seg e ter) e Corpus Christi aparecem na agenda.
-- • O personal escolhe "trabalho em feriados" ou "não trabalho", com exceções por feriado.
--   Não trabalha: o dia fica bloqueado (bloqueio com o nome do feriado) e as aulas fixas
--   que caem nele são canceladas sozinhas, com uma reposição para o aluno (sem notificação
--   de "cancelou sua aula": é feriado).
-- • O personal pode PEDIR para remarcar (o aluno aceita ou recusa) ou remarcar direto
--   ("já combinamos"). Recusado ou sem resposta, a aula fica no horário original e o
--   personal é avisado, com a escolha de cancelar ou manter.
-- • Cancelar continua sendo um aviso: o aluno ganha a reposição e é notificado.
-- • Primeiro acesso: o personal configura tudo de uma vez (personais.configurado_em).
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261022180000_desconto_da_pausa.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Colunas novas ─────────────────────────────────────────────────────────
alter table public.personais
  add column trabalha_em_feriados boolean not null default true,
  add column configurado_em       timestamptz;

comment on column public.personais.trabalha_em_feriados is
  'Regra geral dos feriados; as exceções ficam em feriados_excecoes.';
comment on column public.personais.configurado_em is
  'Quando o personal terminou o primeiro acesso (horários, feriados, regras e valores).';

-- Quem já usa o Pienel e já configurou os horários não passa pelo primeiro acesso.
update public.personais p set configurado_em = now()
 where exists (select 1 from public.horarios_trabalho h where h.personal_id = p.id);

alter table public.aulas
  add column por_feriado            boolean not null default false,
  add column recusa_remarcacao_em   timestamptz;

comment on column public.aulas.por_feriado is
  'Aula fixa cancelada sozinha porque caiu num feriado em que o personal não trabalha.';
comment on column public.aulas.recusa_remarcacao_em is
  'O aluno recusou (ou deixou expirar) o pedido do personal para remarcar esta aula: falta o personal decidir entre cancelar e manter.';

alter table public.bloqueios
  add column feriado text check (feriado is null or char_length(feriado) <= 60);

comment on column public.bloqueios.feriado is
  'Bloqueio criado pelo Pienel para um feriado em que o personal não trabalha (nome do feriado).';

-- Feriados em que o personal faz o contrário da regra geral.
create table public.feriados_excecoes (
  personal_id uuid not null references public.personais (id) on delete cascade,
  data        date not null,
  primary key (personal_id, data)
);

comment on table public.feriados_excecoes is
  'Feriados em que o personal faz o contrário da regra geral (trabalha quando não trabalha em feriados, ou o inverso).';

alter table public.feriados_excecoes enable row level security;
create policy "personal vê as próprias exceções de feriado" on public.feriados_excecoes
  for select to authenticated using (personal_id = (select auth.uid()));

-- ─── Avisos: o pedido do personal expirou ─────────────────────────────────
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('cancelou_com_reposicao', 'cancelou_em_cima', 'marcou_reposicao', 'remarcou',
                  'pediu_reposicao', 'pediu_remarcacao', 'aceitou_sugestao', 'recusou_sugestao',
                  'avisou_pagamento', 'respondeu_checkin', 'sugestao_expirou'));

-- ─── Feriados ──────────────────────────────────────────────────────────────
-- Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
create or replace function public.pascoa(p_ano integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  a integer := p_ano % 19;
  b integer := p_ano / 100;
  c integer := p_ano % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end
$$;

-- Feriados nacionais + Carnaval e Corpus Christi (a mesma lista de src/lib/feriados.ts).
create or replace function public.feriados_do_ano(p_ano integer)
returns table (data date, nome text)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    (make_date(p_ano, 1, 1),            'Confraternização Universal'),
    (public.pascoa(p_ano) - 48,         'Carnaval'),
    (public.pascoa(p_ano) - 47,         'Carnaval'),
    (public.pascoa(p_ano) - 2,          'Sexta-feira Santa'),
    (make_date(p_ano, 4, 21),           'Tiradentes'),
    (make_date(p_ano, 5, 1),            'Dia do Trabalho'),
    (public.pascoa(p_ano) + 60,         'Corpus Christi'),
    (make_date(p_ano, 9, 7),            'Independência do Brasil'),
    (make_date(p_ano, 10, 12),          'Nossa Senhora Aparecida'),
    (make_date(p_ano, 11, 2),           'Finados'),
    (make_date(p_ano, 11, 15),          'Proclamação da República'),
    (make_date(p_ano, 11, 20),          'Consciência Negra'),
    (make_date(p_ano, 12, 25),          'Natal')
  ) as f(data, nome)
$$;

-- Feriados entre duas datas.
create or replace function public.feriados_entre(p_de date, p_ate date)
returns table (data date, nome text)
language sql
immutable
set search_path = ''
as $$
  select f.data, f.nome
    from generate_series(extract(year from p_de)::int, extract(year from p_ate)::int) as y(ano)
    cross join lateral public.feriados_do_ano(y.ano) f
   where f.data between p_de and p_ate
$$;

-- Nome do feriado em que o personal NÃO trabalha nessa data (null: dia normal).
create or replace function public.feriado_de_folga(p_personal uuid, p_data date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.nome
    from public.feriados_do_ano(extract(year from p_data)::int) f
    join public.personais p on p.id = p_personal
   where f.data = p_data
     and (p.trabalha_em_feriados = exists (
           select 1 from public.feriados_excecoes e where e.personal_id = p_personal and e.data = p_data))
   limit 1
$$;

-- Aula fixa que cai num feriado de folga: cancelada, com reposição para o aluno.
create or replace function public.cancelar_por_feriado(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas where id = p_aula and situacao in ('agendada', 'confirmada') for update;
  if not found then
    return;
  end if;
  update public.aulas
     set situacao = 'cancelada_com_aviso', cancelada_por = 'personal', por_feriado = true,
         recusa_remarcacao_em = null, atualizada_em = now()
   where id = a.id;
  if a.vinculo_id is not null and not exists (select 1 from public.creditos_reposicao where aula_origem_id = a.id) then
    insert into public.creditos_reposicao (personal_id, vinculo_id, aluno_id, aula_origem_id, valido_ate)
    values (a.personal_id, a.vinculo_id, a.aluno_id, a.id,
            public.validade_da_reposicao(a.vinculo_id, (a.inicio at time zone 'America/Sao_Paulo')::date));
  end if;
end
$$;

-- Deixa bloqueios e aulas de acordo com a regra de feriados do personal (próximos ~13 meses).
create or replace function public.sincronizar_feriados(p_personal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := public.hoje_brasilia();
  v_ate  date := public.hoje_brasilia() + 400;
  r      record;
begin
  -- 1. Bloqueios de feriado que não valem mais (passou a trabalhar).
  delete from public.bloqueios b
   where b.personal_id = p_personal and b.feriado is not null
     and (b.inicio at time zone 'America/Sao_Paulo')::date >= v_hoje
     and public.feriado_de_folga(p_personal, (b.inicio at time zone 'America/Sao_Paulo')::date) is null;

  -- 2. Bloqueios dos feriados de folga que ainda não existem.
  insert into public.bloqueios (personal_id, inicio, fim, dia_inteiro, motivo, feriado)
  select p_personal, public.instante_brasilia(f.data, 0), public.instante_brasilia(f.data + 1, 0), true,
         'Feriado: ' || f.nome, f.nome
    from public.feriados_entre(v_hoje, v_ate) f
   where public.feriado_de_folga(p_personal, f.data) is not null
     and not exists (
       select 1 from public.bloqueios b
        where b.personal_id = p_personal and b.feriado is not null
          and (b.inicio at time zone 'America/Sao_Paulo')::date = f.data);

  -- 3. Aulas fixas marcadas em feriado de folga: canceladas com reposição.
  for r in
    select a.id from public.aulas a
     where a.personal_id = p_personal and a.origem = 'fixa' and a.situacao in ('agendada', 'confirmada')
       and a.inicio > now()
       and public.feriado_de_folga(p_personal, (a.inicio at time zone 'America/Sao_Paulo')::date) is not null
  loop
    perform public.cancelar_por_feriado(r.id);
  end loop;

  -- 4. Feriado que voltou a ser dia de trabalho: a aula volta (se a reposição não foi usada).
  for r in
    select a.id from public.aulas a
      left join public.creditos_reposicao c on c.aula_origem_id = a.id
     where a.personal_id = p_personal and a.por_feriado and a.situacao = 'cancelada_com_aviso'
       and a.inicio > now() and c.usado_em_aula_id is null
       and public.feriado_de_folga(p_personal, (a.inicio at time zone 'America/Sao_Paulo')::date) is null
  loop
    begin
      update public.aulas
         set situacao = 'agendada', cancelada_por = null, por_feriado = false, atualizada_em = now()
       where id = r.id;
      delete from public.creditos_reposicao where aula_origem_id = r.id;
    exception when exclusion_violation then
      null; -- O horário foi ocupado por outra aula: fica cancelada, com a reposição.
    end;
  end loop;
end
$$;

create or replace function public.sincronizar_feriados_de_todos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.personais loop
    perform public.sincronizar_feriados(r.id);
  end loop;
end
$$;

-- Aula fixa nova (ou que volta de uma pausa) num feriado de folga: cancela na hora.
create or replace function public.aulas_no_feriado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origem = 'fixa' and new.situacao = 'agendada' and new.inicio > now()
     and (tg_op = 'INSERT' or old.situacao = 'pausada')
     and public.feriado_de_folga(new.personal_id, (new.inicio at time zone 'America/Sao_Paulo')::date) is not null then
    perform public.cancelar_por_feriado(new.id);
  end if;
  return null;
end
$$;

create trigger aulas_no_feriado
  after insert or update of situacao on public.aulas
  for each row execute function public.aulas_no_feriado();

-- Personal: salvar a regra dos feriados. p_excecoes: feriados em que faz o contrário da regra.
create or replace function public.salvar_feriados(p_trabalha boolean, p_excecoes date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só personais têm regras de feriados.';
  end if;
  if p_trabalha is null then
    raise exception 'Escolha se você trabalha em feriados.';
  end if;
  update public.personais set trabalha_em_feriados = p_trabalha where id = auth.uid();
  delete from public.feriados_excecoes where personal_id = auth.uid();
  insert into public.feriados_excecoes (personal_id, data)
  select distinct auth.uid(), d from unnest(coalesce(p_excecoes, '{}')) as d
   where exists (select 1 from public.feriados_do_ano(extract(year from d)::int) f where f.data = d);
  perform public.sincronizar_feriados(auth.uid());
end
$$;

-- ─── Personal: pedir para remarcar (o aluno aceita ou recusa) ─────────────
create or replace function public.pedir_remarcacao(p_aula uuid, p_data date, p_inicio_min integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas;
  v_ini  timestamptz;
  v_nova uuid;
begin
  select * into a from public.aulas where id = p_aula and personal_id = auth.uid() for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if a.situacao not in ('agendada', 'confirmada') or a.inicio <= now() then
    raise exception 'Só dá para pedir a remarcação de uma aula que ainda vai acontecer.';
  end if;
  if a.aluno_id is null then
    raise exception 'Este aluno não usa o app: remarque direto.';
  end if;
  if exists (select 1 from public.aulas where aula_original_id = a.id and situacao = 'pendente') then
    raise exception 'Já existe um pedido para remarcar esta aula. Aguarde a resposta do aluno.';
  end if;
  if p_inicio_min is null or p_inicio_min < 0 or p_inicio_min % 15 <> 0
     or p_inicio_min * interval '1 minute' + (a.fim - a.inicio) > interval '24 hours' then
    raise exception 'Escolha um horário válido.';
  end if;
  v_ini := public.instante_brasilia(p_data, p_inicio_min);
  if public.pedido_expirado(v_ini) then
    raise exception 'Peça um horário com pelo menos 2 horas de antecedência.';
  end if;

  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, nome_avulso,
                              aula_original_id, situacao, proposta_por)
    values (a.personal_id, a.aluno_id, a.vinculo_id, v_ini, v_ini + (a.fim - a.inicio), a.local, a.origem,
            a.nome_avulso, a.id, 'pendente', 'personal')
    returning id into v_nova;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado por outra aula.';
  end;
  update public.aulas set recusa_remarcacao_em = null where id = a.id;
  return v_nova;
end
$$;

-- Personal: desistir do pedido de remarcação ainda sem resposta.
create or replace function public.desistir_remarcacao(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.aulas
                  where id = p_aula and personal_id = auth.uid() and situacao = 'pendente' and proposta_por = 'personal') then
    raise exception 'Pedido não encontrado: talvez o aluno já tenha respondido.';
  end if;
  update public.creditos_reposicao set usado_em_aula_id = null where usado_em_aula_id = p_aula;
  delete from public.aulas where id = p_aula;
end
$$;

-- Personal: o aluno recusou a remarcação e o personal decidiu manter a aula.
create or replace function public.manter_aula(p_aula uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.aulas set recusa_remarcacao_em = null where id = p_aula and personal_id = auth.uid();
$$;

-- Aluno: responder ao pedido/sugestão do personal. Recusado, a aula original fica
-- marcada e o personal decide entre cancelar e manter.
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
    if a.aula_original_id is not null then
      update public.aulas set recusa_remarcacao_em = now()
       where id = a.aula_original_id and situacao in ('agendada', 'confirmada');
    end if;
  end if;
  insert into public.avisos (personal_id, vinculo_id, tipo, aula_id, aula_nova_id)
  values (a.personal_id, a.vinculo_id, case when p_aceitar then 'aceitou_sugestao' else 'recusou_sugestao' end,
          a.aula_original_id, a.id);
end
$$;

-- Robô: pedidos sem resposta expiram 2 h antes. Se o pedido era do personal, ele é avisado.
create or replace function public.expirar_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id, personal_id, vinculo_id, proposta_por, aula_original_id
             from public.aulas where situacao = 'pendente' and public.pedido_expirado(inicio) loop
    perform public.recusar_pedido(r.id, 'Expirou sem resposta.');
    if r.proposta_por = 'personal' then
      if r.aula_original_id is not null then
        update public.aulas set recusa_remarcacao_em = now()
         where id = r.aula_original_id and situacao in ('agendada', 'confirmada') and inicio > now();
      end if;
      insert into public.avisos (personal_id, vinculo_id, tipo, aula_id, aula_nova_id)
      values (r.personal_id, r.vinculo_id, 'sugestao_expirou', r.aula_original_id, r.id);
    end if;
  end loop;
end
$$;

-- ─── Notificações ──────────────────────────────────────────────────────────
-- Personal: recusa ou falta de resposta leva direto para a aula (cancelar ou manter).
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
    when 'aceitou_sugestao'       then titulo := nome || ' aceitou o novo horário'; corpo := quando;
    when 'recusou_sugestao'       then
      titulo := nome || ' não aceitou remarcar';
      if new.aula_id is not null then
        select 'A aula de ' || public.texto_da_aula_push(inicio) || ' continua marcada. Toque para cancelar ou manter.'
          into corpo from public.aulas where id = new.aula_id;
        url := '/agenda/aula/' || new.aula_id;
      else
        corpo := quando;
      end if;
    when 'sugestao_expirou'       then
      titulo := nome || ' não respondeu o pedido para remarcar';
      if new.aula_id is not null then
        select 'A aula de ' || public.texto_da_aula_push(inicio) || ' continua marcada. Toque para cancelar ou manter.'
          into corpo from public.aulas where id = new.aula_id;
        url := '/agenda/aula/' || new.aula_id;
      else
        corpo := 'O horário que você sugeriu ficou livre de novo.';
      end if;
    when 'avisou_pagamento'       then titulo := nome || ' avisou que pagou'; corpo := 'Confira no banco e confirme no Pienel.'; url := '/agenda/cobrancas';
    when 'respondeu_checkin'      then titulo := nome || ' respondeu o questionário'; corpo := 'Toque para ver as respostas.'; url := '/agenda/online/' || new.vinculo_id;
    else return new;
  end case;
  perform public.notificar(new.personal_id, 'aviso_' || new.tipo, titulo, btrim(coalesce(corpo, '')), url,
                           p_chave => 'aviso:' || new.id);
  return new;
end
$$;

-- Aluno: pedido de remarcação do personal com texto próprio; cancelamento por feriado sem notificação.
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
  original text;
begin
  if new.aluno_id is null or new.vinculo_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.situacao = 'pendente' and new.proposta_por = 'personal' then
      if new.aula_original_id is not null then
        select public.texto_da_aula_push(inicio) into original from public.aulas where id = new.aula_original_id;
        perform public.notificar(new.aluno_id, 'sugestao', personal || ' pediu para remarcar sua aula',
          coalesce('De ' || original || ' para ', 'Para ') || quando || '. Toque para aceitar ou recusar.', url,
          p_chave => 'sugestao:' || new.id, p_aula => new.id);
      else
        perform public.notificar(new.aluno_id, 'sugestao', personal || ' sugeriu outro horário',
          'Aula de ' || quando || '. Toque para aceitar ou recusar.', url,
          p_chave => 'sugestao:' || new.id, p_aula => new.id);
      end if;
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

  -- Aula cancelada pelo personal (o feriado não notifica: a reposição aparece no app).
  if old.situacao in ('agendada', 'confirmada')
     and new.situacao in ('cancelada_com_aviso', 'cancelada_em_cima')
     and new.cancelada_por = 'personal' and not new.por_feriado and new.inicio > now() then
    perform public.notificar(new.aluno_id, 'aula_cancelada', personal || ' cancelou sua aula',
      'Aula de ' || quando || '. Você ganhou uma reposição.', url, p_chave => 'cancelada:' || new.id);
  end if;
  return new;
end
$$;

-- ─── Primeiro acesso ───────────────────────────────────────────────────────
create or replace function public.concluir_configuracao()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.horarios_trabalho where personal_id = auth.uid()) then
    raise exception 'Configure seus horários de trabalho antes de continuar.';
  end if;
  update public.personais set configurado_em = coalesce(configurado_em, now()) where id = auth.uid();
end
$$;

-- ─── Permissões ────────────────────────────────────────────────────────────
revoke all on function public.pascoa(integer)                          from public, anon;
revoke all on function public.feriados_do_ano(integer)                 from public, anon;
revoke all on function public.feriados_entre(date, date)               from public, anon;
revoke all on function public.feriado_de_folga(uuid, date)             from public, anon, authenticated;
revoke all on function public.cancelar_por_feriado(uuid)               from public, anon, authenticated;
revoke all on function public.sincronizar_feriados(uuid)               from public, anon, authenticated;
revoke all on function public.sincronizar_feriados_de_todos()          from public, anon, authenticated;
revoke all on function public.aulas_no_feriado()                       from public, anon, authenticated;
revoke all on function public.salvar_feriados(boolean, date[])         from public, anon;
revoke all on function public.pedir_remarcacao(uuid, date, integer)    from public, anon;
revoke all on function public.desistir_remarcacao(uuid)                from public, anon;
revoke all on function public.manter_aula(uuid)                        from public, anon;
revoke all on function public.concluir_configuracao()                  from public, anon;
revoke all on function public.expirar_pedidos()                        from public, anon, authenticated;

grant execute on function public.pascoa(integer)                      to authenticated;
grant execute on function public.feriados_do_ano(integer)             to authenticated;
grant execute on function public.feriados_entre(date, date)           to authenticated;
grant execute on function public.salvar_feriados(boolean, date[])      to authenticated;
grant execute on function public.pedir_remarcacao(uuid, date, integer) to authenticated;
grant execute on function public.desistir_remarcacao(uuid)             to authenticated;
grant execute on function public.manter_aula(uuid)                     to authenticated;
grant execute on function public.concluir_configuracao()               to authenticated;

-- Todo dia 1º: estende os bloqueios de feriado para os próximos meses.
select cron.schedule('pienel-feriados', '30 3 1 * *', $$select public.sincronizar_feriados_de_todos()$$);

-- Para quem já usa: nada muda (a regra geral começa como "trabalho em feriados").
select public.sincronizar_feriados_de_todos();

commit;
