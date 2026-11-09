-- 38 · Aluno do estúdio no app (etapa 2 da decisão 54; decisão 61).
--
-- • Convite: a coordenação gera um link para cada aluno do estúdio; ele entra com a conta de
--   aluno e o cadastro do estúdio fica ligado à conta.
-- • Agenda do aluno: as turmas da semana com a ocupação (ex.: 4/5), sem nomes de alunos.
-- • Falta avisada: o aluno (ou o professor da aula, ou a coordenação) avisa a falta. Com a
--   antecedência do estúdio (padrão 12 h), ganha uma reposição da mesma modalidade, que vale
--   os dias do estúdio (padrão 30).
-- • Reposição: o aluno toca numa turma com vaga da mesma modalidade, com pelo menos a
--   antecedência do estúdio (padrão 1 h). O professor recebe a notificação; não precisa responder.

begin;

-- ─── Regras do estúdio ────────────────────────────────────────────────────
alter table public.estudios
  add column antecedencia_marcar_h integer not null default 1 check (antecedencia_marcar_h between 0 and 48);
alter table public.estudios alter column antecedencia_falta_h set default 12;
update public.estudios set antecedencia_falta_h = 12 where antecedencia_falta_h = 2;

create or replace function public.salvar_regras_alunos_estudio(p_estudio uuid, p_falta_h integer, p_marcar_h integer, p_validade integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda as regras de faltas e reposições.';
  end if;
  if p_falta_h is null or p_falta_h not between 0 and 72 then
    raise exception 'Aviso de falta: de 0 a 72 horas antes.';
  end if;
  if p_marcar_h is null or p_marcar_h not between 0 and 48 then
    raise exception 'Marcar reposição: de 0 a 48 horas antes.';
  end if;
  if p_validade is null or p_validade not between 1 and 120 then
    raise exception 'A reposição vale de 1 a 120 dias.';
  end if;
  update public.estudios
     set antecedencia_falta_h = p_falta_h, antecedencia_marcar_h = p_marcar_h, validade_reposicao_dias = p_validade
   where id = p_estudio;
end
$$;

-- ─── Convite do aluno ─────────────────────────────────────────────────────
alter table public.estudio_alunos
  add column convite_codigo text unique,
  add column convite_expira_em timestamptz;

create or replace function public.convite_aluno_estudio(p_estudio_aluno uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  al public.estudio_alunos;
  v  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select * into al from public.estudio_alunos where id = p_estudio_aluno for update;
  if not found or not public.coordena_estudio(al.estudio_id) then
    raise exception 'Aluno não encontrado.';
  end if;
  if al.aluno_id is not null then
    raise exception 'Este aluno já entrou no app.';
  end if;
  update public.estudio_alunos set convite_codigo = v, convite_expira_em = now() + interval '14 days' where id = al.id;
  return v;
end
$$;

create or replace function public.ver_convite_aluno_estudio(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'estudio', e.nome,
              'aluno', split_part(btrim(al.nome), ' ', 1),
              'situacao', case when al.convite_expira_em < now() then 'expirado' else 'valido' end)
       from public.estudio_alunos al join public.estudios e on e.id = al.estudio_id
      where al.convite_codigo = p_codigo and al.situacao = 'ativo'),
    jsonb_build_object('situacao', 'inexistente'));
$$;

create or replace function public.aceitar_convite_aluno_estudio(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  al public.estudio_alunos;
begin
  if not exists (select 1 from public.alunos where id = auth.uid()) then
    raise exception 'Entre com uma conta de aluno para aceitar o convite.';
  end if;
  select * into al from public.estudio_alunos where convite_codigo = p_codigo and situacao = 'ativo' for update;
  if not found or al.convite_expira_em < now() then
    raise exception 'Este convite não vale mais. Peça um novo ao estúdio.';
  end if;
  if exists (select 1 from public.estudio_alunos x
              where x.estudio_id = al.estudio_id and x.aluno_id = auth.uid() and x.id <> al.id and x.situacao = 'ativo') then
    raise exception 'Sua conta já está ligada a outro cadastro deste estúdio.';
  end if;
  update public.estudio_alunos set aluno_id = auth.uid(), convite_codigo = null, convite_expira_em = null where id = al.id;
  return al.estudio_id;
end
$$;

-- ─── Reposições do aluno ──────────────────────────────────────────────────
create table public.estudio_reposicoes (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  modalidade        text not null,
  aula_perdida_id   uuid references public.aulas_turma (id) on delete set null,
  valido_ate        date not null,
  -- Aula em que foi usada (nula: ainda livre; volta a ficar livre se a aula for apagada).
  usada_aula_id     uuid references public.aulas_turma (id) on delete set null,
  criado_em         timestamptz not null default now()
);
create index estudio_reposicoes_por_aluno on public.estudio_reposicoes (estudio_aluno_id, valido_ate);

alter table public.estudio_reposicoes enable row level security;
create policy "aluno e coordenação veem as reposições" on public.estudio_reposicoes
  for select to authenticated using (
    public.coordena_estudio(estudio_id)
    or exists (select 1 from public.estudio_alunos al where al.id = estudio_aluno_id and al.aluno_id = (select auth.uid())));

-- O cadastro do aluno logado neste estúdio.
create or replace function public.meu_aluno_no_estudio(p_estudio uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.estudio_alunos
   where estudio_id = p_estudio and aluno_id = auth.uid() and situacao = 'ativo'
   limit 1;
$$;

-- Quantos alunos vêm à aula: os da turma e as reposições, menos quem avisou a falta.
create or replace function public.ocupacao_aula_turma(p_aula uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from (
    select ta.estudio_aluno_id as aluno
      from public.aulas_turma a
      join public.turma_alunos ta on ta.turma_id = a.turma_id
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where a.id = p_aula
    union
    select p.estudio_aluno_id from public.presencas p where p.aula_turma_id = p_aula
  ) x
  where not exists (select 1 from public.presencas p2
                     where p2.aula_turma_id = p_aula and p2.estudio_aluno_id = x.aluno and p2.situacao = 'falta_avisada');
$$;

-- Estúdios do aluno logado, com as regras e o funcionamento.
create or replace function public.meus_estudios_aluno()
returns table (estudio_id uuid, nome text, estudio_aluno_id uuid, falta_h integer, marcar_h integer,
               validade_dias integer, funcionamento jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nome, al.id, e.antecedencia_falta_h, e.antecedencia_marcar_h, e.validade_reposicao_dias,
         coalesce((select jsonb_agg(jsonb_build_object('dia', f.dia_semana, 'inicio_min', f.inicio_min, 'fim_min', f.fim_min))
                     from public.estudio_funcionamento f where f.estudio_id = e.id), '[]'::jsonb)
    from public.estudio_alunos al join public.estudios e on e.id = al.estudio_id
   where al.aluno_id = auth.uid() and al.situacao = 'ativo'
   order by e.nome;
$$;

-- Agenda do estúdio para o aluno: turmas com ocupação, sem nomes de outros alunos.
create or replace function public.agenda_aluno_estudio(p_estudio uuid, p_de date, p_ate date)
returns table (aula_id uuid, inicio timestamptz, fim timestamptz, modalidade text, professor text,
               vagas integer, ocupadas integer, minha text, avisei_falta boolean, cancelada boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_al uuid := public.meu_aluno_no_estudio(p_estudio);
begin
  if v_al is null then
    return;
  end if;
  return query
  select a.id, a.inicio, a.fim, t.modalidade, split_part(btrim(pe.nome_completo), ' ', 1),
         t.vagas, public.ocupacao_aula_turma(a.id),
         case when exists (select 1 from public.turma_alunos ta where ta.turma_id = t.id and ta.estudio_aluno_id = v_al) then 'fixa'
              when exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = v_al and p.origem = 'reposicao') then 'reposicao'
         end,
         exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = v_al and p.situacao = 'falta_avisada'),
         a.situacao = 'cancelada'
    from public.aulas_turma a
    join public.turmas t on t.id = a.turma_id and t.tipo = 'turma'
    left join public.personais pe on pe.id = a.professor_id
   where a.estudio_id = p_estudio
     and a.inicio >= public.instante_brasilia(p_de, 0) and a.inicio < public.instante_brasilia(p_ate + 1, 0)
   order by a.inicio;
end
$$;

-- Reposições livres do aluno logado neste estúdio.
create or replace function public.minhas_reposicoes_estudio(p_estudio uuid)
returns table (id uuid, modalidade text, valido_ate date)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.modalidade, r.valido_ate from public.estudio_reposicoes r
   where r.estudio_aluno_id = public.meu_aluno_no_estudio(p_estudio)
     and r.usada_aula_id is null and r.valido_ate >= public.hoje_brasilia()
   order by r.valido_ate;
$$;

-- Texto curto da aula para as notificações: "Pilates, 12/11 às 18:00".
create or replace function public.texto_aula_turma(p_aula uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.modalidade || ', ' || to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
    from public.aulas_turma a join public.turmas t on t.id = a.turma_id where a.id = p_aula;
$$;

-- Avisar a falta: o aluno (p_aluno nulo) ou o professor da aula / a coordenação (p_aluno).
create or replace function public.avisar_falta_estudio(p_aula uuid, p_aluno uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        public.aulas_turma;
  t        public.turmas;
  e        public.estudios;
  p        public.presencas;
  v_al     uuid;
  v_nome   text;
  fixo     boolean;
  no_prazo boolean;
  credito  boolean := false;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  select * into e from public.estudios where id = a.estudio_id;
  if p_aluno is null then
    v_al := public.meu_aluno_no_estudio(a.estudio_id);
    if v_al is null then
      raise exception 'Você não é aluno deste estúdio.';
    end if;
  else
    if a.professor_id is distinct from auth.uid() and not public.coordena_estudio(a.estudio_id) then
      raise exception 'Só o professor da aula ou a coordenação avisam a falta de um aluno.';
    end if;
    if not exists (select 1 from public.estudio_alunos where id = p_aluno and estudio_id = a.estudio_id) then
      raise exception 'Aluno de fora deste estúdio.';
    end if;
    v_al := p_aluno;
  end if;
  if a.situacao = 'cancelada' then
    raise exception 'Esta aula foi cancelada.';
  end if;
  if a.inicio <= now() then
    raise exception 'A aula já começou.';
  end if;
  fixo := exists (select 1 from public.turma_alunos where turma_id = a.turma_id and estudio_aluno_id = v_al);
  select * into p from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
  if p.situacao = 'falta_avisada' then
    raise exception 'A falta já foi avisada.';
  end if;
  if not fixo and p.aula_turma_id is null then
    raise exception 'Este aluno não está nesta aula.';
  end if;
  no_prazo := now() <= a.inicio - make_interval(hours => e.antecedencia_falta_h);

  if not fixo then
    -- Reposição marcada: no prazo, desmarca e devolve a reposição; fora do prazo, vira falta.
    if no_prazo then
      delete from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
      update public.estudio_reposicoes set usada_aula_id = null where usada_aula_id = a.id and estudio_aluno_id = v_al;
      credito := true;
    else
      update public.presencas set situacao = 'falta_avisada', marcado_em = now()
       where aula_turma_id = a.id and estudio_aluno_id = v_al;
    end if;
  else
    insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
    values (a.id, v_al, 'falta_avisada', 'fixa')
    on conflict (aula_turma_id, estudio_aluno_id) do update set situacao = 'falta_avisada', marcado_em = now();
    if no_prazo then
      insert into public.estudio_reposicoes (estudio_id, estudio_aluno_id, modalidade, aula_perdida_id, valido_ate)
      values (a.estudio_id, v_al, t.modalidade, a.id,
              (a.inicio at time zone 'America/Sao_Paulo')::date + e.validade_reposicao_dias);
      credito := true;
    end if;
  end if;

  if p_aluno is null and a.professor_id is not null then
    select split_part(btrim(nome), ' ', 1) into v_nome from public.estudio_alunos where id = v_al;
    perform public.notificar(a.professor_id, 'falta_aluno_estudio', 'Falta avisada',
      v_nome || ' não vem à turma de ' || public.texto_aula_turma(a.id) || '.',
      '/agenda/turma/' || a.id, now(), null, null, null, null, null, true);
  end if;
  return jsonb_build_object('credito', credito, 'fixo', fixo, 'prazo_h', e.antecedencia_falta_h);
end
$$;

-- Desfazer a falta avisada (aula fixa), se a vaga ainda existe e a reposição não foi usada.
create or replace function public.desfazer_falta_estudio(p_aula uuid, p_aluno uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a    public.aulas_turma;
  t    public.turmas;
  v_al uuid;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  if p_aluno is null then
    v_al := public.meu_aluno_no_estudio(a.estudio_id);
  elsif a.professor_id = auth.uid() or public.coordena_estudio(a.estudio_id) then
    v_al := p_aluno;
  end if;
  if v_al is null or not exists (select 1 from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al
                                    and situacao = 'falta_avisada' and origem = 'fixa') then
    raise exception 'Não há falta avisada para desfazer.';
  end if;
  if a.inicio <= now() then
    raise exception 'A aula já começou.';
  end if;
  if exists (select 1 from public.estudio_reposicoes where aula_perdida_id = a.id and estudio_aluno_id = v_al and usada_aula_id is not null) then
    raise exception 'A reposição desta falta já foi usada.';
  end if;
  if public.ocupacao_aula_turma(a.id) >= t.vagas then
    raise exception 'A vaga já foi ocupada por outro aluno.';
  end if;
  delete from public.estudio_reposicoes where aula_perdida_id = a.id and estudio_aluno_id = v_al;
  delete from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
end
$$;

-- Marcar reposição numa turma com vaga (mesma modalidade, com antecedência).
create or replace function public.marcar_reposicao_estudio(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas_turma;
  t      public.turmas;
  e      public.estudios;
  v_al   uuid;
  v_rep  uuid;
  v_nome text;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  select * into e from public.estudios where id = a.estudio_id;
  v_al := public.meu_aluno_no_estudio(a.estudio_id);
  if v_al is null then
    raise exception 'Você não é aluno deste estúdio.';
  end if;
  if t.tipo <> 'turma' or a.situacao = 'cancelada' then
    raise exception 'Esta aula não recebe alunos.';
  end if;
  if now() > a.inicio - make_interval(hours => e.antecedencia_marcar_h) then
    raise exception 'Marque com pelo menos % h de antecedência.', e.antecedencia_marcar_h;
  end if;
  if exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Esta já é a sua turma.';
  end if;
  if exists (select 1 from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al) then
    raise exception 'Você já está nesta aula.';
  end if;
  if public.ocupacao_aula_turma(a.id) >= t.vagas then
    raise exception 'Esta aula está lotada.';
  end if;
  select r.id into v_rep from public.estudio_reposicoes r
   where r.estudio_aluno_id = v_al and r.usada_aula_id is null
     and r.valido_ate >= (a.inicio at time zone 'America/Sao_Paulo')::date
     and lower(btrim(r.modalidade)) = lower(btrim(t.modalidade))
   order by r.valido_ate
   limit 1
   for update;
  if v_rep is null then
    raise exception 'Você não tem reposição de % para usar.', t.modalidade;
  end if;
  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
  values (a.id, v_al, 'presente', 'reposicao');
  update public.estudio_reposicoes set usada_aula_id = a.id where id = v_rep;
  if a.professor_id is not null then
    select split_part(btrim(nome), ' ', 1) into v_nome from public.estudio_alunos where id = v_al;
    perform public.notificar(a.professor_id, 'reposicao_aluno_estudio', 'Aluno em reposição',
      v_nome || ' vai repor na sua turma de ' || public.texto_aula_turma(a.id) || '.',
      '/agenda/turma/' || a.id, now(), null, null, null, null, null, true);
  end if;
end
$$;

revoke all on function public.salvar_regras_alunos_estudio(uuid, integer, integer, integer) from public, anon;
revoke all on function public.convite_aluno_estudio(uuid)          from public, anon;
revoke all on function public.ver_convite_aluno_estudio(text)      from public;
revoke all on function public.aceitar_convite_aluno_estudio(text)  from public, anon;
revoke all on function public.meu_aluno_no_estudio(uuid)           from public, anon, authenticated;
revoke all on function public.ocupacao_aula_turma(uuid)            from public, anon, authenticated;
revoke all on function public.texto_aula_turma(uuid)               from public, anon, authenticated;
revoke all on function public.meus_estudios_aluno()                from public, anon;
revoke all on function public.agenda_aluno_estudio(uuid, date, date) from public, anon;
revoke all on function public.minhas_reposicoes_estudio(uuid)      from public, anon;
revoke all on function public.avisar_falta_estudio(uuid, uuid)     from public, anon;
revoke all on function public.desfazer_falta_estudio(uuid, uuid)   from public, anon;
revoke all on function public.marcar_reposicao_estudio(uuid)       from public, anon;
grant execute on function public.salvar_regras_alunos_estudio(uuid, integer, integer, integer) to authenticated;
grant execute on function public.convite_aluno_estudio(uuid)          to authenticated;
grant execute on function public.ver_convite_aluno_estudio(text)      to anon, authenticated;
grant execute on function public.aceitar_convite_aluno_estudio(text)  to authenticated;
grant execute on function public.meus_estudios_aluno()                to authenticated;
grant execute on function public.agenda_aluno_estudio(uuid, date, date) to authenticated;
grant execute on function public.minhas_reposicoes_estudio(uuid)      to authenticated;
grant execute on function public.avisar_falta_estudio(uuid, uuid)     to authenticated;
grant execute on function public.desfazer_falta_estudio(uuid, uuid)   to authenticated;
grant execute on function public.marcar_reposicao_estudio(uuid)       to authenticated;

commit;
