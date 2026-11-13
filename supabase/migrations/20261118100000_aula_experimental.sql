-- 53 · Aula experimental (decisão 92).
-- • Qualquer pessoa da equipe agenda uma aula experimental numa aula de turma (uma data só): o
--   aluno é cadastrado como "experimental", ocupa uma vaga naquela aula (como a reposição) e
--   ganha um link de cadastro para o app.
-- • Depois, a coordenação decide: "Cadastrar aluno" (vira aluno ativo, nas turmas escolhidas)
--   ou "Desistência" (não entrou). Isso fica guardado para a taxa de conversão do estúdio e
--   de cada professor (quem deu a aula).

begin;

alter table public.estudio_alunos drop constraint if exists estudio_alunos_situacao_check;
alter table public.estudio_alunos add constraint estudio_alunos_situacao_check
  check (situacao in ('ativo', 'encerrado', 'experimental', 'desistiu'));

alter table public.presencas drop constraint if exists presencas_origem_check;
alter table public.presencas add constraint presencas_origem_check
  check (origem in ('fixa', 'reposicao', 'experimental'));

create table if not exists public.estudio_experimentais (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  estudio_aluno_id  uuid not null unique references public.estudio_alunos (id) on delete cascade,
  aula_turma_id     uuid references public.aulas_turma (id) on delete set null,
  data              date not null,
  -- Quem dá a aula experimental (conta para a conversão do professor).
  professor_id      uuid references auth.users (id) on delete set null,
  agendado_por      uuid references auth.users (id) on delete set null,
  criado_em         timestamptz not null default now(),
  resultado         text check (resultado in ('matriculou', 'desistiu')),
  resultado_em      timestamptz
);
create index if not exists estudio_experimentais_por_estudio on public.estudio_experimentais (estudio_id, data);
comment on table public.estudio_experimentais is 'Aulas experimentais e o resultado (matriculou ou desistiu), para a taxa de conversão.';
alter table public.estudio_experimentais enable row level security;
create policy "equipe vê as experimentais do estúdio" on public.estudio_experimentais
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

-- Agenda a experimental. Devolve {aluno, codigo} (o código do link de cadastro, vale 14 dias).
create or replace function public.agendar_aula_experimental(p_aula uuid, p_nome text, p_whatsapp text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas_turma;
  t      public.turmas;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_zap  text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_cod  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_al   uuid;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if public.papel_no_estudio(a.estudio_id) is null then
    raise exception 'Só a equipe do estúdio agenda aula experimental.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  if t.tipo <> 'turma' or a.situacao = 'cancelada' then
    raise exception 'Esta aula não recebe alunos.';
  end if;
  if a.inicio <= now() then
    raise exception 'Escolha uma aula que ainda vai acontecer.';
  end if;
  if char_length(v_nome) not between 2 and 80 then
    raise exception 'Escreva o nome do aluno.';
  end if;
  if v_zap is not null and v_zap !~ '^\d{10,13}$' then
    raise exception 'Confira o WhatsApp (com DDD).';
  end if;
  if public.ocupacao_aula_turma(a.id) >= t.vagas then
    raise exception 'Esta aula está lotada.';
  end if;

  insert into public.estudio_alunos (estudio_id, nome, whatsapp, situacao, convite_codigo, convite_expira_em)
  values (a.estudio_id, v_nome, v_zap, 'experimental', v_cod, now() + interval '14 days')
  returning id into v_al;
  insert into public.estudio_experimentais (estudio_id, estudio_aluno_id, aula_turma_id, data, professor_id, agendado_por)
  values (a.estudio_id, v_al, a.id, (a.inicio at time zone 'America/Sao_Paulo')::date, a.professor_id, auth.uid());
  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
  values (a.id, v_al, 'presente', 'experimental');

  if a.professor_id is not null and a.professor_id is distinct from auth.uid() then
    perform public.notificar(a.professor_id, 'experimental_estudio', 'Aula experimental',
      split_part(v_nome, ' ', 1) || ' vem fazer aula experimental na sua turma de ' || public.texto_aula_turma(a.id) || '.',
      '/agenda/turma/' || a.id, now(), null, null, null, null, null, true);
  end if;
  return jsonb_build_object('aluno', v_al, 'codigo', v_cod);
end
$$;

-- "Cadastrar aluno": o experimental vira aluno ativo nas turmas escolhidas.
create or replace function public.matricular_experimental(p_aluno uuid, p_turmas uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  al public.estudio_alunos;
begin
  select * into al from public.estudio_alunos where id = p_aluno for update;
  if not found or not public.coordena_estudio(al.estudio_id) then
    raise exception 'Só a coordenação cadastra o aluno.';
  end if;
  if al.situacao <> 'experimental' then
    raise exception 'Este aluno não está em aula experimental.';
  end if;
  if coalesce(array_length(p_turmas, 1), 0) = 0 then
    raise exception 'Escolha pelo menos uma turma.';
  end if;
  update public.estudio_alunos
     set situacao = 'ativo',
         taxa_pendente = (select e.taxa_matricula_centavos is not null from public.estudios e where e.id = al.estudio_id)
   where id = al.id;
  perform public.salvar_turmas_do_aluno(al.id, p_turmas);
  update public.estudio_experimentais set resultado = 'matriculou', resultado_em = now() where estudio_aluno_id = al.id;
end
$$;

-- "Desistência": não entrou. Sai da aula experimental se ela ainda não aconteceu.
create or replace function public.desistencia_experimental(p_aluno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  al public.estudio_alunos;
begin
  select * into al from public.estudio_alunos where id = p_aluno for update;
  if not found or not public.coordena_estudio(al.estudio_id) then
    raise exception 'Só a coordenação marca a desistência.';
  end if;
  if al.situacao <> 'experimental' then
    raise exception 'Este aluno não está em aula experimental.';
  end if;
  update public.estudio_alunos set situacao = 'desistiu', convite_codigo = null, convite_expira_em = null where id = al.id;
  delete from public.presencas p
   using public.aulas_turma a
   where a.id = p.aula_turma_id and p.estudio_aluno_id = al.id and p.origem = 'experimental' and a.inicio > now();
  update public.estudio_experimentais set resultado = 'desistiu', resultado_em = now() where estudio_aluno_id = al.id;
end
$$;

-- O link de cadastro também vale para quem está em aula experimental.
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
      where al.convite_codigo = p_codigo and al.situacao in ('ativo', 'experimental')),
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
  select * into al from public.estudio_alunos where convite_codigo = p_codigo and situacao in ('ativo', 'experimental') for update;
  if not found or al.convite_expira_em < now() then
    raise exception 'Este convite não vale mais. Peça um novo ao estúdio.';
  end if;
  if exists (select 1 from public.estudio_alunos x
              where x.estudio_id = al.estudio_id and x.aluno_id = auth.uid() and x.id <> al.id and x.situacao in ('ativo', 'experimental')) then
    raise exception 'Sua conta já está ligada a outro cadastro deste estúdio.';
  end if;
  update public.estudio_alunos set aluno_id = auth.uid(), convite_codigo = null, convite_expira_em = null where id = al.id;
  return al.estudio_id;
end
$$;

revoke all on function public.agendar_aula_experimental(uuid, text, text) from public, anon;
revoke all on function public.matricular_experimental(uuid, uuid[])       from public, anon;
revoke all on function public.desistencia_experimental(uuid)              from public, anon;
grant execute on function public.agendar_aula_experimental(uuid, text, text) to authenticated;
grant execute on function public.matricular_experimental(uuid, uuid[])       to authenticated;
grant execute on function public.desistencia_experimental(uuid)              to authenticated;

commit;
