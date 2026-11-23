-- 73 · Lembrete de 1 hora antes para o personal (decisão 116).
--
-- • O personal recebe "Aula às 15:00 com Ana" 1 hora antes de cada aula particular, menos a primeira
--   do dia (o "Bom dia" já avisa dela). Turmas do estúdio não entram.
-- • Se a aula for desmarcada ou mudar de horário antes do aviso sair, o aviso antigo é descartado
--   (o novo horário gera outro). Vale também para o lembrete do aluno, que antes podia sair com o
--   horário antigo.

begin;

create or replace function public.lembrete_personal_aulas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  -- Avisos que ainda não saíram de aulas desmarcadas ou com outro horário.
  update public.notificacoes x
     set descartada_em = now()
   where x.enviada_em is null and x.descartada_em is null
     and x.tipo in ('lembrete_personal', 'lembrete_aula') and x.aula_id is not null
     and not exists (
       select 1 from public.aulas a
        where a.id = x.aula_id and a.situacao in ('agendada', 'confirmada')
          and x.chave in ('lembrete-personal:' || a.id || ':' || extract(epoch from a.inicio)::bigint,
                          'lembrete:' || a.id || ':' || extract(epoch from a.inicio)::bigint));

  for r in
    select a.id, a.personal_id, a.vinculo_id, a.inicio, a.local
      from public.aulas a
     where a.situacao in ('agendada', 'confirmada') and a.vinculo_id is not null
       and a.inicio > now() + interval '10 minutes' and a.inicio <= now() + interval '12 hours'
       -- A primeira aula do dia (particular ou turma do estúdio) já vem no "Bom dia".
       and exists (
         select 1 from public.aulas b
          where b.personal_id = a.personal_id and b.situacao in ('agendada', 'confirmada') and b.vinculo_id is not null
            and b.inicio < a.inicio
            and (b.inicio at time zone 'America/Sao_Paulo')::date = (a.inicio at time zone 'America/Sao_Paulo')::date
         union all
         select 1 from public.aulas_turma t
           join public.turmas tu on tu.id = t.turma_id and tu.tipo = 'turma'
          where t.professor_id = a.personal_id and t.situacao = 'agendada'
            and t.inicio < a.inicio
            and (t.inicio at time zone 'America/Sao_Paulo')::date = (a.inicio at time zone 'America/Sao_Paulo')::date)
  loop
    perform public.notificar(r.personal_id, 'lembrete_personal',
      'Aula às ' || to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24:MI') || ' com ' || public.primeiro_nome_do_aluno(r.vinculo_id),
      coalesce(nullif(btrim(r.local), ''), 'Toque para ver a aula.'),
      '/agenda/aula/' || r.id, p_quando => r.inicio - interval '1 hour',
      p_chave => 'lembrete-personal:' || r.id || ':' || extract(epoch from r.inicio)::bigint,
      p_aula => r.id, p_respeita_silencio => false);
    n := n + 1;
  end loop;
  return n;
end
$$;
revoke all on function public.lembrete_personal_aulas() from public, anon, authenticated;

-- A cada minuto: assim um aviso de aula desmarcada nunca chega a sair.
select cron.schedule('pbell-lembrete-personal', '* * * * *', $$select public.lembrete_personal_aulas()$$);

commit;
