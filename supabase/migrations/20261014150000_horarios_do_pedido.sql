-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel: o pedido passa a guardar HORÁRIOS da agenda do personal.
--
-- Decisão de 14/10/2026 (ver docs/plano-perfil-e-privacidade.md e src/lib/agenda.ts):
-- • Sai "dias + períodos (Manhã, Almoço, Noite)". Entra a lista de horários
--   escolhidos na agenda livre do personal, ex.: {"Seg 07:00","Qua 07:00"}.
-- • Aulas de 1 hora, começando em hora cheia, entre 06:00 e 21:00.
-- • Exatamente tantos horários quanto o plano (4x = 4), no máximo um por dia.
-- • O pedido NÃO reserva o horário: ele só fica do aluno quando o personal aceitar.
--   (Se o horário está mesmo livre na agenda é conferido pelo site, porque a agenda
--   dos personais ainda está nos dados de exemplo, fora do banco.)
-- • Pedidos antigos continuam com dias/períodos.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261014120000_restricoes_obrigatorias.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Regra dos horários ───────────────────────────────────────────────────
create function public.horarios_validos(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is not null
     and cardinality(p) between 1 and 7
     and (select bool_and(h ~ '^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom) (0[6-9]|1[0-9]|2[01]):00$') from unnest(p) as h)
     and (select count(distinct split_part(h, ' ', 1)) from unnest(p) as h) = cardinality(p)
$$;

comment on function public.horarios_validos(text[]) is
  'Horários no formato "Seg 07:00", entre 06:00 e 21:00, no máximo um por dia.';

-- ─── Colunas do pedido ────────────────────────────────────────────────────
alter table public.pedidos
  add column horarios text[]
    check (horarios is null or (public.horarios_validos(horarios) and cardinality(horarios) = vezes_por_semana));

comment on column public.pedidos.horarios is
  'Horários escolhidos na agenda do personal (um por dia, quantidade = vezes_por_semana).';

-- Dias e períodos ficam só para os pedidos antigos.
alter table public.pedidos
  alter column dias drop not null,
  alter column periodos drop not null;

-- ─── Enviar pedido (nova versão: horários no lugar de dias + períodos) ────
drop function public.enviar_pedido(text, integer, text[], text[], text[], text, boolean);

create function public.enviar_pedido(
  p_personal_slug         text,
  p_vezes_por_semana      integer,
  p_horarios              text[],
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

  if not public.horarios_validos(p_horarios) or cardinality(p_horarios) <> p_vezes_por_semana then
    raise exception 'Escolha um horário por dia, na mesma quantidade de aulas do plano.';
  end if;

  insert into public.pedidos (
    aluno_id, personal_slug, vezes_por_semana, horarios, locais, mensagem,
    autorizou_restricoes, restricoes_compartilhadas, declarou_sem_restricoes, restricoes_confirmadas_em
  ) values (
    v_aluno, p_personal_slug, p_vezes_por_semana, p_horarios, p_locais,
    nullif(btrim(p_mensagem), ''),
    true, nullif(v_restricoes, ''), v_restricoes = '', now()
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.enviar_pedido(text, integer, text[], text[], text, boolean) from public, anon;
grant execute on function public.enviar_pedido(text, integer, text[], text[], text, boolean) to authenticated;

-- ─── O que o personal vê: agora com plano, horários e locais ──────────────
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
    'vezes_por_semana',          p.vezes_por_semana,
    'horarios',                  p.horarios,
    'locais',                    p.locais,
    'mensagem',                  p.mensagem,
    'restricoes',                p.restricoes_compartilhadas,
    'sem_restricoes',            p.declarou_sem_restricoes,
    'restricoes_confirmadas_em', p.restricoes_confirmadas_em,
    'dados_saude_apagados',      p.dados_saude_apagados_em is not null,
    -- pedidos do formato antigo:
    'dias',                      p.dias,
    'periodos',                  p.periodos,
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

commit;
