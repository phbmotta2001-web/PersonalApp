-- 49 · Presença aluno por aluno, na caixa "Aula em andamento" do Início (decisão 87).
-- O professor marca presença ou falta de um aluno com um toque, durante a aula. Diferente de
-- fazer_chamada, não fecha a chamada: quem ficar sem marca recebe presença do robô no fim da aula
-- (chamada_automatica não sobrescreve as marcas já feitas).

begin;

create or replace function public.marcar_presenca(p_aula uuid, p_aluno uuid, p_situacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas_turma;
begin
  select * into a from public.aulas_turma where id = p_aula;
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
  if p_situacao not in ('presente', 'falta') then
    raise exception 'Marque presente ou falta.';
  end if;
  if not exists (select 1 from public.estudio_alunos where id = p_aluno and estudio_id = a.estudio_id) then
    raise exception 'Aluno de fora deste estúdio.';
  end if;
  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao)
  values (a.id, p_aluno, p_situacao)
  on conflict (aula_turma_id, estudio_aluno_id) do update
    set situacao = case when public.presencas.situacao = 'falta_avisada' and excluded.situacao = 'falta'
                        then 'falta_avisada' else excluded.situacao end,
        marcado_em = now();
end
$$;

revoke all on function public.marcar_presenca(uuid, uuid, text) from public, anon;
grant execute on function public.marcar_presenca(uuid, uuid, text) to authenticated;

commit;
