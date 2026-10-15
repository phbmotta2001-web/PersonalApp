-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 0): conta de PERSONAL.
--
-- Pivot de 15/10/2026 (ver docs/plano-fase-1-agenda.md): a conta principal passa a
-- ser a do personal. O aluno continua tendo conta, mas ela nasce do convite do
-- personal (etapa 2).
--
-- • Nova tabela "personais": uma linha por conta de personal.
-- • O cadastro com tipo_conta = 'personal' cria o personal (e não um aluno).
-- • "visivel_na_busca" já fica previsto para a Fase 2 (marketplace), DESLIGADO.
-- • A situação da conta começa "em_analise"; a equipe aprova depois de conferir
--   o CREF (comando em docs/plano-fase-1-agenda.md).
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261014150000_horarios_do_pedido.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table public.personais (
  id                          uuid primary key references auth.users (id) on delete cascade,
  nome_completo               text not null check (char_length(btrim(nome_completo)) between 2 and 120),
  whatsapp                    text not null check (whatsapp ~ '^\d{10,13}$'),
  cref                        text not null check (cref ~ '^[0-9]{3,6}-?[A-Za-z]?$'),
  cref_uf                     text not null check (cref_uf ~ '^[A-Z]{2}$'),
  situacao                    text not null default 'em_analise'
                                check (situacao in ('em_analise', 'aprovado', 'suspenso')),
  -- Fase 2 (marketplace): mostrar a agenda na busca pública. Desligado.
  visivel_na_busca            boolean not null default false,
  termo_confidencialidade     text not null check (char_length(termo_confidencialidade) between 1 and 50),
  termo_aceito_em             timestamptz not null default now(),
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now()
);

comment on table public.personais is
  'Conta de personal (Fase 1). Situação, CREF e termo só mudam pela equipe.';
comment on column public.personais.visivel_na_busca is
  'Fase 2: mostrar a agenda na listagem pública. Padrão desligado.';
comment on column public.personais.termo_confidencialidade is
  'Versão do termo de confidencialidade aceito no cadastro.';

-- O personal edita os próprios dados, mas não a situação, o CREF nem o termo.
create or replace function public.personais_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.id                      is distinct from old.id
    or new.nome_completo           is distinct from old.nome_completo
    or new.cref                    is distinct from old.cref
    or new.cref_uf                 is distinct from old.cref_uf
    or new.situacao                is distinct from old.situacao
    or new.termo_confidencialidade is distinct from old.termo_confidencialidade
    or new.termo_aceito_em         is distinct from old.termo_aceito_em
    or new.criado_em               is distinct from old.criado_em
  ) then
    raise exception 'Nome, CREF e situação da conta só podem ser alterados pela equipe do Pienel.';
  end if;
  new.atualizado_em := now();
  return new;
end
$$;

create trigger personais_antes_de_atualizar
  before update on public.personais
  for each row execute function public.personais_antes_de_atualizar();

-- ─── Cadastro: cria aluno OU personal, conforme o tipo da conta ───────────
create or replace function public.criar_aluno_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tipo       text  := coalesce(m ->> 'tipo_conta', 'aluno');
  nascimento date;
begin
  if tipo = 'personal' then
    insert into public.personais (id, nome_completo, whatsapp, cref, cref_uf, termo_confidencialidade)
    values (
      new.id,
      btrim(m ->> 'nome_completo'),
      regexp_replace(coalesce(m ->> 'whatsapp', ''), '\D', '', 'g'),
      upper(btrim(m ->> 'cref')),
      upper(btrim(m ->> 'cref_uf')),
      m ->> 'termo_confidencialidade'
    );
    return new;
  end if;

  if tipo <> 'aluno' then
    raise exception 'Tipo de conta desconhecido.';
  end if;

  nascimento := (m ->> 'data_nascimento')::date;
  if nascimento is null or not public.tem_18_anos(nascimento) then
    raise exception 'O cadastro é permitido só para maiores de 18 anos.';
  end if;

  insert into public.alunos (id, nome_completo, data_nascimento, genero)
  values (new.id, btrim(m ->> 'nome_completo'), nascimento, nullif(m ->> 'genero', ''));

  if coalesce(m ->> 'consentimento_saude_versao', '') <> '' then
    insert into public.consentimentos (aluno_id, tipo, versao_texto)
    values (new.id, 'dados_saude', m ->> 'consentimento_saude_versao');
  end if;

  return new;
end
$$;

revoke all on function public.criar_aluno_no_cadastro() from public, anon, authenticated;

-- ─── Que tipo de conta está logada ────────────────────────────────────────
create or replace function public.tipo_da_conta()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.personais p where p.id = auth.uid()) then 'personal'
    when exists (select 1 from public.alunos a where a.id = auth.uid()) then 'aluno'
  end
$$;

revoke all on function public.tipo_da_conta() from public, anon;
grant execute on function public.tipo_da_conta() to authenticated;

-- ─── Segurança por linha ──────────────────────────────────────────────────
alter table public.personais enable row level security;

create policy "personal vê os próprios dados" on public.personais
  for select to authenticated using ((select auth.uid()) = id);
create policy "personal edita os próprios dados" on public.personais
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

commit;
