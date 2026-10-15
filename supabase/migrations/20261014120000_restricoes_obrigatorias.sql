-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel: restrições passam a ser OBRIGATÓRIAS no pedido.
--
-- Decisão de 14/10/2026 (ver docs/plano-perfil-e-privacidade.md):
-- • O aluno DECLARA suas restrições no perfil — inclusive "não tenho nenhuma".
--   A data da declaração fica guardada.
-- • Todo pedido leva a declaração e exige a confirmação "minhas restrições estão
--   atualizadas" (com data). Não existe mais "preferiu não compartilhar".
-- • Sem autorização de dados de saúde + declaração, não dá para enviar pedido.
-- • Continua valendo: a cópia das restrições em pedidos recusados/expirados é
--   apagada no dia seguinte.
--
-- Como aplicar: Supabase > SQL Editor > colar tudo > Run. Rodar UMA vez, depois
-- do arquivo 20261008170000_perfil_aluno_e_pedidos.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Declaração no perfil ─────────────────────────────────────────────────
-- restricoes = '' com data preenchida  → declarou NÃO ter restrições
-- data vazia (null)                    → ainda não declarou
alter table public.alunos_saude
  add column restricoes_declaradas_em timestamptz;

comment on column public.alunos_saude.restricoes_declaradas_em is
  'Quando o aluno declarou (ou atualizou) suas restrições. Nulo = ainda não declarou.';

-- ─── Confirmação no pedido ────────────────────────────────────────────────
alter table public.pedidos
  add column declarou_sem_restricoes   boolean,
  add column restricoes_confirmadas_em timestamptz;

comment on column public.pedidos.restricoes_confirmadas_em is
  'Quando o aluno confirmou, no pedido, que as restrições estavam atualizadas.';
comment on column public.pedidos.declarou_sem_restricoes is
  'Cópia de saúde: o aluno declarou não ter restrições. Apagada junto com o resto da cópia.';

-- ─── Enviar pedido (nova versão) ──────────────────────────────────────────
-- A versão antiga tinha "p_autorizar_restricoes" (opcional). Sai e entra
-- "p_confirmo_restricoes" (obrigatório).
drop function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean);

create function public.enviar_pedido(
  p_personal_slug         text,
  p_vezes_por_semana      integer,
  p_dias                  text[],
  p_periodos              text[],
  p_locais                text[],
  p_mensagem              text,
  p_confirmo_restricoes   boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno      uuid := auth.uid();
  v_restricoes text;
  v_declarada  timestamptz;
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

  if not public.tem_consentimento_saude(v_aluno) then
    raise exception 'Autorize os dados de saúde e declare suas restrições no perfil antes de enviar um pedido.';
  end if;

  select btrim(s.restricoes), s.restricoes_declaradas_em
    into v_restricoes, v_declarada
    from public.alunos_saude s
   where s.aluno_id = v_aluno;

  if v_declarada is null then
    raise exception 'Declare suas restrições no perfil antes de enviar um pedido.';
  end if;

  if not coalesce(p_confirmo_restricoes, false) then
    raise exception 'Confirme que suas restrições estão atualizadas.';
  end if;

  insert into public.pedidos (
    aluno_id, personal_slug, vezes_por_semana, dias, periodos, locais, mensagem,
    autorizou_restricoes, restricoes_compartilhadas, declarou_sem_restricoes, restricoes_confirmadas_em
  ) values (
    v_aluno, p_personal_slug, p_vezes_por_semana, p_dias, p_periodos, p_locais,
    nullif(btrim(p_mensagem), ''),
    true, nullif(v_restricoes, ''), v_restricoes = '', now()
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean) from public, anon;
grant execute on function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean) to authenticated;

-- ─── O que o personal vê (nova versão) ────────────────────────────────────
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
    'status',                    p.status,
    'primeiro_nome',             split_part(btrim(a.nome_completo), ' ', 1),
    'objetivo',                  a.objetivo,
    'nivel',                     a.nivel,
    'bairro',                    a.bairro,
    'mensagem',                  p.mensagem,
    'restricoes',                p.restricoes_compartilhadas,
    'sem_restricoes',            p.declarou_sem_restricoes,
    'restricoes_confirmadas_em', p.restricoes_confirmadas_em,
    'dados_saude_apagados',      p.dados_saude_apagados_em is not null,
    -- pedidos do formato antigo (antes de 14/10/2026):
    'autorizou_restricoes',      p.autorizou_restricoes
  );

  -- Depois do aceite: o perfil atual, enquanto houver autorização de saúde.
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
      'sem_restricoes', case when v_consentiu then s.restricoes_declaradas_em is not null and s.restricoes = '' end,
      'peso_kg',        s.peso_kg,
      'altura_cm',      s.altura_cm,
      'outras_medidas', nullif(s.outras_medidas, '')
    );
  end if;

  return r;
end
$$;

revoke all on function public.perfil_para_personal(uuid) from public, anon;
grant execute on function public.perfil_para_personal(uuid) to authenticated;

-- ─── Limpeza: também apaga a declaração "sem restrições" da cópia ─────────
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
         declarou_sem_restricoes = null,
         dados_saude_apagados_em = now()
   where status in ('recusado', 'expirado')
     and dados_saude_apagados_em is null
     and (decidido_em at time zone 'America/Sao_Paulo')::date
         < (now() at time zone 'America/Sao_Paulo')::date;
end
$$;

revoke all on function public.limpar_pedidos() from public, anon, authenticated;

-- ─── Retirar a autorização de saúde: também limpa a declaração dos pendentes ─
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
       set restricoes_compartilhadas = null,
           declarou_sem_restricoes = null
     where aluno_id = new.aluno_id and status = 'pendente';
  end if;

  return new;
end
$$;

revoke all on function public.consentimentos_antes_de_atualizar() from public, anon, authenticated;

commit;
