-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 7): cobranças registradas e Pix copia e cola.
--
-- Decisões de 18/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Mensalidades geradas sozinhas pela matrícula (valor e dia de vencimento).
-- • A 1ª mensalidade vence no início da matrícula e é PROPORCIONAL aos dias até o
--   primeiro vencimento normal (cheia quando o vencimento cai no mesmo dia do início).
-- • Cada mensalidade aparece uma semana antes do vencimento (com aviso ao aluno).
-- • Matrícula com início no passado: só entram vencimentos a partir de quando ela
--   foi criada no Pienel (nada de cobranças antigas atrasadas).
-- • Pagamento por fora (Pix para a chave do personal): o aluno avisa "Já paguei" e o
--   personal confirma. Baixa automática só com o Asaas (etapa 10).
-- • Atrasada: vermelho para os dois; sem bloqueio por enquanto.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261018100000_aprovacao_de_pedidos.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Chave Pix do personal ────────────────────────────────────────────────
alter table public.personais
  add column pix_tipo   text check (pix_tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  add column pix_chave  text check (pix_chave is null or char_length(pix_chave) between 5 and 77),
  add column pix_nome   text check (pix_nome is null or char_length(pix_nome) between 2 and 25),
  add column pix_cidade text check (pix_cidade is null or char_length(pix_cidade) between 2 and 15);

comment on column public.personais.pix_chave is
  'Chave Pix para receber as mensalidades (pagamento por fora até a integração com o Asaas).';

-- ─── Cobranças ────────────────────────────────────────────────────────────
create table public.cobrancas (
  id                  uuid primary key default gen_random_uuid(),
  personal_id         uuid not null references public.personais (id) on delete cascade,
  vinculo_id          uuid not null references public.vinculos (id) on delete cascade,
  aluno_id            uuid references public.alunos (id) on delete set null,
  matricula_id        uuid references public.matriculas (id) on delete set null,
  tipo                text not null check (tipo in ('mensalidade', 'avulsa')),
  descricao           text check (descricao is null or char_length(descricao) between 2 and 80),
  -- Mensalidade: período que ela cobre (fim inclusive).
  periodo_inicio      date,
  periodo_fim         date,
  vencimento          date not null,
  valor_centavos      integer not null check (valor_centavos between 1 and 10000000),
  situacao            text not null default 'aberta' check (situacao in ('aberta', 'paga', 'cancelada')),
  pago_em             date,
  forma_pagamento     text check (forma_pagamento in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  valor_pago_centavos integer check (valor_pago_centavos is null or valor_pago_centavos between 1 and 10000000),
  aluno_avisou_em     timestamptz,
  criada_em           timestamptz not null default now(),
  atualizada_em       timestamptz not null default now()
);

comment on table public.cobrancas is
  'Mensalidades (geradas pela matrícula) e cobranças avulsas. Pagas por fora até a etapa 10 (Asaas).';

create index cobrancas_por_personal on public.cobrancas (personal_id, vencimento);
create index cobrancas_por_vinculo on public.cobrancas (vinculo_id, vencimento);
-- A mesma mensalidade não é gerada duas vezes.
create unique index cobrancas_uma_por_vencimento on public.cobrancas (matricula_id, vencimento)
  where tipo = 'mensalidade';

-- ─── Gerar as mensalidades (uma semana antes de cada vencimento) ──────────
create or replace function public.gerar_cobrancas(p_matricula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          public.matriculas;
  v_limite   date := public.hoje_brasilia() + 7;
  v_criada   date;
  v_primeiro date;
  v_cheio    integer;
  v_dias     integer;
  d          date;
begin
  select * into m from public.matriculas where id = p_matricula and situacao = 'ativa';
  if not found or m.valor_centavos is null or m.dia_vencimento is null then
    return;
  end if;
  v_criada := (m.criada_em at time zone 'America/Sao_Paulo')::date;
  v_primeiro := public.proxima_data_no_dia(m.inicio, m.dia_vencimento);

  -- 1ª mensalidade: no início, proporcional aos dias até o primeiro vencimento normal.
  if m.inicio <= v_limite and m.inicio >= v_criada then
    v_cheio := (m.inicio + interval '1 month')::date - m.inicio;
    v_dias  := v_primeiro - m.inicio;
    insert into public.cobrancas (personal_id, vinculo_id, aluno_id, matricula_id, tipo, periodo_inicio, periodo_fim,
                                  vencimento, valor_centavos)
    values (m.personal_id, m.vinculo_id, m.aluno_id, m.id, 'mensalidade', m.inicio, v_primeiro - 1, m.inicio,
            case when v_dias >= v_cheio then m.valor_centavos
                 else greatest(1, round(m.valor_centavos::numeric * v_dias / v_cheio)::integer) end)
    on conflict (matricula_id, vencimento) where tipo = 'mensalidade' do nothing;
  end if;

  -- As seguintes: cheias, uma por mês no dia do vencimento.
  d := v_primeiro;
  while d <= v_limite and (m.fim is null or d <= m.fim) loop
    if d >= v_criada then
      insert into public.cobrancas (personal_id, vinculo_id, aluno_id, matricula_id, tipo, periodo_inicio, periodo_fim,
                                    vencimento, valor_centavos)
      values (m.personal_id, m.vinculo_id, m.aluno_id, m.id, 'mensalidade', d,
              public.proxima_data_no_dia(d, m.dia_vencimento) - 1, d, m.valor_centavos)
      on conflict (matricula_id, vencimento) where tipo = 'mensalidade' do nothing;
    end if;
    d := public.proxima_data_no_dia(d, m.dia_vencimento);
  end loop;
end
$$;

create or replace function public.gerar_cobrancas_de_todos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.matriculas where situacao = 'ativa' loop
    perform public.gerar_cobrancas(r.id);
  end loop;
end
$$;

-- Matrícula criada ou alterada: gera o que já estiver a uma semana do vencimento.
create or replace function public.matriculas_gerar_cobrancas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.gerar_cobrancas(new.id);
  return new;
end
$$;

create trigger matriculas_gerar_cobrancas
  after insert or update on public.matriculas
  for each row execute function public.matriculas_gerar_cobrancas();

-- ─── Personal: cobrança avulsa ────────────────────────────────────────────
create or replace function public.criar_cobranca_avulsa(p_vinculo uuid, p_descricao text, p_valor integer, p_vencimento date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v    public.vinculos;
  v_id uuid;
begin
  select * into v from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;
  if char_length(btrim(coalesce(p_descricao, ''))) not between 2 and 80 then
    raise exception 'Escreva o que está sendo cobrado (até 80 caracteres).';
  end if;
  if p_valor is null or p_valor not between 1 and 10000000 then
    raise exception 'Confira o valor.';
  end if;
  if p_vencimento is null then
    raise exception 'Escolha o vencimento.';
  end if;
  insert into public.cobrancas (personal_id, vinculo_id, aluno_id, tipo, descricao, vencimento, valor_centavos)
  values (v.personal_id, v.id, v.aluno_id, 'avulsa', btrim(p_descricao), p_vencimento, p_valor)
  returning id into v_id;
  return v_id;
end
$$;

-- ─── Personal: receber, desfazer, mudar valor, cancelar ───────────────────
create or replace function public.cobranca_do_personal(p_cobranca uuid)
returns public.cobrancas
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas;
begin
  select * into c from public.cobrancas where id = p_cobranca and personal_id = auth.uid() for update;
  if not found then
    raise exception 'Cobrança não encontrada.';
  end if;
  return c;
end
$$;

create or replace function public.marcar_cobranca_paga(p_cobranca uuid, p_pago_em date, p_forma text, p_valor integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := public.cobranca_do_personal(p_cobranca);
begin
  if c.situacao <> 'aberta' then
    raise exception 'Esta cobrança não está em aberto.';
  end if;
  if p_forma not in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro') then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  if p_pago_em is null or p_pago_em > public.hoje_brasilia() then
    raise exception 'Confira a data do pagamento.';
  end if;
  if p_valor is null or p_valor not between 1 and 10000000 then
    raise exception 'Confira o valor recebido.';
  end if;
  update public.cobrancas
     set situacao = 'paga', pago_em = p_pago_em, forma_pagamento = p_forma, valor_pago_centavos = p_valor,
         atualizada_em = now()
   where id = c.id;
end
$$;

create or replace function public.desfazer_cobranca(p_cobranca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := public.cobranca_do_personal(p_cobranca);
begin
  update public.cobrancas
     set situacao = 'aberta', pago_em = null, forma_pagamento = null, valor_pago_centavos = null, atualizada_em = now()
   where id = c.id;
end
$$;

create or replace function public.alterar_valor_cobranca(p_cobranca uuid, p_valor integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := public.cobranca_do_personal(p_cobranca);
begin
  if c.situacao <> 'aberta' then
    raise exception 'Só dá para mudar o valor de uma cobrança em aberto.';
  end if;
  if p_valor is null or p_valor not between 1 and 10000000 then
    raise exception 'Confira o valor.';
  end if;
  update public.cobrancas set valor_centavos = p_valor, atualizada_em = now() where id = c.id;
end
$$;

create or replace function public.cancelar_cobranca(p_cobranca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas := public.cobranca_do_personal(p_cobranca);
begin
  if c.situacao <> 'aberta' then
    raise exception 'Só dá para cancelar uma cobrança em aberto.';
  end if;
  update public.cobrancas set situacao = 'cancelada', atualizada_em = now() where id = c.id;
end
$$;

-- ─── Aluno: "Já paguei" e a chave Pix do personal ─────────────────────────
alter table public.avisos add column cobranca_id uuid references public.cobrancas (id) on delete cascade;
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('cancelou_com_reposicao', 'cancelou_em_cima', 'marcou_reposicao', 'remarcou',
                  'pediu_reposicao', 'pediu_remarcacao', 'aceitou_sugestao', 'recusou_sugestao',
                  'avisou_pagamento'));

create or replace function public.aluno_avisar_pagamento(p_cobranca uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cobrancas;
begin
  select * into c from public.cobrancas where id = p_cobranca and aluno_id = auth.uid() for update;
  if not found then
    raise exception 'Cobrança não encontrada.';
  end if;
  perform public.vinculo_do_aluno(c.vinculo_id);
  if c.situacao <> 'aberta' then
    raise exception 'Esta cobrança não está em aberto.';
  end if;
  if c.aluno_avisou_em is not null then
    raise exception 'Você já avisou este pagamento. Aguarde a confirmação.';
  end if;
  update public.cobrancas set aluno_avisou_em = now(), atualizada_em = now() where id = c.id;
  insert into public.avisos (personal_id, vinculo_id, tipo, cobranca_id)
  values (c.personal_id, c.vinculo_id, 'avisou_pagamento', c.id);
end
$$;

-- O aluno ligado ao personal vê a chave Pix, o nome e a cidade (para pagar).
create or replace function public.pix_para_aluno(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos := public.vinculo_do_aluno(p_vinculo);
begin
  return (select case when p.pix_chave is null then null
                      else jsonb_build_object('tipo', p.pix_tipo, 'chave', p.pix_chave,
                                              'nome', p.pix_nome, 'cidade', p.pix_cidade) end
            from public.personais p where p.id = v.personal_id);
end
$$;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.cobrancas enable row level security;

create policy "personal e aluno veem as próprias cobranças" on public.cobrancas
  for select to authenticated
  using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

revoke all on function public.gerar_cobrancas(uuid)                                  from public, anon, authenticated;
revoke all on function public.gerar_cobrancas_de_todos()                             from public, anon, authenticated;
revoke all on function public.matriculas_gerar_cobrancas()                           from public, anon, authenticated;
revoke all on function public.cobranca_do_personal(uuid)                             from public, anon, authenticated;
revoke all on function public.criar_cobranca_avulsa(uuid, text, integer, date)       from public, anon;
revoke all on function public.marcar_cobranca_paga(uuid, date, text, integer)        from public, anon;
revoke all on function public.desfazer_cobranca(uuid)                                from public, anon;
revoke all on function public.alterar_valor_cobranca(uuid, integer)                  from public, anon;
revoke all on function public.cancelar_cobranca(uuid)                                from public, anon;
revoke all on function public.aluno_avisar_pagamento(uuid)                           from public, anon;
revoke all on function public.pix_para_aluno(uuid)                                   from public, anon;

grant execute on function public.criar_cobranca_avulsa(uuid, text, integer, date)    to authenticated;
grant execute on function public.marcar_cobranca_paga(uuid, date, text, integer)     to authenticated;
grant execute on function public.desfazer_cobranca(uuid)                             to authenticated;
grant execute on function public.alterar_valor_cobranca(uuid, integer)               to authenticated;
grant execute on function public.cancelar_cobranca(uuid)                             to authenticated;
grant execute on function public.aluno_avisar_pagamento(uuid)                        to authenticated;
grant execute on function public.pix_para_aluno(uuid)                                to authenticated;

-- Matrículas que já existem: gera o que estiver perto de vencer.
select public.gerar_cobrancas_de_todos();

-- Todo dia às 03:10 (00:10 em Brasília).
select cron.schedule('pienel-gerar-cobrancas', '10 3 * * *', $$select public.gerar_cobrancas_de_todos()$$);

commit;
