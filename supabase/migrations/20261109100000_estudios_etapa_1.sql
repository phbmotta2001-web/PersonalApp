-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell Estúdio, etapa 1: estúdio, professores, turmas, alunos do estúdio e chamada.
--
-- Decisão de 09/11/2026 (docs/plano-fase-1-agenda.md, decisão 54). Piloto no estúdio do
-- Pedro. Turmas com horário fixo; o app gera as aulas das próximas 8 semanas; o professor
-- da aula (ou a coordenação) faz a chamada. Alunos do estúdio entram por lista colada
-- (com ou sem app). O estúdio NUNCA vê a agenda particular do professor: estas tabelas
-- são separadas das aulas, alunos e cobranças do personal.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261108140000_conta_da_equipe.sql e ANTES de enviar o site novo.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ─── Tabelas ───────────────────────────────────────────────────────────────
create table public.estudios (
  id                      uuid primary key default gen_random_uuid(),
  nome                    text not null check (char_length(btrim(nome)) between 2 and 80),
  antecedencia_falta_h    integer not null default 2 check (antecedencia_falta_h between 0 and 72),
  validade_reposicao_dias integer not null default 30 check (validade_reposicao_dias between 1 and 120),
  criado_por              uuid references public.personais (id) on delete set null,
  criado_em               timestamptz not null default now()
);
comment on table public.estudios is 'Estúdio ou academia (P-Bell Estúdio). Regras de falta e reposição dos alunos.';

-- Quem trabalha no estúdio: coordenação (administra) e professores. Todos são personais do P-Bell.
create table public.estudio_membros (
  estudio_id  uuid not null references public.estudios (id) on delete cascade,
  personal_id uuid not null references public.personais (id) on delete cascade,
  papel       text not null check (papel in ('coordenacao', 'professor')),
  criado_em   timestamptz not null default now(),
  primary key (estudio_id, personal_id)
);

create table public.estudio_convites (
  id          uuid primary key default gen_random_uuid(),
  estudio_id  uuid not null references public.estudios (id) on delete cascade,
  codigo      text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  papel       text not null default 'professor' check (papel in ('coordenacao', 'professor')),
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '14 days',
  usado_por   uuid references public.personais (id) on delete set null,
  usado_em    timestamptz
);

create table public.turmas (
  id           uuid primary key default gen_random_uuid(),
  estudio_id   uuid not null references public.estudios (id) on delete cascade,
  modalidade   text not null check (char_length(btrim(modalidade)) between 2 and 40),
  dia_semana   integer not null check (dia_semana between 0 and 6),
  inicio_min   integer not null check (inicio_min between 0 and 1425 and inicio_min % 15 = 0),
  duracao_min  integer not null default 60 check (duracao_min between 15 and 240),
  vagas        integer not null check (vagas between 1 and 100),
  professor_id uuid references public.personais (id) on delete set null,
  ativa        boolean not null default true,
  criado_em    timestamptz not null default now()
);
create index turmas_por_estudio on public.turmas (estudio_id);

-- Cada encontro de uma turma. professor_id pode mudar (substituição).
create table public.aulas_turma (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references public.turmas (id) on delete cascade,
  estudio_id   uuid not null references public.estudios (id) on delete cascade,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  professor_id uuid references public.personais (id) on delete set null,
  situacao     text not null default 'agendada' check (situacao in ('agendada', 'cancelada')),
  chamada_em   timestamptz,
  unique (turma_id, inicio)
);
create index aulas_turma_por_professor on public.aulas_turma (professor_id, inicio);
create index aulas_turma_por_estudio on public.aulas_turma (estudio_id, inicio);

-- Alunos do estúdio: só nome e WhatsApp; aluno_id quando ele tiver conta no app.
create table public.estudio_alunos (
  id          uuid primary key default gen_random_uuid(),
  estudio_id  uuid not null references public.estudios (id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 2 and 80),
  whatsapp    text check (whatsapp is null or whatsapp ~ '^\d{10,13}$'),
  aluno_id    uuid references public.alunos (id) on delete set null,
  situacao    text not null default 'ativo' check (situacao in ('ativo', 'encerrado')),
  criado_em   timestamptz not null default now()
);
create index estudio_alunos_por_estudio on public.estudio_alunos (estudio_id);

create table public.turma_alunos (
  turma_id          uuid not null references public.turmas (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  desde             date not null default current_date,
  primary key (turma_id, estudio_aluno_id)
);

-- Chamada (e, na etapa 2, faltas avisadas e reposições).
create table public.presencas (
  aula_turma_id     uuid not null references public.aulas_turma (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  situacao          text not null check (situacao in ('presente', 'falta', 'falta_avisada')),
  origem            text not null default 'fixa' check (origem in ('fixa', 'reposicao')),
  marcado_em        timestamptz not null default now(),
  primary key (aula_turma_id, estudio_aluno_id)
);

-- ─── Ajudantes ─────────────────────────────────────────────────────────────
create or replace function public.papel_no_estudio(p_estudio uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.estudio_membros where estudio_id = p_estudio and personal_id = auth.uid();
$$;

create or replace function public.coordena_estudio(p_estudio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_no_estudio(p_estudio) = 'coordenacao', false);
$$;

-- ─── Leitura (regras por linha) ────────────────────────────────────────────
alter table public.estudios         enable row level security;
alter table public.estudio_membros  enable row level security;
alter table public.estudio_convites enable row level security;
alter table public.turmas           enable row level security;
alter table public.aulas_turma      enable row level security;
alter table public.estudio_alunos   enable row level security;
alter table public.turma_alunos     enable row level security;
alter table public.presencas        enable row level security;

create policy "membros veem o estúdio" on public.estudios
  for select to authenticated using (public.papel_no_estudio(id) is not null);
create policy "membros veem a equipe" on public.estudio_membros
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);
create policy "coordenação vê os convites" on public.estudio_convites
  for select to authenticated using (public.coordena_estudio(estudio_id));
create policy "membros veem as turmas" on public.turmas
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);
create policy "membros veem as aulas" on public.aulas_turma
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);
create policy "membros veem os alunos do estúdio" on public.estudio_alunos
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);
create policy "membros veem quem está em cada turma" on public.turma_alunos
  for select to authenticated using (
    public.papel_no_estudio((select t.estudio_id from public.turmas t where t.id = turma_id)) is not null);
create policy "membros veem a chamada" on public.presencas
  for select to authenticated using (
    public.papel_no_estudio((select a.estudio_id from public.aulas_turma a where a.id = aula_turma_id)) is not null);

-- ─── Estúdio e equipe ──────────────────────────────────────────────────────
-- Cria o estúdio; quem cria fica na coordenação.
create or replace function public.criar_estudio(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só personais podem criar um estúdio.';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 80 then
    raise exception 'Informe o nome do estúdio.';
  end if;
  insert into public.estudios (nome, criado_por) values (btrim(p_nome), auth.uid()) returning id into v_id;
  insert into public.estudio_membros (estudio_id, personal_id, papel) values (v_id, auth.uid(), 'coordenacao');
  return v_id;
end
$$;

create or replace function public.convidar_para_estudio(p_estudio uuid, p_papel text default 'professor')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação convida professores.';
  end if;
  insert into public.estudio_convites (estudio_id, papel) values (p_estudio, coalesce(p_papel, 'professor'))
  returning codigo into v_codigo;
  return v_codigo;
end
$$;

-- Para a página do convite: nome do estúdio e se o convite vale.
create or replace function public.ver_convite_estudio(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'estudio', e.nome,
      'papel', c.papel,
      'situacao', case when c.usado_em is not null then 'usado' when c.expira_em < now() then 'expirado' else 'valido' end)
      from public.estudio_convites c join public.estudios e on e.id = c.estudio_id
     where c.codigo = p_codigo), jsonb_build_object('situacao', 'inexistente'));
$$;

create or replace function public.aceitar_convite_estudio(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.estudio_convites;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Entre com uma conta de personal para entrar no estúdio.';
  end if;
  select * into c from public.estudio_convites where codigo = p_codigo for update;
  if not found or c.usado_em is not null or c.expira_em < now() then
    raise exception 'Este convite não vale mais. Peça um novo à coordenação.';
  end if;
  insert into public.estudio_membros (estudio_id, personal_id, papel) values (c.estudio_id, auth.uid(), c.papel)
  on conflict (estudio_id, personal_id) do nothing;
  update public.estudio_convites set usado_por = auth.uid(), usado_em = now() where id = c.id;
  return c.estudio_id;
end
$$;

create or replace function public.remover_do_estudio(p_estudio uuid, p_personal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda a equipe.';
  end if;
  if p_personal = auth.uid() then
    raise exception 'Você não pode se remover da coordenação.';
  end if;
  delete from public.estudio_membros where estudio_id = p_estudio and personal_id = p_personal;
  -- As aulas futuras dele ficam sem professor até a coordenação escolher outro.
  update public.aulas_turma set professor_id = null
   where estudio_id = p_estudio and professor_id = p_personal and inicio > now();
  update public.turmas set professor_id = null where estudio_id = p_estudio and professor_id = p_personal;
end
$$;

-- ─── Turmas e aulas ────────────────────────────────────────────────────────
-- Gera as aulas das próximas 8 semanas de uma turma (sem repetir as que já existem).
create or replace function public.gerar_aulas_turma(p_turma uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.turmas;
  n integer;
begin
  select * into t from public.turmas where id = p_turma and ativa;
  if not found then
    return 0;
  end if;
  insert into public.aulas_turma (turma_id, estudio_id, inicio, fim, professor_id)
  select t.id, t.estudio_id,
         public.instante_brasilia(d.dia::date, t.inicio_min),
         public.instante_brasilia(d.dia::date, t.inicio_min) + make_interval(mins => t.duracao_min),
         t.professor_id
    from generate_series(public.hoje_brasilia(), public.hoje_brasilia() + 56, interval '1 day') as d(dia)
   where extract(dow from d.dia) = t.dia_semana
     and public.instante_brasilia(d.dia::date, t.inicio_min) > now()
  on conflict (turma_id, inicio) do nothing;
  get diagnostics n = row_count;
  return n;
end
$$;

create or replace function public.gerar_aulas_turma_de_todas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.turmas where ativa loop
    perform public.gerar_aulas_turma(r.id);
  end loop;
end
$$;

-- Cria ou altera uma turma. Mudou dia, horário ou duração: as aulas futuras sem chamada são refeitas.
create or replace function public.salvar_turma(
  p_estudio uuid, p_turma uuid, p_modalidade text, p_dia integer, p_inicio_min integer,
  p_duracao integer, p_vagas integer, p_professor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := p_turma;
  antes   public.turmas;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação cria e altera turmas.';
  end if;
  if p_professor is not null and not exists (
      select 1 from public.estudio_membros where estudio_id = p_estudio and personal_id = p_professor) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  if v_id is null then
    insert into public.turmas (estudio_id, modalidade, dia_semana, inicio_min, duracao_min, vagas, professor_id)
    values (p_estudio, btrim(p_modalidade), p_dia, p_inicio_min, coalesce(p_duracao, 60), p_vagas, p_professor)
    returning id into v_id;
  else
    select * into antes from public.turmas where id = v_id and estudio_id = p_estudio for update;
    if not found then
      raise exception 'Turma não encontrada.';
    end if;
    update public.turmas
       set modalidade = btrim(p_modalidade), dia_semana = p_dia, inicio_min = p_inicio_min,
           duracao_min = coalesce(p_duracao, 60), vagas = p_vagas, professor_id = p_professor
     where id = v_id;
    if antes.dia_semana <> p_dia or antes.inicio_min <> p_inicio_min or antes.duracao_min <> coalesce(p_duracao, 60) then
      delete from public.aulas_turma where turma_id = v_id and inicio > now() and chamada_em is null;
    elsif antes.professor_id is distinct from p_professor then
      -- Troca de professor fixo: vale para as próximas aulas (substituições já marcadas continuam).
      update public.aulas_turma set professor_id = p_professor
       where turma_id = v_id and inicio > now() and professor_id is not distinct from antes.professor_id;
    end if;
  end if;
  perform public.gerar_aulas_turma(v_id);
  return v_id;
end
$$;

create or replace function public.encerrar_turma(p_turma uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.turmas;
begin
  select * into t from public.turmas where id = p_turma;
  if not found or not public.coordena_estudio(t.estudio_id) then
    raise exception 'Só a coordenação encerra turmas.';
  end if;
  update public.turmas set ativa = false where id = p_turma;
  delete from public.aulas_turma where turma_id = p_turma and inicio > now() and chamada_em is null;
end
$$;

-- ─── Alunos do estúdio ─────────────────────────────────────────────────────
-- Lista colada: [{nome, whatsapp}]. Devolve quantos foram criados.
create or replace function public.importar_alunos_estudio(p_estudio uuid, p_lista jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     record;
  n     integer := 0;
  v_zap text;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação cadastra alunos do estúdio.';
  end if;
  if jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) > 500 then
    raise exception 'Mande uma lista de até 500 alunos.';
  end if;
  for r in select btrim(x ->> 'nome') as nome, regexp_replace(coalesce(x ->> 'whatsapp', ''), '\D', '', 'g') as zap
             from jsonb_array_elements(p_lista) as x loop
    continue when char_length(coalesce(r.nome, '')) not between 2 and 80;
    v_zap := case when char_length(r.zap) between 10 and 13 then r.zap end;
    -- Não repete quem já está no estúdio com o mesmo nome.
    continue when exists (select 1 from public.estudio_alunos
                           where estudio_id = p_estudio and lower(nome) = lower(r.nome) and situacao = 'ativo');
    insert into public.estudio_alunos (estudio_id, nome, whatsapp) values (p_estudio, r.nome, v_zap);
    n := n + 1;
  end loop;
  return n;
end
$$;

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
              where not exists (select 1 from public.turmas x where x.id = t.id and x.estudio_id = a.estudio_id)) then
    raise exception 'Escolha turmas deste estúdio.';
  end if;
  delete from public.turma_alunos where estudio_aluno_id = a.id and not (turma_id = any (coalesce(p_turmas, '{}')));
  insert into public.turma_alunos (turma_id, estudio_aluno_id)
  select t, a.id from unnest(coalesce(p_turmas, '{}')) t
  on conflict do nothing;
end
$$;

create or replace function public.encerrar_aluno_estudio(p_aluno uuid)
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
    raise exception 'Só a coordenação encerra alunos do estúdio.';
  end if;
  update public.estudio_alunos set situacao = 'encerrado' where id = a.id;
  delete from public.turma_alunos where estudio_aluno_id = a.id;
end
$$;

-- ─── Chamada ───────────────────────────────────────────────────────────────
-- p_marcas: [{aluno, situacao}] com situacao 'presente' ou 'falta'. Pode ser refeita no mesmo dia.
create or replace function public.fazer_chamada(p_aula uuid, p_marcas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas_turma;
  m record;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if a.professor_id is distinct from auth.uid() and not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só o professor da aula ou a coordenação fazem a chamada.';
  end if;
  if a.situacao = 'cancelada' then
    raise exception 'Esta aula foi cancelada.';
  end if;
  if a.inicio > now() + interval '30 minutes' then
    raise exception 'A chamada abre 30 minutos antes da aula.';
  end if;
  for m in select (x ->> 'aluno')::uuid as aluno, x ->> 'situacao' as situacao from jsonb_array_elements(p_marcas) as x loop
    if m.situacao not in ('presente', 'falta') then
      raise exception 'Marque presente ou falta.';
    end if;
    if not exists (select 1 from public.estudio_alunos where id = m.aluno and estudio_id = a.estudio_id) then
      raise exception 'Aluno de fora deste estúdio.';
    end if;
    insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao)
    values (a.id, m.aluno, m.situacao)
    on conflict (aula_turma_id, estudio_aluno_id) do update
      set situacao = case when public.presencas.situacao = 'falta_avisada' and excluded.situacao = 'falta'
                          then 'falta_avisada' else excluded.situacao end,
          marcado_em = now();
  end loop;
  update public.aulas_turma set chamada_em = now() where id = a.id;
end
$$;

-- Equipe do estúdio com nomes (os dados de cada personal são protegidos; aqui só o nome e o papel).
create or replace function public.equipe_do_estudio(p_estudio uuid)
returns table (personal_id uuid, nome text, papel text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.personal_id, p.nome_completo, m.papel
    from public.estudio_membros m join public.personais p on p.id = m.personal_id
   where m.estudio_id = p_estudio and public.papel_no_estudio(p_estudio) is not null
   order by m.papel, p.nome_completo;
$$;

-- ─── Permissões e robô ─────────────────────────────────────────────────────
revoke all on function public.equipe_do_estudio(uuid)           from public, anon;
grant execute on function public.equipe_do_estudio(uuid)           to authenticated;
revoke all on function public.papel_no_estudio(uuid)            from public, anon;
revoke all on function public.coordena_estudio(uuid)            from public, anon;
revoke all on function public.criar_estudio(text)               from public, anon;
revoke all on function public.convidar_para_estudio(uuid, text) from public, anon;
revoke all on function public.ver_convite_estudio(text)         from public;
revoke all on function public.aceitar_convite_estudio(text)     from public, anon;
revoke all on function public.remover_do_estudio(uuid, uuid)    from public, anon;
revoke all on function public.gerar_aulas_turma(uuid)           from public, anon, authenticated;
revoke all on function public.gerar_aulas_turma_de_todas()      from public, anon, authenticated;
revoke all on function public.salvar_turma(uuid, uuid, text, integer, integer, integer, integer, uuid) from public, anon;
revoke all on function public.encerrar_turma(uuid)              from public, anon;
revoke all on function public.importar_alunos_estudio(uuid, jsonb) from public, anon;
revoke all on function public.salvar_turmas_do_aluno(uuid, uuid[]) from public, anon;
revoke all on function public.encerrar_aluno_estudio(uuid)      from public, anon;
revoke all on function public.fazer_chamada(uuid, jsonb)        from public, anon;

grant execute on function public.papel_no_estudio(uuid)            to authenticated;
grant execute on function public.coordena_estudio(uuid)            to authenticated;
grant execute on function public.criar_estudio(text)               to authenticated;
grant execute on function public.convidar_para_estudio(uuid, text) to authenticated;
grant execute on function public.ver_convite_estudio(text)         to anon, authenticated;
grant execute on function public.aceitar_convite_estudio(text)     to authenticated;
grant execute on function public.remover_do_estudio(uuid, uuid)    to authenticated;
grant execute on function public.salvar_turma(uuid, uuid, text, integer, integer, integer, integer, uuid) to authenticated;
grant execute on function public.encerrar_turma(uuid)              to authenticated;
grant execute on function public.importar_alunos_estudio(uuid, jsonb) to authenticated;
grant execute on function public.salvar_turmas_do_aluno(uuid, uuid[]) to authenticated;
grant execute on function public.encerrar_aluno_estudio(uuid)      to authenticated;
grant execute on function public.fazer_chamada(uuid, jsonb)        to authenticated;

-- Todo dia, às 3h20: mantém 8 semanas de aulas de todas as turmas.
select cron.schedule('pbell-gerar-aulas-turma', '20 3 * * *', $$select public.gerar_aulas_turma_de_todas()$$);

commit;
