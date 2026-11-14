-- 68 · O treino de cada aluno na aula da turma (decisão 106).
--
-- • Ao abrir uma aula (antes e durante a chamada), o professor vê, embaixo do nome de cada aluno,
--   o treino daquele dia da semana (o que foi escrito na ficha do aluno). Quem não tem treino
--   escrito para o dia aparece só com o nome.

begin;

create or replace function public.treinos_da_aula_estudio(p_aula uuid)
returns table (estudio_aluno_id uuid, texto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a     public.aulas_turma;
  v_dia integer;
begin
  select * into a from public.aulas_turma where id = p_aula;
  if not found or public.papel_no_estudio(a.estudio_id) is null then
    return;
  end if;
  v_dia := extract(dow from (a.inicio at time zone 'America/Sao_Paulo'))::integer;
  return query
  select t.estudio_aluno_id, t.texto
    from public.estudio_treinos t
   where t.dia_semana = v_dia
     and (exists (select 1 from public.turma_alunos ta where ta.turma_id = a.turma_id and ta.estudio_aluno_id = t.estudio_aluno_id)
          or exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = t.estudio_aluno_id));
end
$$;

revoke all on function public.treinos_da_aula_estudio(uuid) from public, anon;
grant execute on function public.treinos_da_aula_estudio(uuid) to authenticated;

commit;
