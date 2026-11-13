-- 50 · Aviso de aluno novo e "bom dia" do personal (decisão 88).
-- 1. Quando o aluno aceita o convite (o que exige o perfil completo), o personal recebe a
--    notificação para incluir o aluno na agenda.
-- 2. Todo dia, às 9h, o personal recebe "Bom dia" com quantas aulas tem no dia. Se houver aula
--    antes das 9h, a notificação chega 20 minutos antes da primeira aula. Dia sem aula: não envia.

begin;

-- ─── 1. Aluno novo ─────────────────────────────────────────────────────────
create or replace function public.vinculo_notificar_aluno_novo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.situacao = 'convidado' and new.situacao = 'ativo' and new.aluno_id is not null then
    perform public.notificar(new.personal_id, 'aluno_novo',
      coalesce(public.primeiro_nome_do_aluno(new.id), 'Um aluno') || ' completou o cadastro',
      'Toque para incluir na sua agenda.',
      '/agenda/alunos/' || new.id || '/matricula',
      p_chave => 'aluno-novo:' || new.id, p_vinculo => new.id);
  end if;
  return new;
end
$$;
revoke all on function public.vinculo_notificar_aluno_novo() from public, anon, authenticated;

drop trigger if exists vinculos_aluno_novo on public.vinculos;
create trigger vinculos_aluno_novo
  after update of situacao on public.vinculos
  for each row execute function public.vinculo_notificar_aluno_novo();

-- ─── 2. Bom dia ────────────────────────────────────────────────────────────
-- Roda a cada 5 minutos: quando chega a hora de cada personal (9h, ou 20 min antes da primeira
-- aula se ela for antes das 9h), conta as aulas do dia e avisa. A chave impede repetir no dia.
create or replace function public.bom_dia_personais()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje   date := public.hoje_brasilia();
  as_9h  timestamptz := public.instante_brasilia(public.hoje_brasilia(), 540);
  r      record;
  alvo   timestamptz;
  n      integer := 0;
begin
  for r in
    with do_dia as (
      select a.personal_id, a.inicio from public.aulas a
       where a.situacao in ('agendada', 'confirmada') and a.vinculo_id is not null
         and a.inicio >= public.instante_brasilia(hoje, 0) and a.inicio < public.instante_brasilia(hoje + 1, 0)
      union all
      select at.professor_id, at.inicio from public.aulas_turma at
        join public.turmas t on t.id = at.turma_id and t.tipo = 'turma'
       where at.situacao = 'agendada' and at.professor_id is not null
         and at.inicio >= public.instante_brasilia(hoje, 0) and at.inicio < public.instante_brasilia(hoje + 1, 0)
    )
    select d.personal_id, count(*)::integer as aulas, min(d.inicio) as primeira
      from do_dia d
     where exists (select 1 from public.push_inscricoes p where p.usuario_id = d.personal_id)
       and not exists (select 1 from public.notificacoes x where x.chave = 'bom-dia:' || d.personal_id || ':' || hoje)
     group by d.personal_id
  loop
    alvo := case when r.primeira < as_9h then r.primeira - interval '20 minutes' else as_9h end;
    if now() >= alvo and now() < r.primeira + interval '1 hour' then
      perform public.notificar(r.personal_id, 'bom_dia', 'Bom dia!',
        'Hoje você tem ' || r.aulas || case when r.aulas = 1 then ' aula' else ' aulas' end
          || '. A primeira às ' || to_char(r.primeira at time zone 'America/Sao_Paulo', 'HH24:MI') || '.',
        '/agenda', p_chave => 'bom-dia:' || r.personal_id || ':' || hoje, p_respeita_silencio => false);
      n := n + 1;
    end if;
  end loop;
  return n;
end
$$;
revoke all on function public.bom_dia_personais() from public, anon, authenticated;

select cron.schedule('pbell-bom-dia', '*/5 * * * *', $$select public.bom_dia_personais()$$);

commit;
