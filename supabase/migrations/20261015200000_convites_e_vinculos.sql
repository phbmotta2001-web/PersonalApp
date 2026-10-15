-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1 (etapa 2): convites, vínculos personal ↔ aluno, WhatsApp
-- opcional do aluno e exclusão de conta.
--
-- Decisões de 15/10/2026 (ver docs/plano-fase-1-agenda.md):
-- • Convite individual por aluno: link com código longo, válido por 14 dias, que
--   serve para um aluno só. (Link único do personal, para redes sociais: Fase 2.)
-- • O aluno com conta só aceita; quem não tem, cria a conta pelo convite. Um aluno
--   pode ter vários personais.
-- • O vínculo só fica ativo com o perfil completo: objetivo, nível, autorização de
--   saúde e declaração de restrições.
-- • Com vínculo ativo, o personal vê o cadastro completo do aluno (nunca e-mail
--   nem data de nascimento: vê a idade). Encerrado o vínculo, deixa de ver.
-- • WhatsApp do aluno é OPCIONAL. Avisos por WhatsApp só com a caixa marcada
--   (consentimento tipo 'whatsapp') e com número informado.
-- • Qualquer conta pode ser excluída pelo próprio dono; o app confere a senha antes.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261015170000_sem_conferencia_cref.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── WhatsApp do aluno (opcional) e consentimento de avisos ───────────────
alter table public.alunos
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,13}$');

comment on column public.alunos.whatsapp is
  'Opcional. Só recebe avisos por WhatsApp quem informou o número e marcou a autorização.';

alter table public.consentimentos drop constraint consentimentos_tipo_check;
alter table public.consentimentos
  add constraint consentimentos_tipo_check check (tipo in ('dados_saude', 'whatsapp'));

-- ─── Vínculos (e convites) ────────────────────────────────────────────────
create table public.vinculos (
  id                uuid primary key default gen_random_uuid(),
  personal_id       uuid not null references public.personais (id) on delete cascade,
  -- Preenchido quando o aluno aceita. Se o aluno excluir a conta, vira nulo.
  aluno_id          uuid references public.alunos (id) on delete set null,
  situacao          text not null default 'convidado'
                      check (situacao in ('convidado', 'ativo', 'encerrado', 'cancelado')),
  -- Código do link de convite: 64 caracteres aleatórios, impossível de adivinhar.
  codigo            text not null unique
                      default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  nome_convite      text not null check (char_length(btrim(nome_convite)) between 2 and 80),
  whatsapp_convite  text check (whatsapp_convite is null or whatsapp_convite ~ '^\d{10,13}$'),
  criado_em         timestamptz not null default now(),
  expira_em         timestamptz not null default now() + interval '14 days',
  aceito_em         timestamptz,
  encerrado_em      timestamptz,
  encerrado_por     text check (encerrado_por in ('aluno', 'personal', 'exclusao'))
);

comment on table public.vinculos is
  'Convite (situacao convidado) e, depois de aceito, a ligação ativa entre personal e aluno.';

create index vinculos_por_personal on public.vinculos (personal_id, situacao);
create index vinculos_por_aluno on public.vinculos (aluno_id, situacao);
-- Um vínculo ativo por par personal + aluno.
create unique index vinculos_um_ativo_por_par on public.vinculos (personal_id, aluno_id)
  where situacao = 'ativo';

-- Aluno que exclui a conta: os vínculos ficam como "encerrado por exclusão".
create or replace function public.alunos_antes_de_excluir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vinculos
     set situacao = 'encerrado', encerrado_em = now(), encerrado_por = 'exclusao'
   where aluno_id = old.id and situacao = 'ativo';
  return old;
end
$$;

create trigger alunos_antes_de_excluir
  before delete on public.alunos
  for each row execute function public.alunos_antes_de_excluir();

-- ─── Perfil completo (requisito para o vínculo ficar ativo) ───────────────
create or replace function public.perfil_completo(p_aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.alunos a
      join public.alunos_saude s on s.aluno_id = a.id
     where a.id = p_aluno
       and btrim(a.objetivo) <> ''
       and a.nivel is not null
       and s.restricoes_declaradas_em is not null
       and public.tem_consentimento_saude(a.id)
  )
$$;

revoke all on function public.perfil_completo(uuid) from public, anon;
grant execute on function public.perfil_completo(uuid) to authenticated;

-- ─── Personal: criar e cancelar convite ───────────────────────────────────
create or replace function public.criar_convite(p_nome text, p_whatsapp text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personal uuid := auth.uid();
  v          public.vinculos;
begin
  if not exists (select 1 from public.personais where id = v_personal and situacao <> 'suspenso') then
    raise exception 'Só personais com conta ativa podem convidar alunos.';
  end if;

  insert into public.vinculos (personal_id, nome_convite, whatsapp_convite)
  values (v_personal, btrim(p_nome), nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''))
  returning * into v;

  return jsonb_build_object('id', v.id, 'codigo', v.codigo, 'expira_em', v.expira_em);
end
$$;

create or replace function public.cancelar_convite(p_vinculo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vinculos
     set situacao = 'cancelado', encerrado_em = now(), encerrado_por = 'personal'
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'convidado';
  if not found then
    raise exception 'Convite não encontrado.';
  end if;
end
$$;

-- ─── Qualquer pessoa com o link: ver de quem é o convite ──────────────────
-- Pode ser chamada sem login (a página do convite aparece antes do cadastro).
-- Devolve só o nome e o CREF do personal e o nome usado no convite.
create or replace function public.ver_convite(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  p public.personais;
begin
  select * into v from public.vinculos where codigo = p_codigo;
  if not found or char_length(coalesce(p_codigo, '')) <> 64 then
    return jsonb_build_object('situacao', 'inexistente');
  end if;

  select * into p from public.personais where id = v.personal_id;

  return jsonb_build_object(
    'situacao', case
                  when v.situacao = 'convidado' and v.expira_em <= now() then 'expirado'
                  when v.situacao = 'convidado' then 'valido'
                  when v.situacao = 'ativo' then 'usado'
                  else v.situacao
                end,
    'nome_convite', v.nome_convite,
    'personal_nome', p.nome_completo,
    'personal_cref', p.cref || '/' || p.cref_uf,
    'ja_aceito_por_mim', v.aluno_id is not null and v.aluno_id = auth.uid()
  );
end
$$;

-- ─── Aluno: aceitar o convite ─────────────────────────────────────────────
create or replace function public.aceitar_convite(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno     uuid := auth.uid();
  v           public.vinculos;
  v_existente uuid;
begin
  if v_aluno is null or not exists (select 1 from public.alunos where id = v_aluno) then
    raise exception 'Entre com uma conta de aluno para aceitar o convite.';
  end if;

  if not public.perfil_completo(v_aluno) then
    raise exception 'Complete seu perfil (objetivo, nível e restrições) antes de aceitar o convite.';
  end if;

  select * into v from public.vinculos where codigo = p_codigo for update;
  if not found then
    raise exception 'Convite não encontrado.';
  end if;
  if v.situacao = 'ativo' and v.aluno_id = v_aluno then
    return v.id;   -- já aceito por este aluno
  end if;
  if v.situacao <> 'convidado' or v.expira_em <= now() then
    raise exception 'Este convite não está mais válido. Peça um link novo ao seu personal.';
  end if;

  -- Já é aluno deste personal: o convite novo não é necessário.
  select id into v_existente from public.vinculos
   where personal_id = v.personal_id and aluno_id = v_aluno and situacao = 'ativo';
  if v_existente is not null then
    update public.vinculos set situacao = 'cancelado', encerrado_em = now(), encerrado_por = 'aluno'
     where id = v.id;
    return v_existente;
  end if;

  update public.vinculos
     set aluno_id = v_aluno, situacao = 'ativo', aceito_em = now()
   where id = v.id;
  return v.id;
end
$$;

-- ─── Encerrar o vínculo (aluno ou personal) ───────────────────────────────
create or replace function public.encerrar_vinculo(p_vinculo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo and situacao = 'ativo';
  if not found or auth.uid() is distinct from v.personal_id and auth.uid() is distinct from v.aluno_id then
    raise exception 'Vínculo não encontrado.';
  end if;

  update public.vinculos
     set situacao = 'encerrado', encerrado_em = now(),
         encerrado_por = case when auth.uid() = v.personal_id then 'personal' else 'aluno' end
   where id = p_vinculo;
end
$$;

-- ─── Personal: lista de alunos e convites ─────────────────────────────────
create or replace function public.meus_alunos()
returns table (
  vinculo_id uuid, situacao text, nome text, whatsapp text, codigo text,
  criado_em timestamptz, expira_em timestamptz, aceito_em timestamptz, encerrado_em timestamptz,
  encerrado_por text
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
         case when v.situacao = 'convidado' and v.expira_em <= now() then 'expirado' else v.situacao end,
         coalesce(a.nome_completo, v.nome_convite),
         coalesce(a.whatsapp, v.whatsapp_convite),
         case when v.situacao = 'convidado' then v.codigo end,
         v.criado_em, v.expira_em, v.aceito_em, v.encerrado_em, v.encerrado_por
    from public.vinculos v
    left join public.alunos a on a.id = v.aluno_id and v.situacao = 'ativo'
   where v.personal_id = auth.uid()
   order by v.criado_em desc
$$;

-- ─── Personal: ficha completa de um aluno (só com vínculo ativo) ──────────
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
    'outras_medidas',          nullif(s.outras_medidas, '')
  );
end
$$;

-- ─── Aluno: os personais ligados a ele ────────────────────────────────────
create or replace function public.meus_personais()
returns table (vinculo_id uuid, personal_nome text, personal_cref text, personal_whatsapp text, aceito_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, p.nome_completo, p.cref || '/' || p.cref_uf, p.whatsapp, v.aceito_em
    from public.vinculos v
    join public.personais p on p.id = v.personal_id
   where v.aluno_id = auth.uid() and v.situacao = 'ativo'
   order by v.aceito_em
$$;

-- ─── Excluir a própria conta ──────────────────────────────────────────────
-- O app confere a senha antes de chamar. Apaga a conta e, em cascata, tudo o que é
-- dela (perfil, saúde, consentimentos, pedidos, horários, bloqueios, convites).
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para excluí-la.';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

-- ─── Cadastro: aluno agora pode trazer WhatsApp e a autorização de avisos ─
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
  v_whatsapp text  := nullif(regexp_replace(coalesce(m ->> 'whatsapp', ''), '\D', '', 'g'), '');
begin
  if tipo = 'personal' then
    insert into public.personais (id, nome_completo, whatsapp, cref, cref_uf, termo_confidencialidade)
    values (
      new.id,
      btrim(m ->> 'nome_completo'),
      v_whatsapp,
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

  insert into public.alunos (id, nome_completo, data_nascimento, genero, whatsapp)
  values (new.id, btrim(m ->> 'nome_completo'), nascimento, nullif(m ->> 'genero', ''), v_whatsapp);

  if coalesce(m ->> 'consentimento_saude_versao', '') <> '' then
    insert into public.consentimentos (aluno_id, tipo, versao_texto)
    values (new.id, 'dados_saude', m ->> 'consentimento_saude_versao');
  end if;

  if v_whatsapp is not null and coalesce(m ->> 'consentimento_whatsapp_versao', '') <> '' then
    insert into public.consentimentos (aluno_id, tipo, versao_texto)
    values (new.id, 'whatsapp', m ->> 'consentimento_whatsapp_versao');
  end if;

  return new;
end
$$;

-- ─── Segurança por linha e permissões ─────────────────────────────────────
alter table public.vinculos enable row level security;

create policy "personal e aluno veem seus vínculos" on public.vinculos
  for select to authenticated
  using ((select auth.uid()) = personal_id or (select auth.uid()) = aluno_id);

revoke all on function public.criar_convite(text, text)       from public, anon;
revoke all on function public.cancelar_convite(uuid)           from public, anon;
revoke all on function public.aceitar_convite(text)            from public, anon;
revoke all on function public.encerrar_vinculo(uuid)           from public, anon;
revoke all on function public.meus_alunos()                    from public, anon;
revoke all on function public.aluno_do_personal(uuid)          from public, anon;
revoke all on function public.meus_personais()                 from public, anon;
revoke all on function public.excluir_minha_conta()            from public, anon;
revoke all on function public.alunos_antes_de_excluir()        from public, anon, authenticated;
revoke all on function public.criar_aluno_no_cadastro()        from public, anon, authenticated;

grant execute on function public.criar_convite(text, text)     to authenticated;
grant execute on function public.cancelar_convite(uuid)         to authenticated;
grant execute on function public.aceitar_convite(text)          to authenticated;
grant execute on function public.encerrar_vinculo(uuid)         to authenticated;
grant execute on function public.meus_alunos()                  to authenticated;
grant execute on function public.aluno_do_personal(uuid)        to authenticated;
grant execute on function public.meus_personais()               to authenticated;
grant execute on function public.excluir_minha_conta()          to authenticated;
-- ver_convite: também para quem ainda não tem conta (a página do convite abre antes do cadastro).
grant execute on function public.ver_convite(text)              to anon, authenticated;

commit;
