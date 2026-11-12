-- Migração 41 (decisão 69): remover e dar professor a vários horários de uma vez só,
-- numa chamada ao banco (antes era um horário por vez: lento).

create or replace function public.encerrar_turmas(p_turmas uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estudio uuid;
  n integer;
begin
  if p_turmas is null or cardinality(p_turmas) = 0 then
    return 0;
  end if;
  if cardinality(p_turmas) > 1000 then
    raise exception 'No máximo 1000 horários de uma vez.';
  end if;
  for v_estudio in select distinct estudio_id from public.turmas where id = any(p_turmas) loop
    if not public.coordena_estudio(v_estudio) then
      raise exception 'Só a coordenação encerra turmas.';
    end if;
  end loop;
  update public.turmas set ativa = false where id = any(p_turmas) and ativa;
  get diagnostics n = row_count;
  delete from public.aulas_turma where turma_id = any(p_turmas) and inicio > now() and chamada_em is null;
  return n;
end
$$;

create or replace function public.atribuir_professor_turmas(p_estudio uuid, p_turmas uuid[], p_professor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação cria e altera turmas.';
  end if;
  if p_turmas is null or cardinality(p_turmas) = 0 then
    return 0;
  end if;
  if cardinality(p_turmas) > 1000 then
    raise exception 'No máximo 1000 horários de uma vez.';
  end if;
  if p_professor is not null and not exists (
      select 1 from public.estudio_membros where estudio_id = p_estudio and personal_id = p_professor) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  -- Aulas futuras sem chamada que estavam com o professor da turma (trocas de um dia só ficam).
  update public.aulas_turma a
     set professor_id = p_professor
    from public.turmas t
   where t.id = any(p_turmas) and t.estudio_id = p_estudio and t.ativa and t.avulsa is null
     and a.turma_id = t.id and a.inicio > now() and a.chamada_em is null
     and a.professor_id is not distinct from t.professor_id;
  update public.turmas
     set professor_id = p_professor
   where id = any(p_turmas) and estudio_id = p_estudio and ativa and avulsa is null;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.encerrar_turmas(uuid[]) from public, anon;
revoke all on function public.atribuir_professor_turmas(uuid, uuid[], uuid) from public, anon;
grant execute on function public.encerrar_turmas(uuid[]) to authenticated;
grant execute on function public.atribuir_professor_turmas(uuid, uuid[], uuid) to authenticated;
