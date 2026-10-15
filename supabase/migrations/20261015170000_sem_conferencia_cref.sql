-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: sem conferência do CREF.
--
-- Decisão de 15/10/2026: na Fase 1 o Pienel é a agenda do personal com os PRÓPRIOS
-- alunos (não há captação), então a conta não precisa esperar a equipe conferir o
-- CREF. Toda conta de personal nasce "aprovado".
-- O CREF continua sendo pedido no cadastro, e a situação continua existindo para a
-- Fase 2 (marketplace), quando a conferência volta a fazer sentido.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261015140000_horarios_de_trabalho.sql.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.personais alter column situacao set default 'aprovado';

-- Libera as contas que estavam esperando a conferência.
update public.personais set situacao = 'aprovado' where situacao = 'em_analise';

comment on column public.personais.situacao is
  'Fase 1: nasce aprovado (sem conferência do CREF). Fase 2: em_analise até a equipe conferir o CREF.';

commit;
