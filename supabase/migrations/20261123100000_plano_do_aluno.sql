-- 65 · O aluno do estúdio vê até quando vai o plano dele (decisão 103).
--
-- • Plano trimestral, semestral ou anual: o app mostra ao aluno a data em que o período atual
--   termina (o plano se renova sozinho). Plano mensal não mostra data.

begin;

create or replace function public.meu_plano_no_estudio(p_estudio uuid)
returns table (meses integer, inicio date)
language sql
stable
security definer
set search_path = ''
as $$
  select al.plano_meses, al.plano_inicio
    from public.estudio_alunos al
   where al.id = public.meu_aluno_no_estudio(p_estudio);
$$;

revoke all on function public.meu_plano_no_estudio(uuid) from public, anon;
grant execute on function public.meu_plano_no_estudio(uuid) to authenticated;

commit;
