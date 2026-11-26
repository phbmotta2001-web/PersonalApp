-- 76 · Convidar para o P-Bell (decisão 122).
--
-- O professor do estúdio também gera o link do app para o aluno sem app (antes só a coordenação).
-- Enquanto o link ainda vale, devolve o mesmo (quem já recebeu o link não perde).

begin;

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
  if not found or public.papel_no_estudio(al.estudio_id) is null then
    raise exception 'Aluno não encontrado.';
  end if;
  if al.aluno_id is not null then
    raise exception 'Este aluno já entrou no app.';
  end if;
  if al.convite_codigo is not null and al.convite_expira_em > now() then
    return al.convite_codigo;
  end if;
  update public.estudio_alunos set convite_codigo = v, convite_expira_em = now() + interval '14 days' where id = al.id;
  return v;
end
$$;

revoke all on function public.convite_aluno_estudio(uuid) from public, anon;
grant execute on function public.convite_aluno_estudio(uuid) to authenticated;

commit;
