-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: pausa da matrícula (viagem, doença, ausência por um tempo).
--
-- Decisões de 21/10/2026:
-- • Só o personal registra a pausa (o aluno combina com ele por fora).
-- • Em cada pausa o personal escolhe: com ou sem desconto. Com desconto, a mensalidade
--   fica proporcional (valor do mês ÷ 30 × dias), até um limite de dias com desconto
--   por aluno por ano, ajustável em Regras (padrão: 14). Passou do limite, os dias a
--   mais ficam sem desconto. O desconto entra na próxima mensalidade em aberto (ou na
--   próxima a ser gerada).
-- • As aulas fixas do período ficam "em pausa": o horário fica LIVRE para reposição
--   ou aula avulsa de outros alunos, mas aparece na agenda do personal, colorido, como
--   exceção (horário de quem pausou).
-- • Cancelar a pausa devolve as aulas futuras (as que não foram ocupadas) e o desconto
--   (se a mensalidade ainda não foi paga).
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261022100000_alunos_sem_conta.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Aula em pausa: não ocupa o horário (fica fora da regra "um aluno por horário").
alter table public.aulas drop constraint aulas_situacao_check;
alter table public.aulas add constraint aulas_situacao_check
  check (situacao in ('agendada', 'confirmada', 'realizada', 'falta', 'cancelada_com_aviso',
                      'cancelada_em_cima', 'remarcada', 'pendente', 'recusada', 'pausada'));

alter table public.personais
  add column pausa_dias_ano integer not null default 14 check (pausa_dias_ano between 0 and 90);

comment on column public.personais.pausa_dias_ano is
  'Máximo de dias de pausa COM desconto por aluno, por ano.';

alter table public.cobrancas
  add column desconto_centavos integer not null default 0 check (desconto_centavos >= 0);

comment on column public.cobrancas.desconto_centavos is
  'Desconto já abatido do valor (pausas com desconto).';

create table public.pausas (
  id                  uuid primary key default gen_random_uuid(),
  personal_id         uuid not null references public.personais (id) on delete cascade,
  vinculo_id          uuid not null references public.vinculos (id) on delete cascade,
  matricula_id        uuid not null references public.matriculas (id) on delete cascade,
  inicio              date not null,
  fim                 date not null,
  motivo              text check (motivo is null or char_length(motivo) <= 120),
  com_desconto        boolean not null,
  dias_com_desconto   integer not null default 0,
  desconto_centavos   integer not null default 0,
  -- Mensalidade em que o desconto entrou (nula enquanto espera a próxima ser gerada).
  cobranca_id         uuid references public.cobrancas (id) on delete set null,
  desconto_aplicado   boolean not null default false,
  criada_em           timestamptz not null default now(),
  cancelada_em        timestamptz,
  check (fim >= inicio and fim - inicio <= 180)
);

comment on table public.pausas is
  'Pausas da matrícula: as aulas fixas do período saem (horário livre) e, com desconto, a mensalidade fica proporcional.';

create index pausas_por_matricula on public.pausas (matricula_id, inicio);

alter table public.pausas enable row level security;
create policy "personal vê as pausas dos seus alunos" on public.pausas
  for select to authenticated using ((select auth.uid()) = personal_id);

-- ─── Aulas geradas dentro de uma pausa já nascem "em pausa" ────────────────
create or replace function public.aulas_em_pausa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origem = 'fixa' and new.situacao = 'agendada' and new.matricula_id is not null
     and exists (select 1 from public.pausas p
                  where p.matricula_id = new.matricula_id and p.cancelada_em is null
                    and (new.inicio at time zone 'America/Sao_Paulo')::date between p.inicio and p.fim) then
    new.situacao := 'pausada';
  end if;
  return new;
end
$$;

create trigger aulas_em_pausa
  before insert on public.aulas
  for each row execute function public.aulas_em_pausa();

-- ─── Mensalidade nova recebe os descontos de pausa que estavam esperando ───
create or replace function public.cobrancas_desconto_de_pausa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desconto integer;
begin
  if new.tipo <> 'mensalidade' or new.matricula_id is null then
    return new;
  end if;
  select coalesce(sum(desconto_centavos), 0) into v_desconto
    from public.pausas
   where matricula_id = new.matricula_id and cancelada_em is null
     and not desconto_aplicado and desconto_centavos > 0;
  if v_desconto > 0 then
    v_desconto := least(v_desconto, new.valor_centavos - 1);
    new.valor_centavos := new.valor_centavos - v_desconto;
    new.desconto_centavos := new.desconto_centavos + v_desconto;
  end if;
  return new;
end
$$;

create trigger cobrancas_desconto_de_pausa
  before insert on public.cobrancas
  for each row execute function public.cobrancas_desconto_de_pausa();

-- Depois de criada, marca as pausas como aplicadas nessa mensalidade.
create or replace function public.cobrancas_marcar_pausas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'mensalidade' and new.matricula_id is not null and new.desconto_centavos > 0 then
    update public.pausas
       set desconto_aplicado = true, cobranca_id = new.id
     where matricula_id = new.matricula_id and cancelada_em is null
       and not desconto_aplicado and desconto_centavos > 0;
  end if;
  return new;
end
$$;

create trigger cobrancas_marcar_pausas
  after insert on public.cobrancas
  for each row execute function public.cobrancas_marcar_pausas();

-- ─── Registrar e cancelar ──────────────────────────────────────────────────

create or replace function public.registrar_pausa(
  p_vinculo uuid, p_inicio date, p_fim date, p_com_desconto boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          public.matriculas;
  v_limite   integer;
  v_usados   integer;
  v_dias     integer;
  v_desc_d   integer := 0;
  v_desc     integer := 0;
  v_aulas    integer;
  v_cob      public.cobrancas;
  v_id       uuid;
begin
  select * into m from public.matriculas
   where vinculo_id = p_vinculo and personal_id = auth.uid() and situacao = 'ativa';
  if not found then
    raise exception 'Este aluno não tem matrícula ativa.';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Confira as datas da pausa.';
  end if;
  if p_inicio < public.hoje_brasilia() then
    raise exception 'A pausa começa hoje ou depois.';
  end if;
  if p_fim - p_inicio > 180 then
    raise exception 'A pausa pode ter no máximo 6 meses.';
  end if;
  if exists (select 1 from public.pausas where matricula_id = m.id and cancelada_em is null
                and daterange(inicio, fim, '[]') && daterange(p_inicio, p_fim, '[]')) then
    raise exception 'Já existe uma pausa nessas datas.';
  end if;

  v_dias := p_fim - p_inicio + 1;
  if coalesce(p_com_desconto, false) and m.valor_centavos is not null then
    select pausa_dias_ano into v_limite from public.personais where id = m.personal_id;
    select coalesce(sum(dias_com_desconto), 0) into v_usados
      from public.pausas
     where vinculo_id = p_vinculo and cancelada_em is null
       and extract(year from inicio) = extract(year from p_inicio);
    v_desc_d := greatest(0, least(v_dias, v_limite - v_usados));
    v_desc := round(m.valor_centavos::numeric / m.ciclo_meses * v_desc_d / 30)::integer;
  end if;

  insert into public.pausas
    (personal_id, vinculo_id, matricula_id, inicio, fim, motivo, com_desconto, dias_com_desconto, desconto_centavos)
  values
    (m.personal_id, p_vinculo, m.id, p_inicio, p_fim, nullif(left(btrim(coalesce(p_motivo, '')), 120), ''),
     coalesce(p_com_desconto, false), v_desc_d, v_desc)
  returning id into v_id;

  -- Aulas fixas do período: em pausa (o horário fica livre).
  update public.aulas
     set situacao = 'pausada'
   where matricula_id = m.id and origem = 'fixa' and situacao in ('agendada', 'confirmada')
     and inicio > now()
     and (inicio at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  get diagnostics v_aulas = row_count;

  -- Desconto: na próxima mensalidade em aberto que cobre a pausa (ou espera a próxima).
  if v_desc > 0 then
    select * into v_cob from public.cobrancas
     where matricula_id = m.id and tipo = 'mensalidade' and situacao = 'aberta'
       and coalesce(periodo_fim, vencimento) >= p_inicio
     order by vencimento limit 1;
    if found then
      v_desc := least(v_desc, v_cob.valor_centavos - 1);
      update public.cobrancas
         set valor_centavos = valor_centavos - v_desc,
             desconto_centavos = desconto_centavos + v_desc,
             atualizada_em = now()
       where id = v_cob.id;
      update public.pausas set desconto_centavos = v_desc, desconto_aplicado = true, cobranca_id = v_cob.id
       where id = v_id;
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'aulas', v_aulas, 'dias', v_dias,
                            'dias_com_desconto', v_desc_d, 'desconto_centavos', v_desc);
end
$$;

create or replace function public.cancelar_pausa(p_pausa uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p          public.pausas;
  a          record;
  v_voltaram integer := 0;
  v_ficaram  integer := 0;
  v_devolvido boolean := false;
begin
  select * into p from public.pausas
   where id = p_pausa and personal_id = auth.uid() and cancelada_em is null for update;
  if not found then
    raise exception 'Pausa não encontrada.';
  end if;

  update public.pausas set cancelada_em = now() where id = p.id;

  -- Aulas futuras voltam, se o horário não foi ocupado por outro aluno.
  for a in
    select id from public.aulas
     where matricula_id = p.matricula_id and situacao = 'pausada' and inicio > now()
       and (inicio at time zone 'America/Sao_Paulo')::date between p.inicio and p.fim
  loop
    begin
      update public.aulas set situacao = 'agendada' where id = a.id;
      v_voltaram := v_voltaram + 1;
    exception when exclusion_violation then
      v_ficaram := v_ficaram + 1;
    end;
  end loop;

  -- Desconto volta para a mensalidade, se ela ainda não foi paga.
  if p.desconto_aplicado and p.cobranca_id is not null then
    update public.cobrancas
       set valor_centavos = valor_centavos + p.desconto_centavos,
           desconto_centavos = greatest(0, desconto_centavos - p.desconto_centavos),
           atualizada_em = now()
     where id = p.cobranca_id and situacao = 'aberta';
    v_devolvido := found;
  end if;

  return jsonb_build_object('voltaram', v_voltaram, 'ocupadas', v_ficaram,
                            'desconto_devolvido', v_devolvido,
                            'desconto_ja_usado', p.desconto_aplicado and not v_devolvido and p.desconto_centavos > 0);
end
$$;

create or replace function public.salvar_limite_pausa(p_dias integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_dias is null or p_dias not between 0 and 90 then
    raise exception 'O limite de pausa vai de 0 a 90 dias por ano.';
  end if;
  update public.personais set pausa_dias_ano = p_dias where id = auth.uid();
  if not found then
    raise exception 'Só personais podem mudar as regras.';
  end if;
end
$$;

-- ─── Encerrar e alterar a matrícula também levam as aulas em pausa ─────────
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
   where matricula_id = p_matricula and situacao in ('agendada', 'pausada') and inicio > now();
end
$$;

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
  if v_intervalo not between 1 and 8 or v_ciclo not in (1, 3, 6, 12) then
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

  -- Valor: presencial e híbrido pelas aulas presenciais do mês (aula × vezes × 4 ÷ N
  -- semanas), vezes os meses do plano; online pelo plano online (total do período);
  -- ou o valor digitado (fora do padrão).
  if v_fora then
    v_valor := (p_dados ->> 'valor_centavos')::integer;
  elsif v_mod in ('presencial', 'hibrido') then
    select round(p.valor_aula_centavos * v_n * 4 / v_intervalo::numeric)::integer * v_ciclo into v_valor
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

    -- Refaz todas as aulas futuras que ainda estão só agendadas; as novas começam em
    -- v_desde (nas aulas a cada N semanas, a data escolhida para recomeçar o ciclo).
    delete from public.aulas
     where matricula_id = v_id and situacao in ('agendada', 'pausada') and inicio > now();

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

revoke all on function public.aulas_em_pausa()                    from public, anon, authenticated;
revoke all on function public.cobrancas_desconto_de_pausa()       from public, anon, authenticated;
revoke all on function public.cobrancas_marcar_pausas()           from public, anon, authenticated;
revoke all on function public.registrar_pausa(uuid, date, date, boolean, text) from public, anon;
revoke all on function public.cancelar_pausa(uuid)                from public, anon;
revoke all on function public.salvar_limite_pausa(integer)        from public, anon;
grant execute on function public.registrar_pausa(uuid, date, date, boolean, text) to authenticated;
grant execute on function public.cancelar_pausa(uuid)                to authenticated;
grant execute on function public.salvar_limite_pausa(integer)        to authenticated;

commit;
