-- 72 · Remover aluno do estúdio (decisão 115).
--
-- A coordenação remove o aluno pela ficha dele:
-- • Aluno sem conta no app (cadastrado pela coordenação ou por um professor): é apagado do banco,
--   com a frequência, as mensalidades e o resto ligado a ele.
-- • Aluno com o app: fica como "encerrado". Sai das turmas, da fila de espera e das reposições já
--   marcadas, deixa de contar nos alunos do estúdio e perde a aba do estúdio no app. O histórico fica.

begin;

create or replace function public.remover_aluno_estudio(p_aluno uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.estudio_alunos;
  t uuid;
begin
  select * into a from public.estudio_alunos where id = p_aluno for update;
  if not found or not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só a coordenação remove alunos do estúdio.';
  end if;

  if a.aluno_id is null then
    delete from public.estudio_alunos where id = a.id;
    return 'excluido';
  end if;

  update public.estudio_alunos set situacao = 'encerrado' where id = a.id;
  delete from public.turma_alunos where estudio_aluno_id = a.id;
  -- Reposições e aulas avulsas já marcadas daqui para a frente.
  delete from public.presencas p
   using public.aulas_turma au
   where au.id = p.aula_turma_id and p.estudio_aluno_id = a.id and au.inicio > now();
  update public.estudio_pedidos_frequencia set situacao = 'cancelado', decidido_em = now()
   where estudio_aluno_id = a.id and situacao = 'pendente';
  -- Sai da fila; se ele estava com uma vaga oferecida, ela vai para o próximo.
  for t in
    update public.estudio_fila set situacao = 'saiu'
     where estudio_aluno_id = a.id and situacao in ('esperando', 'oferecida', 'pedido')
    returning turma_id
  loop
    perform public.oferecer_vagas_fila(t);
  end loop;
  return 'encerrado';
end
$$;

revoke all on function public.remover_aluno_estudio(uuid) from public, anon;
grant execute on function public.remover_aluno_estudio(uuid) to authenticated;

commit;
