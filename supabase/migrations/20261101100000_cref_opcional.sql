-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell, Fase 1: CREF opcional no cadastro do personal.
--
-- Decisão de 01/11/2026 (ver docs/plano-fase-1-agenda.md, decisão 53): alguns personais
-- que vão testar a beta ainda não são formados. Quem informa o CREF informa número e
-- estado; quem não tem deixa os dois em branco, e o app simplesmente não mostra o CREF.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261031100000_nome_pbell.sql e ANTES de enviar o site novo.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.personais
  alter column cref drop not null,
  alter column cref_uf drop not null,
  add constraint personais_cref_completo check ((cref is null) = (cref_uf is null));

comment on column public.personais.cref is
  'Número do CREF. Opcional na Fase 1: vazio para quem ainda não é formado (junto com cref_uf).';

commit;
