-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell Estúdio, etapa 1 (financeiro): tipo do estúdio, pagamento dos professores,
-- máximo de alunos por turma, mensalidades dos alunos e o relatório de pagamento.
--
-- Decisões de 09/11/2026 (docs/plano-fase-1-agenda.md, decisão 55):
-- • Tipo: "estudio" ou "academia" (de rede). Academia: professor por hora e sem mensalidades.
-- • Pagamento do professor (vale para o estúdio todo, com valor próprio por professor se quiser):
--   por hora; hora-aula com comissão (valor por aula dada + valor por aluno presente);
--   percentual da mensalidade dos alunos das turmas dele (dividido pelas aulas de cada
--   professor quando o aluno tem mais de um).
-- • Mensalidade do aluno: tabela de 1x a 7x por semana (pelo número de turmas do aluno) ou
--   valor de exceção; vence no dia escolhido; aparece 7 dias antes do vencimento.
-- • O app calcula quanto pagar a cada professor; a coordenação paga por fora e marca como pago.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261109100000_estudios_etapa_1.sql e ANTES de enviar o site novo.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Configuração do estúdio ───────────────────────────────────────────────
alter table public.estudios
  add column tipo                     text not null default 'estudio' check (tipo in ('estudio', 'academia')),
  add column pagamento_modelo         text not null default 'hora' check (pagamento_modelo in ('hora', 'aula_comissao', 'percentual')),
  add column valor_hora_centavos      integer check (valor_hora_centavos is null or valor_hora_centavos between 0 and 10000000),
  add column valor_aula_centavos      integer check (valor_aula_centavos is null or valor_aula_centavos between 0 and 10000000),
  add column valor_por_aluno_centavos integer check (valor_por_aluno_centavos is null or valor_por_aluno_centavos between 0 and 10000000),
  add column percentual               numeric(5, 2) check (percentual is null or percentual between 0 and 100),
  add column max_alunos_turma         integer not null default 8 check (max_alunos_turma between 1 and 100),
  add column pix_tipo                 text check (pix_tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  add column pix_chave                text check (pix_chave is null or char_length(pix_chave) between 5 and 77),
  add column pix_nome                 text check (pix_nome is null or char_length(pix_nome) between 2 and 25),
  add column pix_cidade               text check (pix_cidade is null or char_length(pix_cidade) between 2 and 15),
  add constraint estudios_academia_por_hora check (tipo = 'estudio' or pagamento_modelo = 'hora');

-- Valor próprio de um professor (vazio: usa o padrão do estúdio).
alter table public.estudio_membros
  add column valor_hora_centavos      integer check (valor_hora_centavos is null or valor_hora_centavos between 0 and 10000000),
  add column valor_aula_centavos      integer check (valor_aula_centavos is null or valor_aula_centavos between 0 and 10000000),
  add column valor_por_aluno_centavos integer check (valor_por_aluno_centavos is null or valor_por_aluno_centavos between 0 and 10000000),
  add column percentual               numeric(5, 2) check (percentual is null or percentual between 0 and 100);

-- Mensalidade por vezes na semana (1x a 7x).
create table public.estudio_precos (
  estudio_id     uuid not null references public.estudios (id) on delete cascade,
  vezes          integer not null check (vezes between 1 and 7),
  valor_centavos integer not null check (valor_centavos between 100 and 10000000),
  primary key (estudio_id, vezes)
);

alter table public.estudio_alunos
  add column valor_mensal_centavos integer check (valor_mensal_centavos is null or valor_mensal_centavos between 0 and 10000000),
  add column dia_vencimento        integer check (dia_vencimento is null or dia_vencimento between 1 and 28);

comment on column public.estudio_alunos.valor_mensal_centavos is 'Exceção: mensalidade diferente da tabela (vazio: usa a tabela pelo número de turmas).';

create table public.estudio_cobrancas (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  aluno_id          uuid references public.alunos (id) on delete set null,
  referencia        date not null,
  vencimento        date not null,
  valor_centavos    integer not null check (valor_centavos >= 0),
  situacao          text not null default 'aberta' check (situacao in ('aberta', 'paga', 'cancelada')),
  pago_em           date,
  aluno_avisou_em   timestamptz,
  criada_em         timestamptz not null default now(),
  unique (estudio_aluno_id, referencia)
);
create index estudio_cobrancas_por_estudio on public.estudio_cobrancas (estudio_id, vencimento);

-- Pagamento dos professores, mês a mês (o valor fica gravado quando a coordenação marca como pago).
create table public.estudio_pagamentos (
  estudio_id     uuid not null references public.estudios (id) on delete cascade,
  personal_id    uuid not null references public.personais (id) on delete cascade,
  mes            date not null check (extract(day from mes) = 1),
  valor_centavos integer not null check (valor_centavos >= 0),
  pago_em        date not null,
  primary key (estudio_id, personal_id, mes)
);

alter table public.estudio_precos     enable row level security;
alter table public.estudio_cobrancas  enable row level security;
alter table public.estudio_pagamentos enable row level security;

create policy "membros veem os preços" on public.estudio_precos
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);
create policy "coordenação vê as mensalidades" on public.estudio_cobrancas
  for select to authenticated using (public.coordena_estudio(estudio_id));
create policy "aluno vê as próprias mensalidades do estúdio" on public.estudio_cobrancas
  for select to authenticated using (aluno_id = (select auth.uid()));
create policy "coordenação vê os pagamentos" on public.estudio_pagamentos
  for select to authenticated using (public.coordena_estudio(estudio_id));
create policy "professor vê os próprios pagamentos" on public.estudio_pagamentos
  for select to authenticated using (personal_id = (select auth.uid()));

-- ─── Configurar ────────────────────────────────────────────────────────────
create or replace function public.salvar_config_estudio(p_estudio uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda as configurações.';
  end if;
  if coalesce(p ->> 'tipo', '') not in ('estudio', 'academia') then
    raise exception 'Escolha se é estúdio ou academia.';
  end if;
  if coalesce(p ->> 'pagamento_modelo', '') not in ('hora', 'aula_comissao', 'percentual') then
    raise exception 'Escolha como os professores recebem.';
  end if;
  if p ->> 'tipo' = 'academia' and p ->> 'pagamento_modelo' <> 'hora' then
    raise exception 'Na academia, o professor recebe por hora.';
  end if;
  update public.estudios
     set nome = coalesce(nullif(btrim(p ->> 'nome'), ''), nome),
         tipo = p ->> 'tipo',
         pagamento_modelo = p ->> 'pagamento_modelo',
         valor_hora_centavos = (p ->> 'valor_hora_centavos')::integer,
         valor_aula_centavos = (p ->> 'valor_aula_centavos')::integer,
         valor_por_aluno_centavos = (p ->> 'valor_por_aluno_centavos')::integer,
         percentual = (p ->> 'percentual')::numeric,
         max_alunos_turma = coalesce((p ->> 'max_alunos_turma')::integer, max_alunos_turma),
         antecedencia_falta_h = coalesce((p ->> 'antecedencia_falta_h')::integer, antecedencia_falta_h),
         validade_reposicao_dias = coalesce((p ->> 'validade_reposicao_dias')::integer, validade_reposicao_dias)
   where id = p_estudio;
end
$$;

create or replace function public.salvar_valor_professor(p_estudio uuid, p_personal uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda os valores dos professores.';
  end if;
  update public.estudio_membros
     set valor_hora_centavos = (p ->> 'valor_hora_centavos')::integer,
         valor_aula_centavos = (p ->> 'valor_aula_centavos')::integer,
         valor_por_aluno_centavos = (p ->> 'valor_por_aluno_centavos')::integer,
         percentual = (p ->> 'percentual')::numeric
   where estudio_id = p_estudio and personal_id = p_personal;
  if not found then
    raise exception 'Professor não encontrado no estúdio.';
  end if;
end
$$;

-- p: [{vezes, valor_centavos}]; vezes fora da lista deixam de ser oferecidas.
create or replace function public.salvar_precos_estudio(p_estudio uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda as mensalidades.';
  end if;
  delete from public.estudio_precos where estudio_id = p_estudio;
  insert into public.estudio_precos (estudio_id, vezes, valor_centavos)
  select p_estudio, (x ->> 'vezes')::integer, (x ->> 'valor_centavos')::integer from jsonb_array_elements(p) x;
end
$$;

create or replace function public.salvar_pix_estudio(p_estudio uuid, p_tipo text, p_chave text, p_nome text, p_cidade text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda a chave Pix.';
  end if;
  update public.estudios
     set pix_tipo = p_tipo, pix_chave = btrim(p_chave), pix_nome = btrim(p_nome), pix_cidade = btrim(p_cidade)
   where id = p_estudio;
end
$$;

create or replace function public.salvar_mensalidade_aluno(p_aluno uuid, p_valor_centavos integer, p_dia integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.estudio_alunos;
begin
  select * into a from public.estudio_alunos where id = p_aluno;
  if not found or not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só a coordenação muda a mensalidade dos alunos.';
  end if;
  update public.estudio_alunos set valor_mensal_centavos = p_valor_centavos, dia_vencimento = p_dia where id = a.id;
end
$$;

-- ─── Mensalidades ──────────────────────────────────────────────────────────
-- Valor da mensalidade de um aluno: exceção, ou a tabela pelo número de turmas por semana.
create or replace function public.mensalidade_do_aluno_estudio(p_aluno uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(a.valor_mensal_centavos,
                  (select p.valor_centavos from public.estudio_precos p
                    where p.estudio_id = a.estudio_id
                      and p.vezes = least(7, (select count(*) from public.turma_alunos ta
                                                join public.turmas t on t.id = ta.turma_id and t.ativa
                                               where ta.estudio_aluno_id = a.id))))
    from public.estudio_alunos a where a.id = p_aluno;
$$;

-- Robô: mensalidades que vencem nos próximos 7 dias e ainda não existem.
create or replace function public.gerar_cobrancas_estudio()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_hoje date := public.hoje_brasilia();
  v_venc date;
  v_val  integer;
  n      integer := 0;
begin
  for r in
    select a.* from public.estudio_alunos a join public.estudios e on e.id = a.estudio_id
     where a.situacao = 'ativo' and a.dia_vencimento is not null and e.tipo = 'estudio'
       and exists (select 1 from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id and t.ativa
                    where ta.estudio_aluno_id = a.id)
  loop
    -- Próximo vencimento (este mês ou o seguinte).
    v_venc := make_date(extract(year from v_hoje)::int, extract(month from v_hoje)::int, r.dia_vencimento);
    if v_venc < v_hoje then
      v_venc := (v_venc + interval '1 month')::date;
    end if;
    continue when v_venc > v_hoje + 7;
    v_val := public.mensalidade_do_aluno_estudio(r.id);
    continue when v_val is null;
    insert into public.estudio_cobrancas (estudio_id, estudio_aluno_id, aluno_id, referencia, vencimento, valor_centavos)
    values (r.estudio_id, r.id, r.aluno_id, date_trunc('month', v_venc)::date, v_venc, v_val)
    on conflict (estudio_aluno_id, referencia) do nothing;
    if found then
      n := n + 1;
    end if;
  end loop;
  return n;
end
$$;

-- Coordenação: gerar agora as mensalidades do estúdio (sem esperar o robô).
create or replace function public.gerar_cobrancas_do_estudio(p_estudio uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação gera mensalidades.';
  end if;
  return public.gerar_cobrancas_estudio();
end
$$;

create or replace function public.marcar_cobranca_estudio(p_cobranca uuid, p_situacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.estudio_cobrancas;
begin
  select * into c from public.estudio_cobrancas where id = p_cobranca for update;
  if not found or not public.coordena_estudio(c.estudio_id) then
    raise exception 'Mensalidade não encontrada.';
  end if;
  if p_situacao not in ('aberta', 'paga', 'cancelada') then
    raise exception 'Situação inválida.';
  end if;
  update public.estudio_cobrancas
     set situacao = p_situacao, pago_em = case when p_situacao = 'paga' then public.hoje_brasilia() end
   where id = c.id;
end
$$;

-- ─── Pagamento dos professores ─────────────────────────────────────────────
-- Quanto pagar a cada professor no mês (p_mes = primeiro dia do mês), pela regra do estúdio.
-- Aula dada: já passou e não foi cancelada. Presença: marcada na chamada.
create or replace function public.pagamento_professores(p_estudio uuid, p_mes date)
returns table (personal_id uuid, nome text, aulas integer, minutos integer, presencas integer,
               valor_centavos integer, pago_em date, valor_pago_centavos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e       public.estudios;
  v_ini   timestamptz := public.instante_brasilia(date_trunc('month', p_mes)::date, 0);
  v_fim   timestamptz := public.instante_brasilia((date_trunc('month', p_mes) + interval '1 month')::date, 0);
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê o pagamento dos professores.';
  end if;
  select * into e from public.estudios where id = p_estudio;

  return query
  with dadas as (
    select a.* from public.aulas_turma a
     where a.estudio_id = p_estudio and a.situacao = 'agendada'
       and a.inicio >= v_ini and a.inicio < v_fim and a.fim <= now()
  ),
  por_prof as (
    select d.professor_id,
           count(*)::integer as aulas,
           sum(extract(epoch from d.fim - d.inicio) / 60)::integer as minutos,
           (select count(*)::integer from public.presencas p
             where p.aula_turma_id in (select x.id from dadas x where x.professor_id = d.professor_id)
               and p.situacao = 'presente') as presencas
      from dadas d where d.professor_id is not null
     group by d.professor_id
  ),
  -- Percentual: cada aluno ativo divide a mensalidade entre os professores pelas aulas do mês.
  partes as (
    select d.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from dadas d
      join public.turma_alunos ta on ta.turma_id = d.turma_id
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where d.professor_id is not null
     group by d.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt group by pt.professor_id
  )
  select m.personal_id, pe.nome_completo,
         coalesce(pp.aulas, 0), coalesce(pp.minutos, 0), coalesce(pp.presencas, 0),
         (case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
          end)::integer,
         pg.pago_em, pg.valor_centavos
    from public.estudio_membros m
    join public.personais pe on pe.id = m.personal_id
    left join por_prof pp on pp.professor_id = m.personal_id
    left join base_percentual bp on bp.professor_id = m.personal_id
    left join public.estudio_pagamentos pg
           on pg.estudio_id = p_estudio and pg.personal_id = m.personal_id and pg.mes = date_trunc('month', p_mes)::date
   where m.estudio_id = p_estudio and (pp.aulas is not null or m.papel = 'professor')
   order by pe.nome_completo;
end
$$;

create or replace function public.marcar_pagamento_professor(p_estudio uuid, p_personal uuid, p_mes date, p_valor_centavos integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação registra pagamentos.';
  end if;
  if p_valor_centavos is null then
    delete from public.estudio_pagamentos
     where estudio_id = p_estudio and personal_id = p_personal and mes = date_trunc('month', p_mes)::date;
  else
    insert into public.estudio_pagamentos (estudio_id, personal_id, mes, valor_centavos, pago_em)
    values (p_estudio, p_personal, date_trunc('month', p_mes)::date, p_valor_centavos, public.hoje_brasilia())
    on conflict (estudio_id, personal_id, mes) do update set valor_centavos = excluded.valor_centavos, pago_em = excluded.pago_em;
  end if;
end
$$;

-- ─── Permissões e robô ─────────────────────────────────────────────────────
revoke all on function public.salvar_config_estudio(uuid, jsonb)               from public, anon;
revoke all on function public.salvar_valor_professor(uuid, uuid, jsonb)        from public, anon;
revoke all on function public.salvar_precos_estudio(uuid, jsonb)               from public, anon;
revoke all on function public.salvar_pix_estudio(uuid, text, text, text, text) from public, anon;
revoke all on function public.salvar_mensalidade_aluno(uuid, integer, integer) from public, anon;
revoke all on function public.mensalidade_do_aluno_estudio(uuid)               from public, anon, authenticated;
revoke all on function public.gerar_cobrancas_estudio()                        from public, anon, authenticated;
revoke all on function public.gerar_cobrancas_do_estudio(uuid)                 from public, anon;
revoke all on function public.marcar_cobranca_estudio(uuid, text)              from public, anon;
revoke all on function public.pagamento_professores(uuid, date)                from public, anon;
revoke all on function public.marcar_pagamento_professor(uuid, uuid, date, integer) from public, anon;

grant execute on function public.salvar_config_estudio(uuid, jsonb)               to authenticated;
grant execute on function public.salvar_valor_professor(uuid, uuid, jsonb)        to authenticated;
grant execute on function public.salvar_precos_estudio(uuid, jsonb)               to authenticated;
grant execute on function public.salvar_pix_estudio(uuid, text, text, text, text) to authenticated;
grant execute on function public.salvar_mensalidade_aluno(uuid, integer, integer) to authenticated;
grant execute on function public.gerar_cobrancas_do_estudio(uuid)                 to authenticated;
grant execute on function public.marcar_cobranca_estudio(uuid, text)              to authenticated;
grant execute on function public.pagamento_professores(uuid, date)                to authenticated;
grant execute on function public.marcar_pagamento_professor(uuid, uuid, date, integer) to authenticated;

-- Todo dia, às 3h30: mensalidades do estúdio que vencem nos próximos 7 dias.
select cron.schedule('pbell-cobrancas-estudio', '30 3 * * *', $$select public.gerar_cobrancas_estudio()$$);

commit;
