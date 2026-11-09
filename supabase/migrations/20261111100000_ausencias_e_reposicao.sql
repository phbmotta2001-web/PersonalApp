-- 37 · Férias e faltas dos professores do estúdio, e a reposição (decisão 60).
--
-- A coordenação marca férias ou falta de qualquer professor; o professor marca as próprias.
-- As aulas e turnos do período ficam "sem professor" e viram reposições abertas: os outros
-- professores da equipe são avisados (notificação e WhatsApp) e quem assumir primeiro fica
-- com a aula, recebendo o valor de reposição do estúdio (por hora ou por aluno presente).

begin;

-- ─── Valor da reposição (cadastro do estúdio) ─────────────────────────────
alter table public.estudios
  add column reposicao_modelo text not null default 'hora' check (reposicao_modelo in ('hora', 'por_aluno')),
  add column reposicao_valor_centavos integer check (reposicao_valor_centavos between 0 and 10000000),
  -- Para o lançamento: professores de fora da equipe também poderão repor (ainda não usado).
  add column reposicao_externos boolean not null default false;

-- ─── Férias e faltas ──────────────────────────────────────────────────────
create table public.estudio_ausencias (
  id           uuid primary key default gen_random_uuid(),
  estudio_id   uuid not null references public.estudios (id) on delete cascade,
  personal_id  uuid not null references public.personais (id) on delete cascade,
  tipo         text not null check (tipo in ('ferias', 'falta')),
  de           date not null,
  ate          date not null,
  criado_por   uuid references public.personais (id) on delete set null,
  criado_em    timestamptz not null default now(),
  avisado_em   timestamptz,
  cancelada_em timestamptz,
  check (ate >= de and ate - de <= 120)
);
create index estudio_ausencias_por_estudio on public.estudio_ausencias (estudio_id, de);

alter table public.estudio_ausencias enable row level security;
create policy "equipe vê as ausências do estúdio" on public.estudio_ausencias
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

-- Aula que ficou sem o professor por férias/falta (reposição); fica marcada depois de assumida.
alter table public.aulas_turma add column ausencia_id uuid references public.estudio_ausencias (id) on delete set null;
create index aulas_turma_por_ausencia on public.aulas_turma (ausencia_id) where ausencia_id is not null;

-- Aulas futuras de quem está de férias/falta ficam sem professor (inclusive as geradas depois).
create or replace function public.aula_turma_respeita_ausencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if new.professor_id is null or new.situacao <> 'agendada' or new.inicio <= now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.professor_id is not distinct from old.professor_id then
    return new;
  end if;
  select id into v from public.estudio_ausencias
   where estudio_id = new.estudio_id and personal_id = new.professor_id and cancelada_em is null
     and (new.inicio at time zone 'America/Sao_Paulo')::date between de and ate
   limit 1;
  if v is not null then
    new.professor_id := null;
    new.ausencia_id := v;
  end if;
  return new;
end
$$;

create trigger aulas_turma_respeita_ausencia
  before insert or update of professor_id on public.aulas_turma
  for each row execute function public.aula_turma_respeita_ausencia();

-- Valor previsto da reposição de uma aula (por aluno: alunos da turma hoje).
create or replace function public.valor_reposicao(p_aula uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (case
            when t.tipo = 'turma' and e.reposicao_modelo = 'por_aluno'
              then (select count(*) from public.turma_alunos ta
                      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
                     where ta.turma_id = t.id) * coalesce(e.reposicao_valor_centavos, 0)
            else round(extract(epoch from a.fim - a.inicio) / 3600.0
                       * coalesce(case when e.reposicao_modelo = 'hora' then e.reposicao_valor_centavos end, e.valor_hora_centavos, 0))
          end)::integer
    from public.aulas_turma a
    join public.turmas t on t.id = a.turma_id
    join public.estudios e on e.id = a.estudio_id
   where a.id = p_aula;
$$;

create or replace function public.salvar_reposicao_estudio(p_estudio uuid, p_modelo text, p_valor integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda o valor da reposição.';
  end if;
  if p_modelo not in ('hora', 'por_aluno') then
    raise exception 'Escolha por hora ou por aluno.';
  end if;
  if p_valor is null or p_valor < 0 or p_valor > 10000000 then
    raise exception 'Informe o valor da reposição.';
  end if;
  update public.estudios set reposicao_modelo = p_modelo, reposicao_valor_centavos = p_valor where id = p_estudio;
end
$$;

-- Resumo de uma ausência: as aulas que ficaram sem professor e o valor de cada uma.
create or replace function public.resumo_ausencia(p_ausencia uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', au.id, 'estudio_id', au.estudio_id, 'personal_id', au.personal_id,
    'nome', pe.nome_completo, 'tipo', au.tipo, 'de', au.de, 'ate', au.ate,
    'aulas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'inicio', a.inicio, 'fim', a.fim, 'modalidade', t.modalidade, 'tipo', t.tipo,
               'valor', public.valor_reposicao(a.id), 'assumida', a.professor_id is not null)
             order by a.inicio)
        from public.aulas_turma a join public.turmas t on t.id = a.turma_id
       where a.ausencia_id = au.id and a.situacao = 'agendada' and a.inicio > now()), '[]'::jsonb))
    from public.estudio_ausencias au
    join public.personais pe on pe.id = au.personal_id
   where au.id = p_ausencia;
$$;

create or replace function public.marcar_ausencia(p_estudio uuid, p_personal uuid, p_tipo text, p_de date, p_ate date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
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
  return public.resumo_ausencia(v);
end
$$;

-- Desfaz: as aulas que ninguém assumiu voltam para o professor.
create or replace function public.cancelar_ausencia(p_ausencia uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  au public.estudio_ausencias;
begin
  select * into au from public.estudio_ausencias where id = p_ausencia for update;
  if not found or not (public.coordena_estudio(au.estudio_id) or au.personal_id = auth.uid()) then
    raise exception 'Ausência não encontrada.';
  end if;
  update public.estudio_ausencias set cancelada_em = now() where id = p_ausencia;
  update public.aulas_turma
     set professor_id = au.personal_id, ausencia_id = null
   where ausencia_id = p_ausencia and professor_id is null and inicio > now();
end
$$;

-- Avisa os outros professores da equipe (p_professor nulo) ou um professor específico.
-- Devolve quem foi avisado (nome e WhatsApp), para a tela montar os links do WhatsApp.
create or replace function public.pedir_reposicao(p_ausencia uuid, p_professor uuid)
returns table (personal_id uuid, nome text, whatsapp text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  au     public.estudio_ausencias;
  r      jsonb;
  n      integer;
  total  integer;
  dias   text;
  estnome text;
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
  update public.estudio_ausencias set avisado_em = now() where id = p_ausencia;

  return query
  with quem as (
    select m.personal_id from public.estudio_membros m
     where m.estudio_id = au.estudio_id and m.personal_id <> au.personal_id
       and (p_professor is null and m.papel = 'professor' or m.personal_id = p_professor)
  ), avisos as (
    select q.personal_id,
           public.notificar(q.personal_id, 'reposicao_estudio',
             'Reposição no ' || estnome,
             n || (case when n = 1 then ' aula' else ' aulas' end) || ' (' || dias || ') · R$ '
               || replace(to_char(total / 100.0, 'FM9999990D00'), '.', ',') || '. Toque para assumir.',
             '/agenda/estudio/' || au.estudio_id, now(), null, null, null, null, null, false) as ok
      from quem q
  )
  select a.personal_id, pe.nome_completo, pe.whatsapp
    from avisos a join public.personais pe on pe.id = a.personal_id
   order by pe.nome_completo;
end
$$;

-- Reposições ainda sem professor (para a equipe assumir).
create or replace function public.reposicoes_abertas(p_estudio uuid)
returns table (aula_id uuid, inicio timestamptz, fim timestamptz, modalidade text, tipo text, valor_centavos integer, ausente text)
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
  select a.id, a.inicio, a.fim, t.modalidade, t.tipo, public.valor_reposicao(a.id), pe.nome_completo
    from public.aulas_turma a
    join public.turmas t on t.id = a.turma_id
    join public.estudio_ausencias au on au.id = a.ausencia_id
    join public.personais pe on pe.id = au.personal_id
   where a.estudio_id = p_estudio and a.professor_id is null and a.situacao = 'agendada'
     and a.inicio > now() and au.cancelada_em is null and au.personal_id <> auth.uid()
   order by a.inicio;
end
$$;

-- Quem assumir primeiro fica com a aula.
create or replace function public.assumir_reposicao(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a  public.aulas_turma;
  au public.estudio_ausencias;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found or public.papel_no_estudio(a.estudio_id) is null then
    raise exception 'Aula não encontrada.';
  end if;
  select * into au from public.estudio_ausencias where id = a.ausencia_id;
  if au.id is null or au.cancelada_em is not null or a.situacao <> 'agendada' or a.inicio <= now() then
    raise exception 'Esta reposição não está mais aberta.';
  end if;
  if a.professor_id is not null then
    raise exception 'Outro professor já assumiu esta aula.';
  end if;
  if au.personal_id = auth.uid() then
    raise exception 'Esta aula é sua: para voltar a dá-la, desmarque a ausência.';
  end if;
  update public.aulas_turma set professor_id = auth.uid() where id = p_aula;
  if (select professor_id from public.aulas_turma where id = p_aula) is null then
    raise exception 'Você está de férias ou falta neste dia.';
  end if;
end
$$;

-- ─── Pagamento: reposição paga pelo valor de reposição ────────────────────
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
  with todas as (
    select a.*, t.tipo from public.aulas_turma a join public.turmas t on t.id = a.turma_id
     where a.estudio_id = p_estudio and a.situacao = 'agendada'
       and a.inicio >= v_ini and a.inicio < v_fim and a.fim <= now()
  ),
  dadas as (select * from todas where ausencia_id is null),
  repostas as (
    select r.professor_id,
           count(*)::integer as aulas,
           sum(extract(epoch from r.fim - r.inicio) / 60)::integer as minutos,
           sum(case
                 when r.tipo = 'turma' and e.reposicao_modelo = 'por_aluno'
                   then (select count(*) from public.presencas p where p.aula_turma_id = r.id and p.situacao = 'presente')
                        * coalesce(e.reposicao_valor_centavos, 0)
                 else round(extract(epoch from r.fim - r.inicio) / 3600.0
                            * coalesce(case when e.reposicao_modelo = 'hora' then e.reposicao_valor_centavos end, e.valor_hora_centavos, 0))
               end)::integer as valor
      from todas r where r.ausencia_id is not null and r.professor_id is not null
     group by r.professor_id
  ),
  por_prof as (
    select d.professor_id,
           (count(*) filter (where d.tipo = 'turma'))::integer as aulas,
           sum(extract(epoch from d.fim - d.inicio) / 60)::integer as minutos,
           coalesce(sum(extract(epoch from d.fim - d.inicio) / 60) filter (where d.tipo = 'turno'), 0)::integer as minutos_turno,
           (select count(*)::integer from public.presencas p
             where p.aula_turma_id in (select x.id from dadas x where x.professor_id = d.professor_id)
               and p.situacao = 'presente') as presencas
      from dadas d where d.professor_id is not null
     group by d.professor_id
  ),
  partes as (
    select d.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from dadas d
      join public.turma_alunos ta on ta.turma_id = d.turma_id
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where d.professor_id is not null and d.tipo = 'turma'
     group by d.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt group by pt.professor_id
  )
  select m.personal_id, pe.nome_completo,
         coalesce(pp.aulas, 0) + coalesce(rp.aulas, 0), coalesce(pp.minutos, 0) + coalesce(rp.minutos, 0), coalesce(pp.presencas, 0),
         ((case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
                                    + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
                 + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
          end) + coalesce(rp.valor, 0))::integer,
         pg.pago_em, pg.valor_centavos
    from public.estudio_membros m
    join public.personais pe on pe.id = m.personal_id
    left join por_prof pp on pp.professor_id = m.personal_id
    left join repostas rp on rp.professor_id = m.personal_id
    left join base_percentual bp on bp.professor_id = m.personal_id
    left join public.estudio_pagamentos pg
           on pg.estudio_id = p_estudio and pg.personal_id = m.personal_id and pg.mes = date_trunc('month', p_mes)::date
   where m.estudio_id = p_estudio and (pp.aulas is not null or rp.aulas is not null or m.papel = 'professor')
   order by pe.nome_completo;
end
$$;

revoke all on function public.aula_turma_respeita_ausencia()          from public, anon, authenticated;
revoke all on function public.valor_reposicao(uuid)                    from public, anon, authenticated;
revoke all on function public.resumo_ausencia(uuid)                    from public, anon, authenticated;
revoke all on function public.salvar_reposicao_estudio(uuid, text, integer) from public, anon;
revoke all on function public.marcar_ausencia(uuid, uuid, text, date, date) from public, anon;
revoke all on function public.cancelar_ausencia(uuid)                  from public, anon;
revoke all on function public.pedir_reposicao(uuid, uuid)              from public, anon;
revoke all on function public.reposicoes_abertas(uuid)                 from public, anon;
revoke all on function public.assumir_reposicao(uuid)                  from public, anon;
grant execute on function public.salvar_reposicao_estudio(uuid, text, integer) to authenticated;
grant execute on function public.marcar_ausencia(uuid, uuid, text, date, date) to authenticated;
grant execute on function public.cancelar_ausencia(uuid)                  to authenticated;
grant execute on function public.pedir_reposicao(uuid, uuid)              to authenticated;
grant execute on function public.reposicoes_abertas(uuid)                 to authenticated;
grant execute on function public.assumir_reposicao(uuid)                  to authenticated;

commit;
