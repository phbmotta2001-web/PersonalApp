-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell: a conta da equipe abre direto no painel da beta.
--
-- Decisão de 08/11/2026: a conta de administração é criada como personal (único
-- cadastro aberto), mas ao entrar vai para /equipe, sem agenda nem primeiro acesso.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez, depois de
-- 20261108120000_painel_sem_a_equipe.sql e ANTES de enviar o site novo.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.sou_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipe where usuario_id = auth.uid());
$$;

revoke all on function public.sou_da_equipe() from public, anon;
grant execute on function public.sou_da_equipe() to authenticated;

commit;
