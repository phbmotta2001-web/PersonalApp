-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell Estúdio: horário de funcionamento e turnos de trabalho (10/11/2026, decisão 58).
--
-- • Funcionamento: cada dia da semana aberto tem um horário (abre e fecha). Definido no
--   cadastro da academia/estúdio e alterável em Ajustes. Turmas e turnos ficam dentro dele.
-- • Turnos: além das turmas (aula com alunos e chamada), a coordenação atribui TURNOS de
--   trabalho a cada profissional (ex.: Musculação 6h–10h): sem alunos, sem vagas, sem
--   chamada, até 12 h. Repetem toda semana como as turmas e ocupam a agenda do profissional.
-- • Pagamento: o turno é pago pelo valor da hora em qualquer modelo; na comissão e no
--   percentual, "aulas" e presenças contam só as turmas.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- ANTES de enviar o site novo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Funcionamento ─────────────────────────────────────────────────────────
create table public.estudio_funcionamento (
  estudio_id uuid not null references public.estudios (id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  inicio_min integer not null check (inicio_min between 0 and 1425 and inicio_min % 15 = 0),
  fim_min    integer not null check (fim_min between 15 and 1440 and fim_min % 15 = 0),
  primary key (estudio_id, dia_semana),
  check (fim_min > inicio_min)
);
alter table public.estudio_funcionamento enable row level security;
create policy "membros veem o funcionamento" on public.estudio_funcionamento
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

-- p: [{dia, inicio_min, fim_min}] só com os dias abertos.
create or replace function public.salvar_funcionamento_estudio(p_estudio uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda o horário de funcionamento.';
  end if;
  if jsonb_array_length(coalesce(p, '[]')) = 0 then
    raise exception 'Marque pelo menos um dia de funcionamento.';
  end if;
  if exists (select 1 from jsonb_array_elements(p) x where (x ->> 'fim_min')::int <= (x ->> 'inicio_min')::int) then
    raise exception 'O horário de fechar precisa ser depois do de abrir.';
  end if;
  delete from public.estudio_funcionamento where estudio_id = p_estudio;
  insert into public.estudio_funcionamento (estudio_id, dia_semana, inicio_min, fim_min)
  select p_estudio, (x ->> 'dia')::int, (x ->> 'inicio_min')::int, (x ->> 'fim_min')::int
    from jsonb_array_elements(p) x;
end
$$;

-- ─── Turnos ────────────────────────────────────────────────────────────────
alter table public.turmas
  add column tipo text not null default 'turma' check (tipo in ('turma', 'turno'));
alter table public.turmas drop constraint turmas_duracao_min_check;
alter table public.turmas add constraint turmas_duracao_min_check check (duracao_min between 15 and 720);
alter table public.turmas alter column vagas drop not null;
alter table public.turmas add constraint turmas_vagas_da_turma check (tipo = 'turno' or vagas is not null);

comment on column public.turmas.tipo is 'turma: aula com alunos e chamada. turno: horário de trabalho do profissional, sem alunos.';

-- Criar ou alterar uma turma ou um turno (repete toda semana).
create or replace function public.salvar_horario(
  p_estudio uuid, p_turma uuid, p_tipo text, p_modalidade text, p_dia integer, p_inicio_min integer,
  p_duracao integer, p_vagas integer, p_professor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := p_turma;
  antes   public.turmas;
  f       public.estudio_funcionamento;
  v_vagas integer := case when p_tipo = 'turno' then null else p_vagas end;
  v_dur   integer := coalesce(p_duracao, 60);
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação cria e altera turmas.';
  end if;
  if p_tipo not in ('turma', 'turno') then
    raise exception 'Escolha turma ou turno.';
  end if;
  if p_tipo = 'turma' and v_vagas is null then
    raise exception 'Informe as vagas da turma.';
  end if;
  if p_professor is not null and not exists (
      select 1 from public.estudio_membros where estudio_id = p_estudio and personal_id = p_professor) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  -- Dentro do funcionamento (quando ele foi definido).
  if exists (select 1 from public.estudio_funcionamento where estudio_id = p_estudio) then
    select * into f from public.estudio_funcionamento where estudio_id = p_estudio and dia_semana = p_dia;
    if not found then
      raise exception 'O estúdio não abre neste dia.';
    end if;
    if p_inicio_min < f.inicio_min or p_inicio_min + v_dur > f.fim_min then
      raise exception 'Fora do horário de funcionamento.';
    end if;
  end if;
  if v_id is null then
    insert into public.turmas (estudio_id, tipo, modalidade, dia_semana, inicio_min, duracao_min, vagas, professor_id)
    values (p_estudio, p_tipo, btrim(p_modalidade), p_dia, p_inicio_min, v_dur, v_vagas, p_professor)
    returning id into v_id;
  else
    select * into antes from public.turmas where id = v_id and estudio_id = p_estudio for update;
    if not found then
      raise exception 'Turma não encontrada.';
    end if;
    if p_tipo = 'turno' and exists (select 1 from public.turma_alunos where turma_id = v_id) then
      raise exception 'Esta turma tem alunos: não pode virar turno.';
    end if;
    update public.turmas
       set tipo = p_tipo, modalidade = btrim(p_modalidade), dia_semana = p_dia, inicio_min = p_inicio_min,
           duracao_min = v_dur, vagas = v_vagas, professor_id = p_professor
     where id = v_id;
    if antes.dia_semana <> p_dia or antes.inicio_min <> p_inicio_min or antes.duracao_min <> v_dur then
      delete from public.aulas_turma where turma_id = v_id and inicio > now() and chamada_em is null;
    elsif antes.professor_id is distinct from p_professor then
      update public.aulas_turma set professor_id = p_professor
       where turma_id = v_id and inicio > now() and professor_id is not distinct from antes.professor_id;
    end if;
  end if;
  perform public.gerar_aulas_turma(v_id);
  return v_id;
end
$$;

-- A função antiga continua valendo (sempre turma).
create or replace function public.salvar_turma(
  p_estudio uuid, p_turma uuid, p_modalidade text, p_dia integer, p_inicio_min integer,
  p_duracao integer, p_vagas integer, p_professor uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.salvar_horario(p_estudio, p_turma, 'turma', p_modalidade, p_dia, p_inicio_min, p_duracao, p_vagas, p_professor);
$$;

-- Aluno só entra em turma (turno não tem alunos).
create or replace function public.salvar_turmas_do_aluno(p_aluno uuid, p_turmas uuid[])
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
    raise exception 'Só a coordenação muda as turmas dos alunos.';
  end if;
  if exists (select 1 from unnest(coalesce(p_turmas, '{}')) t(id)
              where not exists (select 1 from public.turmas x where x.id = t.id and x.estudio_id = a.estudio_id and x.tipo = 'turma')) then
    raise exception 'Escolha turmas deste estúdio.';
  end if;
  delete from public.turma_alunos where estudio_aluno_id = a.id and not (turma_id = any (coalesce(p_turmas, '{}')));
  insert into public.turma_alunos (turma_id, estudio_aluno_id)
  select t, a.id from unnest(coalesce(p_turmas, '{}')) t
  on conflict do nothing;
end
$$;

-- ─── Pagamento com turnos ──────────────────────────────────────────────────
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
    select a.*, t.tipo from public.aulas_turma a join public.turmas t on t.id = a.turma_id
     where a.estudio_id = p_estudio and a.situacao = 'agendada'
       and a.inicio >= v_ini and a.inicio < v_fim and a.fim <= now()
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
         coalesce(pp.aulas, 0), coalesce(pp.minutos, 0), coalesce(pp.presencas, 0),
         (case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
                                    + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
                 + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
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

revoke all on function public.salvar_funcionamento_estudio(uuid, jsonb) from public, anon;
revoke all on function public.salvar_horario(uuid, uuid, text, text, integer, integer, integer, integer, uuid) from public, anon;
grant execute on function public.salvar_funcionamento_estudio(uuid, jsonb) to authenticated;
grant execute on function public.salvar_horario(uuid, uuid, text, text, integer, integer, integer, integer, uuid) to authenticated;

commit;
