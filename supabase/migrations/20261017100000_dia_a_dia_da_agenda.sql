-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 5): o dia a dia da agenda.
--
-- Decisões de 16/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Aula que passou sem marcação conta como DADA (o personal só marca exceções).
-- • Falta sem aviso conta como dada, sem reposição.
-- • Aluno que cancela com a antecedência mínima ganha uma reposição; em cima da hora,
--   a aula conta como dada. Se o PERSONAL cancela, o aluno sempre ganha reposição.
-- • Antecedência mínima padrão: 12 horas, ajustável pelo personal.
-- • A reposição vale até o vencimento da mensalidade atual (sem vencimento: 30 dias).
-- • Remarcar: a aula original fica "remarcada" e a nova entra ligada a ela.
-- • Aula avulsa, de reposição (usa uma reposição) ou experimental (só com o nome).
-- • Histórico de peso, altura, outras medidas e objetivo, com a data de cada mudança.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261016140000_tabela_de_valores.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Regras do personal ───────────────────────────────────────────────────
alter table public.personais
  add column antecedencia_cancelamento_h integer not null default 12
    check (antecedencia_cancelamento_h between 0 and 168);

comment on column public.personais.antecedencia_cancelamento_h is
  'Quantas horas antes o aluno precisa cancelar para ganhar reposição.';

create or replace function public.salvar_regras(p_antecedencia_h integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_antecedencia_h is null or p_antecedencia_h not between 0 and 168 then
    raise exception 'Escolha uma antecedência de 0 a 168 horas.';
  end if;
  update public.personais set antecedencia_cancelamento_h = p_antecedencia_h where id = auth.uid();
  if not found then
    raise exception 'Só personais podem definir regras.';
  end if;
end
$$;

-- ─── Aulas: o que aconteceu com cada uma ──────────────────────────────────
alter table public.aulas
  add column cancelada_por    text check (cancelada_por in ('aluno', 'personal')),
  add column aula_original_id uuid references public.aulas (id) on delete set null,
  add column nome_avulso      text check (nome_avulso is null or char_length(btrim(nome_avulso)) between 2 and 80),
  add column atualizada_em    timestamptz not null default now();

comment on column public.aulas.nome_avulso is
  'Nome de quem faz aula experimental sem ser aluno do personal.';
comment on column public.aulas.aula_original_id is
  'Aula que foi remarcada para esta.';

-- ─── Reposições ───────────────────────────────────────────────────────────
create table public.creditos_reposicao (
  id                uuid primary key default gen_random_uuid(),
  personal_id       uuid not null references public.personais (id) on delete cascade,
  vinculo_id        uuid not null references public.vinculos (id) on delete cascade,
  aluno_id          uuid references public.alunos (id) on delete set null,
  -- Aula cancelada que gerou a reposição (uma reposição por aula).
  aula_origem_id    uuid not null unique references public.aulas (id) on delete cascade,
  valido_ate        date not null,
  usado_em_aula_id  uuid references public.aulas (id) on delete set null,
  criado_em         timestamptz not null default now()
);

comment on table public.creditos_reposicao is
  'Reposição que o aluno ganhou ao cancelar com antecedência (ou quando o personal cancelou).';

create index creditos_por_vinculo on public.creditos_reposicao (vinculo_id, valido_ate);

-- Primeira data DEPOIS de p_desde que cai no dia p_dia (ou no último dia do mês curto).
create or replace function public.proxima_data_no_dia(p_desde date, p_dia integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select min(d)
    from (
      select make_date(extract(year from m)::int, extract(month from m)::int,
                       least(p_dia, extract(day from (m + interval '1 month' - interval '1 day'))::int)) as d
        from (select (date_trunc('month', p_desde) + make_interval(months => i))::date as m
                from generate_series(0, 2) as i) meses
    ) datas
   where d > p_desde
$$;

-- Validade da reposição: até o vencimento da mensalidade atual (sem vencimento: 30 dias).
create or replace function public.validade_da_reposicao(p_vinculo uuid, p_data_aula date)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select public.proxima_data_no_dia(p_data_aula, m.dia_vencimento)
       from public.matriculas m
      where m.vinculo_id = p_vinculo and m.situacao = 'ativa' and m.dia_vencimento is not null),
    p_data_aula + 30)
$$;

-- ─── Personal: marcar o que aconteceu com a aula ──────────────────────────
-- p_situacao: 'agendada' (desfazer), 'realizada', 'falta', 'cancelada_com_aviso',
-- 'cancelada_em_cima'. p_cancelada_por: 'aluno' ou 'personal' (só nos cancelamentos).
create or replace function public.marcar_aula(p_aula uuid, p_situacao text, p_cancelada_por text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        public.aulas;
  v_credito public.creditos_reposicao;
  cancelou boolean := p_situacao in ('cancelada_com_aviso', 'cancelada_em_cima');
begin
  select * into a from public.aulas where id = p_aula and personal_id = auth.uid() for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if p_situacao not in ('agendada', 'realizada', 'falta', 'cancelada_com_aviso', 'cancelada_em_cima') then
    raise exception 'Situação de aula inválida.';
  end if;
  if a.situacao = 'remarcada' then
    raise exception 'Esta aula foi remarcada: mexa na aula nova.';
  end if;
  if p_situacao in ('realizada', 'falta') and a.inicio > now() then
    raise exception 'Só dá para marcar presença ou falta depois do horário da aula.';
  end if;
  if cancelou and coalesce(p_cancelada_por, '') not in ('aluno', 'personal') then
    raise exception 'Diga quem cancelou a aula.';
  end if;
  -- Cancelada pelo personal sempre dá reposição.
  if p_situacao = 'cancelada_em_cima' and p_cancelada_por = 'personal' then
    p_situacao := 'cancelada_com_aviso';
  end if;

  -- Saindo de "cancelada com aviso": a reposição gerada some (se ainda não foi usada).
  if a.situacao = 'cancelada_com_aviso' and p_situacao <> 'cancelada_com_aviso' then
    select * into v_credito from public.creditos_reposicao where aula_origem_id = a.id;
    if v_credito.usado_em_aula_id is not null then
      raise exception 'A reposição desta aula já foi usada: cancele a aula de reposição primeiro.';
    end if;
    delete from public.creditos_reposicao where aula_origem_id = a.id;
  end if;

  begin
    update public.aulas
       set situacao = p_situacao,
           cancelada_por = case when cancelou then p_cancelada_por end,
           atualizada_em = now()
     where id = a.id;
  exception when exclusion_violation then
    raise exception 'Esse horário já foi ocupado por outra aula.';
  end;

  if p_situacao = 'cancelada_com_aviso' and a.vinculo_id is not null
     and not exists (select 1 from public.creditos_reposicao where aula_origem_id = a.id) then
    insert into public.creditos_reposicao (personal_id, vinculo_id, aluno_id, aula_origem_id, valido_ate)
    values (a.personal_id, a.vinculo_id, a.aluno_id, a.id,
            public.validade_da_reposicao(a.vinculo_id, (a.inicio at time zone 'America/Sao_Paulo')::date));
  end if;
end
$$;

-- ─── Personal: remarcar uma aula ──────────────────────────────────────────
create or replace function public.remarcar_aula(p_aula uuid, p_data date, p_inicio_min integer)
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
  if a.situacao not in ('agendada', 'confirmada') then
    raise exception 'Só dá para remarcar uma aula que ainda está marcada.';
  end if;
  if p_inicio_min is null or p_inicio_min < 0 or p_inicio_min % 15 <> 0
     or p_inicio_min * interval '1 minute' + (a.fim - a.inicio) > interval '24 hours' then
    raise exception 'Escolha um horário válido.';
  end if;
  v_ini := public.instante_brasilia(p_data, p_inicio_min);
  if v_ini <= now() then
    raise exception 'Escolha um horário que ainda não passou.';
  end if;

  update public.aulas set situacao = 'remarcada', atualizada_em = now() where id = a.id;
  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, nome_avulso, aula_original_id)
    values (a.personal_id, a.aluno_id, a.vinculo_id, v_ini, v_ini + (a.fim - a.inicio), a.local, a.origem,
            a.nome_avulso, a.id)
    returning id into v_nova;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado por outra aula.';
  end;

  -- Se era uma aula de reposição, a reposição passa a valer para a aula nova.
  update public.creditos_reposicao set usado_em_aula_id = v_nova where usado_em_aula_id = a.id;
  return v_nova;
end
$$;

-- ─── Personal: aula avulsa, de reposição ou experimental ──────────────────
create or replace function public.criar_aula(
  p_vinculo     uuid,
  p_nome        text,
  p_origem      text,
  p_data        date,
  p_inicio_min  integer,
  p_duracao     integer,
  p_local       text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v         public.vinculos;
  v_ini     timestamptz;
  v_aula    uuid;
  v_credito uuid;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só personais podem marcar aulas.';
  end if;
  if p_origem not in ('avulsa', 'reposicao', 'experimental') then
    raise exception 'Tipo de aula inválido.';
  end if;
  if p_duracao not in (30, 45, 60, 90) then
    raise exception 'Escolha uma duração de aula de 30, 45, 60 ou 90 minutos.';
  end if;
  if p_inicio_min is null or p_inicio_min < 0 or p_inicio_min % 15 <> 0 or p_inicio_min + p_duracao > 1440 then
    raise exception 'Escolha um horário válido.';
  end if;
  if p_local is not null and char_length(p_local) > 80 then
    raise exception 'Use até 80 caracteres no local.';
  end if;

  if p_vinculo is not null then
    select * into v from public.vinculos
     where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
    if not found then
      raise exception 'Aluno não encontrado entre os seus alunos ativos.';
    end if;
  elsif p_origem <> 'experimental' then
    raise exception 'Escolha o aluno.';
  elsif char_length(btrim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Escreva o nome de quem vai fazer a aula experimental.';
  end if;

  v_ini := public.instante_brasilia(p_data, p_inicio_min);
  if v_ini <= now() then
    raise exception 'Escolha um horário que ainda não passou.';
  end if;

  if p_origem = 'reposicao' then
    select id into v_credito
      from public.creditos_reposicao
     where vinculo_id = p_vinculo and usado_em_aula_id is null and valido_ate >= p_data
     order by valido_ate
     limit 1
     for update;
    if v_credito is null then
      raise exception 'Este aluno não tem reposição válida para essa data.';
    end if;
  end if;

  begin
    insert into public.aulas (personal_id, aluno_id, vinculo_id, inicio, fim, local, origem, nome_avulso)
    values (auth.uid(), v.aluno_id, v.id, v_ini, v_ini + make_interval(mins => p_duracao),
            nullif(btrim(p_local), ''), p_origem,
            case when p_vinculo is null then btrim(p_nome) end)
    returning id into v_aula;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado por outra aula.';
  end;

  if v_credito is not null then
    update public.creditos_reposicao set usado_em_aula_id = v_aula where id = v_credito;
  end if;
  return v_aula;
end
$$;

-- Vínculo encerrado: além da matrícula, saem as aulas avulsas futuras.
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
    delete from public.aulas where vinculo_id = new.id and situacao = 'agendada' and inicio > now();
  end if;
  return new;
end
$$;

-- ─── Histórico de peso, altura, outras medidas e objetivo ─────────────────
create table public.historico_perfil (
  id             bigint generated always as identity primary key,
  aluno_id       uuid not null references public.alunos (id) on delete cascade,
  campo          text not null check (campo in ('peso_kg', 'altura_cm', 'outras_medidas', 'objetivo')),
  valor          text not null,
  registrado_em  timestamptz not null default now()
);

comment on table public.historico_perfil is
  'Cada valor informado de peso, altura, outras medidas e objetivo, com a data. Medidas são dados de saúde: somem se a autorização for retirada.';

create index historico_perfil_por_aluno on public.historico_perfil (aluno_id, campo, registrado_em desc);

create or replace function public.saude_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.peso_kg is not null and (tg_op = 'INSERT' or new.peso_kg is distinct from old.peso_kg) then
    insert into public.historico_perfil (aluno_id, campo, valor) values (new.aluno_id, 'peso_kg', new.peso_kg::text);
  end if;
  if new.altura_cm is not null and (tg_op = 'INSERT' or new.altura_cm is distinct from old.altura_cm) then
    insert into public.historico_perfil (aluno_id, campo, valor) values (new.aluno_id, 'altura_cm', new.altura_cm::text);
  end if;
  if new.outras_medidas <> '' and (tg_op = 'INSERT' or new.outras_medidas is distinct from old.outras_medidas) then
    insert into public.historico_perfil (aluno_id, campo, valor) values (new.aluno_id, 'outras_medidas', new.outras_medidas);
  end if;
  return new;
end
$$;

create trigger alunos_saude_historico
  after insert or update on public.alunos_saude
  for each row execute function public.saude_registrar_historico();

-- Autorização de saúde retirada (a linha de saúde é apagada): o histórico de medidas também.
create or replace function public.saude_apagar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.historico_perfil
   where aluno_id = old.aluno_id and campo in ('peso_kg', 'altura_cm', 'outras_medidas');
  return old;
end
$$;

create trigger alunos_saude_apagar_historico
  after delete on public.alunos_saude
  for each row execute function public.saude_apagar_historico();

create or replace function public.alunos_registrar_objetivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if btrim(new.objetivo) <> '' and (tg_op = 'INSERT' or new.objetivo is distinct from old.objetivo) then
    insert into public.historico_perfil (aluno_id, campo, valor) values (new.id, 'objetivo', new.objetivo);
  end if;
  return new;
end
$$;

create trigger alunos_historico_objetivo
  after insert or update of objetivo on public.alunos
  for each row execute function public.alunos_registrar_objetivo();

-- Dados que já existiam: entram com a data da última atualização conhecida.
insert into public.historico_perfil (aluno_id, campo, valor, registrado_em)
select aluno_id, 'peso_kg', peso_kg::text, atualizado_em from public.alunos_saude where peso_kg is not null
union all
select aluno_id, 'altura_cm', altura_cm::text, atualizado_em from public.alunos_saude where altura_cm is not null
union all
select aluno_id, 'outras_medidas', outras_medidas, atualizado_em from public.alunos_saude where outras_medidas <> ''
union all
select id, 'objetivo', objetivo, atualizado_em from public.alunos where btrim(objetivo) <> '';

-- Ficha do aluno para o personal: agora com a data de cada dado.
create or replace function public.aluno_do_personal(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v           public.vinculos;
  a           public.alunos;
  s           public.alunos_saude;
  v_consentiu boolean;
begin
  select * into v from public.vinculos
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    return null;
  end if;

  select * into a from public.alunos where id = v.aluno_id;
  v_consentiu := public.tem_consentimento_saude(a.id);
  if v_consentiu then
    select * into s from public.alunos_saude where aluno_id = a.id;
  end if;

  return jsonb_build_object(
    'vinculo_id',              v.id,
    'aceito_em',               v.aceito_em,
    'nome_completo',           a.nome_completo,
    'idade',                   date_part('year', age(a.data_nascimento))::int,
    'genero',                  a.genero,
    'whatsapp',                a.whatsapp,
    'avisos_whatsapp',         a.whatsapp is not null and exists (
                                 select 1 from public.consentimentos c
                                  where c.aluno_id = a.id and c.tipo = 'whatsapp' and c.revogado_em is null),
    'objetivo',                a.objetivo,
    'nivel',                   a.nivel,
    'bairro',                  a.bairro,
    'cep',                     a.cep,
    'endereco',                a.endereco,
    'cidade',                  a.cidade,
    'restricoes',              case when v_consentiu then nullif(s.restricoes, '') end,
    'sem_restricoes',          case when v_consentiu then s.restricoes_declaradas_em is not null and s.restricoes = '' end,
    'restricoes_declaradas_em', case when v_consentiu then s.restricoes_declaradas_em end,
    'peso_kg',                 s.peso_kg,
    'altura_cm',               s.altura_cm,
    'outras_medidas',          nullif(s.outras_medidas, ''),
    -- Etapa 5: quando cada dado foi informado (o mais recente), para comparar no futuro.
    'datas',                   (select jsonb_object_agg(h.campo, h.quando)
                                  from (select campo, max(registrado_em) as quando
                                          from public.historico_perfil
                                         where aluno_id = a.id
                                           and (campo = 'objetivo' or v_consentiu)
                                         group by campo) h)
  );
end
$$;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.creditos_reposicao enable row level security;
alter table public.historico_perfil   enable row level security;

create policy "personal e aluno veem as próprias reposições" on public.creditos_reposicao
  for select to authenticated
  using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

-- O personal vê as datas pela ficha (função acima); o aluno vê o próprio histórico.
create policy "aluno vê o próprio histórico" on public.historico_perfil
  for select to authenticated using ((select auth.uid()) = aluno_id);

revoke all on function public.salvar_regras(integer)                                      from public, anon;
revoke all on function public.marcar_aula(uuid, text, text)                              from public, anon;
revoke all on function public.remarcar_aula(uuid, date, integer)                         from public, anon;
revoke all on function public.criar_aula(uuid, text, text, date, integer, integer, text) from public, anon;
revoke all on function public.saude_registrar_historico()  from public, anon, authenticated;
revoke all on function public.saude_apagar_historico()     from public, anon, authenticated;
revoke all on function public.alunos_registrar_objetivo()  from public, anon, authenticated;

grant execute on function public.salvar_regras(integer)                                      to authenticated;
grant execute on function public.marcar_aula(uuid, text, text)                              to authenticated;
grant execute on function public.remarcar_aula(uuid, date, integer)                         to authenticated;
grant execute on function public.criar_aula(uuid, text, text, date, integer, integer, text) to authenticated;

commit;
