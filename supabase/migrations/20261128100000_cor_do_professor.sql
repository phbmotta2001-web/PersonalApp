-- Decisão 112: a coordenação escolhe a cor de cada professor na agenda do estúdio.
-- cor = posição na paleta do app (0 a 11, ver src/lib/cores-professor.ts); vazio = cor automática
-- pela ordem do professor na equipe (como era antes).

alter table public.estudio_membros
  add column if not exists cor smallint check (cor between 0 and 11);

create or replace function public.salvar_cor_professor(p_estudio uuid, p_personal uuid, p_cor smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda a cor dos professores.';
  end if;
  if p_cor is not null and (p_cor < 0 or p_cor > 11) then
    raise exception 'Cor inválida.';
  end if;
  update public.estudio_membros
     set cor = p_cor
   where estudio_id = p_estudio and personal_id = p_personal;
  if not found then
    raise exception 'Professor não encontrado no estúdio.';
  end if;
end
$$;

revoke all on function public.salvar_cor_professor(uuid, uuid, smallint) from public, anon;
grant execute on function public.salvar_cor_professor(uuid, uuid, smallint) to authenticated;
