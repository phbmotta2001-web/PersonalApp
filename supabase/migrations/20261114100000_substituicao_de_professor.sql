-- 44 · Substituição de professor (decisão 79), sobre a reposição da migração 37.
--
-- 1. Ao marcar férias ou falta, a coordenação é avisada na hora (e o professor, quando foi a
--    coordenação que marcou por ele).
-- 2. Quem é chamado vê os horários com caixinhas, o valor de cada um e o total: confirma os que
--    pode (de uma vez) ou recusa. Os horários que sobram continuam abertos para os outros.
-- 3. Quem faltou e a coordenação são avisados quando alguém confirma; quem pediu, quando alguém recusa.

begin;

-- Quem pediu a reposição (recebe o aviso de recusa).
alter table public.estudio_ausencias add column pedido_por uuid references public.personais (id) on delete set null;

-- Quem recusou cobrir uma ausência (o pedido some para ele).
create table public.estudio_reposicao_recusas (
  ausencia_id  uuid not null references public.estudio_ausencias (id) on delete cascade,
  personal_id  uuid not null references public.personais (id) on delete cascade,
  recusada_em  timestamptz not null default now(),
  primary key (ausencia_id, personal_id)
);
alter table public.estudio_reposicao_recusas enable row level security;

-- Avisa a coordenação do estúdio (menos quem está na lista de exceção).
create or replace function public.avisar_coordenacao(p_estudio uuid, p_titulo text, p_corpo text, p_url text, p_exceto uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c uuid;
begin
  for c in
    select m.personal_id from public.estudio_membros m
     where m.estudio_id = p_estudio and m.papel = 'coordenacao' and not (m.personal_id = any (coalesce(p_exceto, '{}')))
  loop
    perform public.notificar(c, 'reposicao_estudio', p_titulo, p_corpo, p_url, now(), null, null, null, null, null, false);
  end loop;
end
$$;

-- Texto curto das datas de uma ausência: "12/11" ou "12/11 a 20/11".
create or replace function public.periodo_da_ausencia(p_de date, p_ate date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_de = p_ate then to_char(p_de, 'DD/MM') else to_char(p_de, 'DD/MM') || ' a ' || to_char(p_ate, 'DD/MM') end;
$$;

create or replace function public.marcar_ausencia(p_estudio uuid, p_personal uuid, p_tipo text, p_de date, p_ate date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v     uuid;
  n     integer;
  nome  text;
  texto text;
begin
  if not (public.coordena_estudio(p_estudio) or (p_personal = auth.uid() and public.papel_no_estudio(p_estudio) is not null)) then
    raise exception 'Só a coordenação marca férias ou falta de outro professor.';
  end if;
  if not exists (select 1 from public.estudio_membros where estudio_id = p_estudio and personal_id = p_personal) then
    raise exception 'Este professor não é da equipe do estúdio.';
  end if;
  if p_tipo not in ('ferias', 'falta') then
    raise exception 'Escolha férias ou falta.';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Confira as datas: o fim precisa ser depois do início.';
  end if;
  if p_ate < public.hoje_brasilia() then
    raise exception 'Escolha datas a partir de hoje.';
  end if;
  if p_ate - p_de > 120 then
    raise exception 'O período pode ter até 120 dias.';
  end if;
  insert into public.estudio_ausencias (estudio_id, personal_id, tipo, de, ate, criado_por)
  values (p_estudio, p_personal, p_tipo, p_de, p_ate, auth.uid())
  returning id into v;
  update public.aulas_turma
     set professor_id = null, ausencia_id = v
   where estudio_id = p_estudio and professor_id = p_personal and situacao = 'agendada' and inicio > now()
     and (inicio at time zone 'America/Sao_Paulo')::date between p_de and p_ate;
  get diagnostics n = row_count;

  -- Decisão 79: a coordenação fica sabendo na hora.
  select split_part(btrim(nome_completo), ' ', 1) into nome from public.personais where id = p_personal;
  texto := (case when p_tipo = 'falta' then 'Falta' else 'Férias' end) || ' em ' || public.periodo_da_ausencia(p_de, p_ate) || ' · '
           || case when n = 0 then 'nenhuma aula para repor.' when n = 1 then '1 aula sem professor.' else n || ' aulas sem professor.' end;
  perform public.avisar_coordenacao(p_estudio, nome || (case when p_tipo = 'falta' then ' vai faltar' else ' vai sair de férias' end),
                                    texto, '/agenda/estudio/' || p_estudio, array[auth.uid(), p_personal]);
  if p_personal <> auth.uid() then
    perform public.notificar(p_personal, 'reposicao_estudio', 'A coordenação marcou ' || (case when p_tipo = 'falta' then 'sua falta' else 'suas férias' end),
                             texto, '/agenda/estudio/' || p_estudio, now(), null, null, null, null, null, false);
  end if;
  return public.resumo_ausencia(v);
end
$$;

-- Resumo para a equipe (botão "Pedir reposição" na lista de férias e faltas).
create or replace function public.resumo_da_ausencia(p_ausencia uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  au public.estudio_ausencias;
begin
  select * into au from public.estudio_ausencias where id = p_ausencia;
  if not found or au.cancelada_em is not null or not (public.coordena_estudio(au.estudio_id) or au.personal_id = auth.uid()) then
    raise exception 'Ausência não encontrada.';
  end if;
  return public.resumo_ausencia(p_ausencia);
end
$$;

-- Como na 37, guardando quem pediu; chamar alguém que tinha recusado mostra o pedido de novo para ele.
create or replace function public.pedir_reposicao(p_ausencia uuid, p_professor uuid)
returns table (personal_id uuid, nome text, whatsapp text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  au      public.estudio_ausencias;
  r       jsonb;
  n       integer;
  total   integer;
  dias    text;
  estnome text;
  ausente text;
begin
  select * into au from public.estudio_ausencias where id = p_ausencia;
  if not found or au.cancelada_em is not null or not (public.coordena_estudio(au.estudio_id) or au.personal_id = auth.uid()) then
    raise exception 'Ausência não encontrada.';
  end if;
  if p_professor is not null and (p_professor = au.personal_id or not exists (
      select 1 from public.estudio_membros m where m.estudio_id = au.estudio_id and m.personal_id = p_professor)) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  r := public.resumo_ausencia(p_ausencia);
  select count(*), coalesce(sum((x ->> 'valor')::integer), 0),
         string_agg(distinct to_char(((x ->> 'inicio')::timestamptz at time zone 'America/Sao_Paulo')::date, 'DD/MM'), ', ')
    into n, total, dias
    from jsonb_array_elements(r -> 'aulas') x where not (x ->> 'assumida')::boolean;
  if n = 0 then
    raise exception 'Não há aulas para repor neste período.';
  end if;
  select e.nome into estnome from public.estudios e where e.id = au.estudio_id;
  select split_part(btrim(p.nome_completo), ' ', 1) into ausente from public.personais p where p.id = au.personal_id;
  update public.estudio_ausencias set avisado_em = now(), pedido_por = auth.uid() where id = p_ausencia;
  if p_professor is not null then
    delete from public.estudio_reposicao_recusas rr where rr.ausencia_id = p_ausencia and rr.personal_id = p_professor;
  end if;

  return query
  with quem as (
    select m.personal_id from public.estudio_membros m
     where m.estudio_id = au.estudio_id and m.personal_id <> au.personal_id and m.personal_id <> auth.uid()
       and (p_professor is null and m.papel = 'professor' or m.personal_id = p_professor)
       and not (p_professor is null and exists (
             select 1 from public.estudio_reposicao_recusas rr where rr.ausencia_id = p_ausencia and rr.personal_id = m.personal_id))
  ), avisos as (
    select q.personal_id,
           public.notificar(q.personal_id, 'reposicao_estudio',
             ausente || ' precisa de substituição · ' || estnome,
             n || (case when n = 1 then ' aula' else ' aulas' end) || ' (' || dias || ') · R$ '
               || replace(to_char(total / 100.0, 'FM9999990D00'), '.', ',') || '. Toque para ver os horários e confirmar.',
             '/agenda/estudio/' || au.estudio_id, now(), null, null, null, null, null, false) as ok
      from quem q
  )
  select a.personal_id, pe.nome_completo, pe.whatsapp
    from avisos a join public.personais pe on pe.id = a.personal_id
   order by pe.nome_completo;
end
$$;

-- Reposições ainda sem professor, agora com a ausência (para agrupar o pedido) e sem as que eu recusei.
drop function public.reposicoes_abertas(uuid);
create function public.reposicoes_abertas(p_estudio uuid)
returns table (aula_id uuid, ausencia_id uuid, inicio timestamptz, fim timestamptz, modalidade text, tipo text, valor_centavos integer, ausente text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.papel_no_estudio(p_estudio) is null then
    return;
  end if;
  return query
  select a.id, au.id, a.inicio, a.fim, t.modalidade, t.tipo, public.valor_reposicao(a.id), pe.nome_completo
    from public.aulas_turma a
    join public.turmas t on t.id = a.turma_id
    join public.estudio_ausencias au on au.id = a.ausencia_id
    join public.personais pe on pe.id = au.personal_id
   where a.estudio_id = p_estudio and a.professor_id is null and a.situacao = 'agendada'
     and a.inicio > now() and au.cancelada_em is null and au.personal_id <> auth.uid()
     and not exists (select 1 from public.estudio_reposicao_recusas rr where rr.ausencia_id = au.id and rr.personal_id = auth.uid())
   order by a.inicio;
end
$$;

-- Confirma de uma vez os horários marcados. Quem confirmar primeiro fica com cada aula; as que outro
-- já pegou são puladas (e contadas). Avisa quem faltou e a coordenação.
create or replace function public.assumir_reposicoes(p_aulas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        public.aulas_turma;
  au       public.estudio_ausencias;
  id_aula  uuid;
  pegas    integer := 0;
  perdidas integer := 0;
  eu       text;
  quem     text;
  dias     text;
  n        integer;
  resto    integer;
  texto    text;
  minhas   uuid[] := '{}';
begin
  if p_aulas is null or cardinality(p_aulas) = 0 then
    raise exception 'Marque pelo menos um horário.';
  end if;
  if cardinality(p_aulas) > 200 then
    raise exception 'Muitos horários de uma vez.';
  end if;
  for id_aula in select x from unnest(p_aulas) x
  loop
    select * into a from public.aulas_turma where id = id_aula for update;
    if not found or public.papel_no_estudio(a.estudio_id) is null then
      raise exception 'Aula não encontrada.';
    end if;
    select * into au from public.estudio_ausencias where id = a.ausencia_id;
    if au.id is null or au.cancelada_em is not null or a.situacao <> 'agendada' or a.inicio <= now() or a.professor_id is not null then
      perdidas := perdidas + 1;
      continue;
    end if;
    if au.personal_id = auth.uid() then
      raise exception 'Esta aula é sua: para voltar a dá-la, desmarque a ausência.';
    end if;
    update public.aulas_turma set professor_id = auth.uid() where id = id_aula;
    if (select professor_id from public.aulas_turma where id = id_aula) is null then
      raise exception 'Você está de férias ou falta em %.', to_char((a.inicio at time zone 'America/Sao_Paulo')::date, 'DD/MM');
    end if;
    pegas := pegas + 1;
    minhas := minhas || id_aula;
  end loop;

  select split_part(btrim(nome_completo), ' ', 1) into eu from public.personais where id = auth.uid();
  -- Um aviso por ausência coberta.
  for au in
    select distinct x.* from public.estudio_ausencias x join public.aulas_turma t on t.ausencia_id = x.id where t.id = any (minhas)
  loop
    select count(*), string_agg(distinct to_char((t.inicio at time zone 'America/Sao_Paulo')::date, 'DD/MM'), ', ')
      into n, dias from public.aulas_turma t where t.id = any (minhas) and t.ausencia_id = au.id;
    select count(*) into resto from public.aulas_turma t
     where t.ausencia_id = au.id and t.professor_id is null and t.situacao = 'agendada' and t.inicio > now();
    select split_part(btrim(nome_completo), ' ', 1) into quem from public.personais where id = au.personal_id;
    texto := eu || ' vai cobrir ' || n || (case when n = 1 then ' aula' else ' aulas' end) || ' (' || dias || ')'
             || case when resto = 0 then '. Todas cobertas.' when resto = 1 then '. Ainda falta 1.' else '. Ainda faltam ' || resto || '.' end;
    perform public.notificar(au.personal_id, 'reposicao_estudio', 'Substituição confirmada', texto,
                             '/agenda/estudio/' || au.estudio_id, now(), null, null, null, null, null, false);
    perform public.avisar_coordenacao(au.estudio_id, 'Substituição de ' || quem, texto, '/agenda/estudio/' || au.estudio_id,
                                      array[auth.uid(), au.personal_id]);
  end loop;
  return jsonb_build_object('assumidas', pegas, 'ja_pegas', perdidas);
end
$$;

-- Recusa o pedido: some para quem recusou e quem pediu fica sabendo.
create or replace function public.recusar_reposicao(p_ausencia uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  au   public.estudio_ausencias;
  eu   text;
  quem text;
begin
  select * into au from public.estudio_ausencias where id = p_ausencia;
  if not found or au.cancelada_em is not null or public.papel_no_estudio(au.estudio_id) is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if au.personal_id = auth.uid() then
    raise exception 'Este pedido é seu.';
  end if;
  insert into public.estudio_reposicao_recusas (ausencia_id, personal_id) values (p_ausencia, auth.uid())
  on conflict do nothing;
  if not found then
    return;
  end if;
  select split_part(btrim(nome_completo), ' ', 1) into eu from public.personais where id = auth.uid();
  select split_part(btrim(nome_completo), ' ', 1) into quem from public.personais where id = au.personal_id;
  perform public.notificar(coalesce(au.pedido_por, au.personal_id), 'reposicao_estudio', eu || ' não pode substituir',
                           eu || ' recusou cobrir ' || (case when au.tipo = 'falta' then 'a falta' else 'as férias' end) || ' de ' || quem
                             || ' (' || public.periodo_da_ausencia(au.de, au.ate) || ').',
                           '/agenda/estudio/' || au.estudio_id, now(), null, null, null, null, null, false);
end
$$;

revoke all on function public.avisar_coordenacao(uuid, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.periodo_da_ausencia(date, date)                  from public, anon;
revoke all on function public.resumo_da_ausencia(uuid)                          from public, anon;
revoke all on function public.reposicoes_abertas(uuid)                          from public, anon;
revoke all on function public.assumir_reposicoes(uuid[])                        from public, anon;
revoke all on function public.recusar_reposicao(uuid)                           from public, anon;
grant execute on function public.resumo_da_ausencia(uuid)   to authenticated;
grant execute on function public.reposicoes_abertas(uuid)   to authenticated;
grant execute on function public.assumir_reposicoes(uuid[]) to authenticated;
grant execute on function public.recusar_reposicao(uuid)    to authenticated;

commit;
