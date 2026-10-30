-- ═══════════════════════════════════════════════════════════════════════════
-- Kout: troca do nome provisório "Pienel" no que está vivo no banco.
--
-- Decisão de 30/10/2026 (ver docs/plano-fase-1-agenda.md, decisão 51). As migrations
-- antigas ficam como estão, como registro; esta acerta o resultado delas:
-- • textos das funções (notificações e mensagens de erro) e o cabeçalho do envio de push;
-- • nomes das tarefas agendadas;
-- • descrições das tabelas e colunas.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261028100000_feriados_e_pedidos_do_personal.sql e ANTES de enviar o site novo.
-- (Notificações que saírem entre rodar isto e o site novo entrar no ar ficam na fila.)
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  r record;
begin
  -- Funções: recriadas com o mesmo conteúdo e o nome novo (as permissões continuam).
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ilike '%pienel%'
  loop
    execute replace(replace(pg_get_functiondef(r.oid), 'Pienel', 'Kout'), 'pienel', 'kout');
  end loop;

  -- Tarefas agendadas.
  for r in select jobname, schedule, command from cron.job where jobname like 'pienel-%' loop
    perform cron.unschedule(r.jobname);
    perform cron.schedule(replace(r.jobname, 'pienel-', 'kout-'), r.schedule, r.command);
  end loop;
end
$$;

comment on table public.push_inscricoes is
  'Celulares/navegadores que aceitaram receber notificações do Kout (um por aparelho).';
comment on column public.vinculos.sem_conta is
  'Aluno cadastrado pelo personal, sem conta no Kout (aluno_id fica vazio até ele aceitar um convite).';
comment on column public.bloqueios.feriado is
  'Bloqueio criado pelo Kout para um feriado em que o personal não trabalha (nome do feriado).';

commit;
