-- Migração 42 (decisão 73): ficha do aluno do estúdio.
-- • Limitações e objetivos: os do perfil do próprio aluno no P-Bell (os mesmos que o personal vê),
--   lidos pela coordenação e pelos professores do estúdio quando o aluno aceitou o convite.
-- • Treino de cada dia: o professor ou a coordenação escreve o que o aluno faz em cada dia da semana
--   (ex.: "Segunda: peito e tríceps"); o aluno vê na área do estúdio.

create table public.estudio_treinos (
  estudio_aluno_id uuid not null references public.estudio_alunos (id) on delete cascade,
  dia_semana       integer not null check (dia_semana between 0 and 6),
  texto            text not null check (char_length(btrim(texto)) between 1 and 300),
  atualizado_por   uuid references auth.users (id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  primary key (estudio_aluno_id, dia_semana)
);
alter table public.estudio_treinos enable row level security;
-- Sem políticas: só pelas funções abaixo.

-- Ficha para a coordenação e os professores do estúdio.
create or replace function public.ficha_aluno_estudio(p_estudio_aluno uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ea          public.estudio_alunos;
  a           public.alunos;
  s           public.alunos_saude;
  v_consentiu boolean := false;
begin
  select * into ea from public.estudio_alunos where id = p_estudio_aluno;
  if not found or public.papel_no_estudio(ea.estudio_id) is null then
    raise exception 'Só a equipe do estúdio vê a ficha do aluno.';
  end if;
  if ea.aluno_id is not null then
    select * into a from public.alunos where id = ea.aluno_id;
    v_consentiu := public.tem_consentimento_saude(ea.aluno_id);
    if v_consentiu then
      select * into s from public.alunos_saude where aluno_id = ea.aluno_id;
    end if;
  end if;
  return jsonb_build_object(
    'com_app',        ea.aluno_id is not null,
    'objetivo',       nullif(btrim(coalesce(a.objetivo, '')), ''),
    'nivel',          a.nivel,
    'restricoes',     case when v_consentiu then nullif(btrim(s.restricoes), '') end,
    'sem_restricoes', case when v_consentiu then s.restricoes_declaradas_em is not null and btrim(s.restricoes) = '' else false end,
    'dias',           coalesce((select jsonb_agg(distinct t.dia_semana)
                                  from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id
                                 where ta.estudio_aluno_id = ea.id and t.ativa), '[]'::jsonb),
    'treino',         coalesce((select jsonb_agg(jsonb_build_object('dia', dia_semana, 'texto', texto) order by dia_semana)
                                  from public.estudio_treinos where estudio_aluno_id = ea.id), '[]'::jsonb)
  );
end
$$;

-- O professor ou a coordenação escreve o treino de um dia (texto vazio apaga).
create or replace function public.salvar_treino_aluno_estudio(p_estudio_aluno uuid, p_dia integer, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ea public.estudio_alunos;
begin
  select * into ea from public.estudio_alunos where id = p_estudio_aluno;
  if not found or public.papel_no_estudio(ea.estudio_id) is null then
    raise exception 'Só a equipe do estúdio escreve o treino.';
  end if;
  if p_dia is null or p_dia not between 0 and 6 then
    raise exception 'Escolha o dia.';
  end if;
  if char_length(coalesce(p_texto, '')) > 300 then
    raise exception 'Até 300 letras por dia.';
  end if;
  if btrim(coalesce(p_texto, '')) = '' then
    delete from public.estudio_treinos where estudio_aluno_id = ea.id and dia_semana = p_dia;
  else
    insert into public.estudio_treinos (estudio_aluno_id, dia_semana, texto, atualizado_por)
    values (ea.id, p_dia, btrim(p_texto), auth.uid())
    on conflict (estudio_aluno_id, dia_semana)
    do update set texto = excluded.texto, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  end if;
end
$$;

-- O aluno vê o próprio treino de cada dia no estúdio.
create or replace function public.meu_treino_no_estudio(p_estudio uuid)
returns table (dia_semana integer, texto text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.dia_semana, t.texto
    from public.estudio_treinos t
    join public.estudio_alunos ea on ea.id = t.estudio_aluno_id
   where ea.estudio_id = p_estudio and ea.aluno_id = auth.uid()
   order by t.dia_semana
$$;

revoke all on function public.ficha_aluno_estudio(uuid) from public, anon;
revoke all on function public.salvar_treino_aluno_estudio(uuid, integer, text) from public, anon;
revoke all on function public.meu_treino_no_estudio(uuid) from public, anon;
grant execute on function public.ficha_aluno_estudio(uuid) to authenticated;
grant execute on function public.salvar_treino_aluno_estudio(uuid, integer, text) to authenticated;
grant execute on function public.meu_treino_no_estudio(uuid) to authenticated;
