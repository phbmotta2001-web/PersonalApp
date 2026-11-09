-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell Estúdio: chamada só com falta (09/11/2026, decisão 56).
--
-- O professor marca só quem faltou; quem não é marcado recebe presença. Se a aula
-- termina e ninguém fez a chamada, o robô dá presença a todos os alunos da turma
-- (menos quem avisou a falta). O professor ou a coordenação ainda podem corrigir depois.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261109140000_estudios_financeiro.sql e ANTES de enviar o site novo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.chamada_automatica()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  n integer := 0;
begin
  for a in
    select at.id, at.turma_id from public.aulas_turma at
     where at.situacao = 'agendada' and at.chamada_em is null
       and at.fim <= now() and at.fim > now() - interval '7 days'
     for update skip locked
  loop
    insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao)
    select a.id, ta.estudio_aluno_id, 'presente'
      from public.turma_alunos ta
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where ta.turma_id = a.turma_id
    on conflict (aula_turma_id, estudio_aluno_id) do nothing;
    update public.aulas_turma set chamada_em = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.chamada_automatica() from public, anon, authenticated;

-- A cada 15 minutos: aulas que terminaram sem chamada.
select cron.schedule('pbell-chamada-automatica', '*/15 * * * *', $$select public.chamada_automatica()$$);

commit;
