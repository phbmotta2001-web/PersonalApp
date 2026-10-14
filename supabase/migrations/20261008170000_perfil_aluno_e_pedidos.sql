-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel: perfil do aluno, dados de saúde, consentimentos e pedidos.
--
-- Regras (ver docs/plano-perfil-e-privacidade.md):
-- • Cadastro só para maiores de 18. Nome completo e data de nascimento são fixos
--   (só o suporte altera).
-- • Dados de saúde ficam numa tabela separada e só podem ser gravados com
--   consentimento ativo. Retirar o consentimento APAGA esses dados.
-- • Antes do aceite o personal vê: primeiro nome, objetivo, nível, bairro, a
--   mensagem do pedido e — só se o aluno autorizar — as restrições.
--   Depois do aceite vê o resto, exceto e-mail e data de nascimento (vê a idade).
-- • Pedido sem resposta expira em 24 h. A cópia de saúde de pedidos recusados ou
--   expirados é apagada no dia seguinte.
--
-- Como aplicar: Supabase > SQL Editor > colar tudo > Run. Rodar UMA vez.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada é criado.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Extensão para tarefas agendadas (limpeza diária) ─────────────────────
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- ─── Funções de apoio ─────────────────────────────────────────────────────
create or replace function public.tem_18_anos(p_nascimento date)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_nascimento <= (current_date - interval '18 years')::date
$$;

-- ═══ ALUNOS (parte não sensível do perfil) ═════════════════════════════════
create table public.alunos (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome_completo    text not null check (char_length(btrim(nome_completo)) between 2 and 120),
  data_nascimento  date not null,
  genero           text check (genero in ('feminino', 'masculino', 'outro', 'prefiro_nao_informar')),
  objetivo         text not null default '' check (char_length(objetivo) <= 300),
  nivel            text check (nivel in ('iniciante', 'intermediario', 'avancado')),
  cep              text check (cep is null or cep ~ '^\d{5}-?\d{3}$'),
  endereco         text check (endereco is null or char_length(endereco) <= 200),
  bairro           text check (bairro is null or char_length(bairro) <= 80),
  cidade           text check (cidade is null or char_length(cidade) <= 80),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.alunos is
  'Perfil do aluno. Nome completo e data de nascimento só mudam pelo suporte.';

-- Nome completo e data de nascimento ficam fixos para o próprio aluno.
create or replace function public.alunos_antes_de_atualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.id              is distinct from old.id
    or new.nome_completo   is distinct from old.nome_completo
    or new.data_nascimento is distinct from old.data_nascimento
    or new.criado_em       is distinct from old.criado_em
  ) then
    raise exception 'Nome completo e data de nascimento só podem ser alterados pelo suporte.';
  end if;
  new.atualizado_em := now();
  return new;
end
$$;

create trigger alunos_antes_de_atualizar
  before update on public.alunos
  for each row execute function public.alunos_antes_de_atualizar();

-- ═══ DADOS DE SAÚDE (sensíveis — LGPD art. 11) ═════════════════════════════
create table public.alunos_saude (
  aluno_id        uuid primary key references public.alunos (id) on delete cascade,
  restricoes      text not null default '' check (char_length(restricoes) <= 300),
  peso_kg         numeric(4, 1) check (peso_kg between 20 and 300),
  altura_cm       numeric(4, 1) check (altura_cm between 100 and 250),
  outras_medidas  text not null default '' check (char_length(outras_medidas) <= 300),
  atualizado_em   timestamptz not null default now()
);

comment on table public.alunos_saude is
  'Dados de saúde. Só existem com consentimento ativo; retirar o consentimento apaga a linha.';

create or replace function public.marcar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

create trigger alunos_saude_antes_de_atualizar
  before update on public.alunos_saude
  for each row execute function public.marcar_atualizado_em();

-- ═══ CONSENTIMENTOS ════════════════════════════════════════════════════════
create table public.consentimentos (
  id            bigint generated always as identity primary key,
  aluno_id      uuid not null references public.alunos (id) on delete cascade,
  tipo          text not null check (tipo in ('dados_saude')),
  versao_texto  text not null check (char_length(versao_texto) between 1 and 50),
  aceito_em     timestamptz not null default now(),
  revogado_em   timestamptz
);

comment on table public.consentimentos is
  'Registro de quando o aluno consentiu (e com qual versão do texto) e quando retirou.';

-- No máximo um consentimento ativo por tipo.
create unique index consentimentos_um_ativo_por_tipo
  on public.consentimentos (aluno_id, tipo)
  where revogado_em is null;

-- Consulta usada pelas regras de segurança (roda com os direitos de quem chama).
create or replace function public.tem_consentimento_saude(p_aluno uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.consentimentos c
    where c.aluno_id = p_aluno and c.tipo = 'dados_saude' and c.revogado_em is null
  )
$$;

-- Um consentimento só pode ser RETIRADO (nunca editado). Ao retirar o de saúde,
-- os dados de saúde do perfil e as restrições de pedidos pendentes são apagados.
create or replace function public.consentimentos_antes_de_atualizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.revogado_em is not null
     or new.revogado_em is null
     or new.aluno_id     <> old.aluno_id
     or new.tipo         <> old.tipo
     or new.versao_texto <> old.versao_texto
     or new.aceito_em    <> old.aceito_em then
    raise exception 'Um consentimento só pode ser retirado. Para consentir de novo, registre um novo.';
  end if;

  new.revogado_em := now();

  if new.tipo = 'dados_saude' then
    delete from public.alunos_saude where aluno_id = new.aluno_id;
    update public.pedidos
       set restricoes_compartilhadas = null
     where aluno_id = new.aluno_id and status = 'pendente';
  end if;

  return new;
end
$$;

-- ═══ PEDIDOS ═══════════════════════════════════════════════════════════════
create table public.pedidos (
  id                        uuid primary key default gen_random_uuid(),
  aluno_id                  uuid not null references public.alunos (id) on delete cascade,
  -- Os personais ainda são dados de exemplo no código; por isso o "slug".
  personal_slug             text not null check (personal_slug ~ '^[a-z0-9-]{1,80}$'),
  -- Conta do personal, quando as contas de personal existirem.
  personal_usuario_id       uuid references auth.users (id) on delete set null,
  status                    text not null default 'pendente'
                              check (status in ('pendente', 'aceito', 'recusado', 'expirado')),
  vezes_por_semana          integer not null check (vezes_por_semana between 1 and 7),
  dias                      text[] not null check (
                              cardinality(dias) between 1 and 7
                              and dias <@ array['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']),
  periodos                  text[] not null check (
                              cardinality(periodos) between 1 and 3
                              and periodos <@ array['Manhã, 6h–9h', 'Almoço', 'Noite']),
  locais                    text[] not null check (
                              cardinality(locais) between 1 and 4
                              and locais <@ array['casa', 'ar-livre', 'academia', 'online']),
  -- CÓPIA DE SAÚDE (apagada no dia seguinte a uma recusa ou expiração):
  mensagem                  text check (mensagem is null or char_length(mensagem) <= 200),
  autorizou_restricoes      boolean not null default false,
  restricoes_compartilhadas text check (restricoes_compartilhadas is null or autorizou_restricoes),
  criado_em                 timestamptz not null default now(),
  expira_em                 timestamptz not null default now() + interval '24 hours',
  decidido_em               timestamptz,
  dados_saude_apagados_em   timestamptz
);

comment on table public.pedidos is
  'Pedidos de aula. Mensagem e restrições são uma cópia do envio, apagada no dia seguinte a recusa/expiração.';

create index pedidos_por_aluno on public.pedidos (aluno_id, criado_em desc);
create index pedidos_pendentes on public.pedidos (expira_em) where status = 'pendente';
create index pedidos_para_limpeza on public.pedidos (decidido_em)
  where dados_saude_apagados_em is null and status in ('recusado', 'expirado');

-- O gatilho de consentimentos usa a tabela pedidos, então é criado depois dela.
create trigger consentimentos_antes_de_atualizar
  before update on public.consentimentos
  for each row execute function public.consentimentos_antes_de_atualizar();

-- ═══ CADASTRO: cria o perfil quando a conta é criada ═══════════════════════
-- O site envia nome_completo, data_nascimento, genero e (se marcado)
-- consentimento_saude_versao junto com o cadastro.
create or replace function public.criar_aluno_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nascimento date;
begin
  -- Contas de personal (no futuro) terão outro tipo e não viram aluno.
  if coalesce(m ->> 'tipo_conta', 'aluno') <> 'aluno' then
    return new;
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

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_aluno_no_cadastro();

-- ═══ ENVIAR PEDIDO ═════════════════════════════════════════════════════════
-- Única forma de criar um pedido. A cópia das restrições vem do PERFIL guardado
-- (nunca do navegador) e só se o aluno autorizou e tem consentimento ativo.
create or replace function public.enviar_pedido(
  p_personal_slug        text,
  p_vezes_por_semana     integer,
  p_dias                 text[],
  p_periodos             text[],
  p_locais               text[],
  p_mensagem             text,
  p_autorizar_restricoes boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno      uuid := auth.uid();
  v_restricoes text;
  v_id         uuid;
begin
  if v_aluno is null then
    raise exception 'É preciso entrar na sua conta para enviar um pedido.';
  end if;

  if not exists (
    select 1 from public.alunos a
    where a.id = v_aluno and btrim(a.objetivo) <> '' and a.nivel is not null
  ) then
    raise exception 'Preencha seu objetivo e seu nível no perfil antes de enviar um pedido.';
  end if;

  if coalesce(p_autorizar_restricoes, false) then
    select nullif(btrim(s.restricoes), '') into v_restricoes
      from public.alunos_saude s
     where s.aluno_id = v_aluno
       and public.tem_consentimento_saude(v_aluno);
  end if;

  insert into public.pedidos (
    aluno_id, personal_slug, vezes_por_semana, dias, periodos, locais,
    mensagem, autorizou_restricoes, restricoes_compartilhadas
  ) values (
    v_aluno, p_personal_slug, p_vezes_por_semana, p_dias, p_periodos, p_locais,
    nullif(btrim(p_mensagem), ''), coalesce(p_autorizar_restricoes, false), v_restricoes
  )
  returning id into v_id;

  return v_id;
end
$$;

-- ═══ O QUE O PERSONAL VÊ (controle de visibilidade) ════════════════════════
-- Toda tela do personal deve usar SÓ esta função. O próprio aluno também pode
-- chamá-la para ver "como o personal vê o meu pedido".
create or replace function public.perfil_para_personal(p_pedido uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p           public.pedidos;
  a           public.alunos;
  s           public.alunos_saude;
  v_consentiu boolean;
  r           jsonb;
begin
  select * into p from public.pedidos where id = p_pedido;
  if not found then
    return null;
  end if;

  if auth.uid() is distinct from p.aluno_id
     and auth.uid() is distinct from p.personal_usuario_id then
    raise exception 'Sem permissão para ver este pedido.';
  end if;

  select * into a from public.alunos where id = p.aluno_id;

  -- Antes do aceite (e em pedidos recusados/expirados, até a limpeza):
  r := jsonb_build_object(
    'status',               p.status,
    'primeiro_nome',        split_part(btrim(a.nome_completo), ' ', 1),
    'objetivo',             a.objetivo,
    'nivel',                a.nivel,
    'bairro',               a.bairro,
    'mensagem',             p.mensagem,
    'autorizou_restricoes', p.autorizou_restricoes,
    'restricoes',           p.restricoes_compartilhadas
  );

  -- Depois do aceite:
  if p.status = 'aceito' then
    v_consentiu := public.tem_consentimento_saude(a.id);
    if v_consentiu then
      select * into s from public.alunos_saude where aluno_id = a.id;
    end if;

    r := r || jsonb_build_object(
      'nome_completo',  a.nome_completo,
      'idade',          date_part('year', age(a.data_nascimento))::int,
      'genero',         a.genero,
      'cep',            a.cep,
      'endereco',       a.endereco,
      'cidade',         a.cidade,
      'restricoes',     case when v_consentiu then nullif(s.restricoes, '') end,
      'peso_kg',        s.peso_kg,
      'altura_cm',      s.altura_cm,
      'outras_medidas', nullif(s.outras_medidas, '')
    );
  end if;

  return r;
end
$$;

-- ═══ LIMPEZA AUTOMÁTICA (de hora em hora) ══════════════════════════════════
-- 1. Pedidos pendentes há mais de 24 h viram "expirado".
-- 2. A cópia de saúde de pedidos recusados/expirados é apagada a partir do dia
--    seguinte à decisão (horário de Brasília). Prometido ao aluno: "em até 30 dias".
create or replace function public.limpar_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pedidos
     set status = 'expirado', decidido_em = now()
   where status = 'pendente' and expira_em <= now();

  update public.pedidos
     set mensagem = null,
         restricoes_compartilhadas = null,
         dados_saude_apagados_em = now()
   where status in ('recusado', 'expirado')
     and dados_saude_apagados_em is null
     and (decidido_em at time zone 'America/Sao_Paulo')::date
         < (now() at time zone 'America/Sao_Paulo')::date;
end
$$;

select cron.schedule('pienel-limpar-pedidos', '0 * * * *', $$select public.limpar_pedidos()$$);

-- ═══ SEGURANÇA POR LINHA (RLS) ═════════════════════════════════════════════
alter table public.alunos         enable row level security;
alter table public.alunos_saude   enable row level security;
alter table public.consentimentos enable row level security;
alter table public.pedidos        enable row level security;

-- alunos: cada um vê e edita só o próprio perfil. Criação só pelo cadastro.
create policy "aluno vê o próprio perfil" on public.alunos
  for select to authenticated using ((select auth.uid()) = id);
create policy "aluno edita o próprio perfil" on public.alunos
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- alunos_saude: só o próprio aluno; gravar exige consentimento ativo.
create policy "aluno vê os próprios dados de saúde" on public.alunos_saude
  for select to authenticated using ((select auth.uid()) = aluno_id);
create policy "aluno grava dados de saúde com consentimento" on public.alunos_saude
  for insert to authenticated
  with check ((select auth.uid()) = aluno_id and public.tem_consentimento_saude(aluno_id));
create policy "aluno edita dados de saúde com consentimento" on public.alunos_saude
  for update to authenticated
  using ((select auth.uid()) = aluno_id)
  with check ((select auth.uid()) = aluno_id and public.tem_consentimento_saude(aluno_id));
create policy "aluno apaga os próprios dados de saúde" on public.alunos_saude
  for delete to authenticated using ((select auth.uid()) = aluno_id);

-- consentimentos: ver, dar e retirar os próprios (o gatilho impede editar).
create policy "aluno vê os próprios consentimentos" on public.consentimentos
  for select to authenticated using ((select auth.uid()) = aluno_id);
create policy "aluno dá consentimento" on public.consentimentos
  for insert to authenticated
  with check ((select auth.uid()) = aluno_id and revogado_em is null);
create policy "aluno retira consentimento" on public.consentimentos
  for update to authenticated
  using ((select auth.uid()) = aluno_id) with check ((select auth.uid()) = aluno_id);

-- pedidos: o aluno vê os seus; o personal (no futuro) os dele. Ninguém cria,
-- edita ou apaga direto: só pelas funções acima.
create policy "aluno e personal veem seus pedidos" on public.pedidos
  for select to authenticated
  using ((select auth.uid()) = aluno_id or (select auth.uid()) = personal_usuario_id);

-- ─── Quem pode chamar cada função ─────────────────────────────────────────
revoke all on function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean) from public, anon;
grant execute on function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean) to authenticated;

revoke all on function public.perfil_para_personal(uuid) from public, anon;
grant execute on function public.perfil_para_personal(uuid) to authenticated;

revoke all on function public.limpar_pedidos() from public, anon, authenticated;
revoke all on function public.criar_aluno_no_cadastro() from public, anon, authenticated;
revoke all on function public.consentimentos_antes_de_atualizar() from public, anon, authenticated;

commit;
