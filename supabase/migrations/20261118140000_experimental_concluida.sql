-- 54 · Experimental concluída (decisão 93).
-- Quando a aula experimental termina, a coordenação recebe uma notificação e o aluno aparece
-- grande no Início dela, com "Cadastrar aluno", "Descartar" e "Entrar em contato".

begin;

alter table public.estudio_experimentais add column if not exists avisado_em timestamptz;

create or replace function public.avisar_experimentais_concluidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  m      record;
  v_txt  text;
  n      integer := 0;
begin
  for r in
    select x.id, x.estudio_id, x.aula_turma_id, x.estudio_aluno_id, al.nome,
           (select p.situacao from public.presencas p
             where p.aula_turma_id = x.aula_turma_id and p.estudio_aluno_id = x.estudio_aluno_id) as presenca
      from public.estudio_experimentais x
      join public.aulas_turma a on a.id = x.aula_turma_id
      join public.estudio_alunos al on al.id = x.estudio_aluno_id and al.situacao = 'experimental'
     where x.resultado is null and x.avisado_em is null
       and a.situacao <> 'cancelada' and a.fim <= now() and a.fim > now() - interval '7 days'
     for update of x skip locked
  loop
    v_txt := split_part(btrim(r.nome), ' ', 1)
          || case when r.presenca = 'falta' then ' faltou à aula experimental de ' else ' fez a aula experimental de ' end
          || public.texto_aula_turma(r.aula_turma_id) || '. Cadastre, descarte ou entre em contato.';
    for m in select personal_id from public.estudio_membros where estudio_id = r.estudio_id and papel = 'coordenacao' loop
      perform public.notificar(m.personal_id, 'experimental_concluida', 'Aula experimental concluída', v_txt, '/agenda',
        p_chave => 'experimental-concluida:' || r.id || ':' || m.personal_id);
    end loop;
    update public.estudio_experimentais set avisado_em = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.avisar_experimentais_concluidas() from public, anon, authenticated;

select cron.schedule('pbell-experimental-concluida', '*/10 * * * *', $$select public.avisar_experimentais_concluidas()$$);

commit;
