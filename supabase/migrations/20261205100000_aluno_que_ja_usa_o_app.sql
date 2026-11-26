-- 77 · "Convidar para a turma" (decisão 123).
--
-- Aluno do estúdio que ainda não entrou pelo link, mas cujo WhatsApp é o de alguém que já tem
-- conta de aluno no P-Bell: a equipe vê "Convidar para a turma" no lugar de "Convidar para o P-Bell".
-- Devolve só os ids dos alunos do próprio estúdio (nada da conta da pessoa).

begin;

create or replace function public.alunos_do_estudio_que_usam_o_app(p_estudio uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ea.id), '{}')
    from public.estudio_alunos ea
   where ea.estudio_id = p_estudio
     and public.papel_no_estudio(p_estudio) is not null
     and ea.situacao = 'ativo'
     and ea.aluno_id is null
     and ea.whatsapp is not null
     and exists (
       select 1 from public.alunos a
        where a.whatsapp is not null and right(a.whatsapp, 10) = right(ea.whatsapp, 10)
     );
$$;

revoke all on function public.alunos_do_estudio_que_usam_o_app(uuid) from public, anon;
grant execute on function public.alunos_do_estudio_que_usam_o_app(uuid) to authenticated;

commit;
