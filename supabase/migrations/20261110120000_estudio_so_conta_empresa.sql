-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell Estúdio: só a conta empresarial cadastra estúdio (10/11/2026, decisão 57).
--
-- O personal entra num estúdio só pelo convite da coordenação; não cria estúdio.
-- Quem cria: a conta empresarial (cadastro em /cadastro/empresa) e a conta da equipe
-- do P-Bell (para testar). Os estúdios que já existem continuam como estão.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- ANTES de enviar o site novo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.criar_estudio(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só a conta empresarial cadastra um estúdio.';
  end if;
  if coalesce((select u.raw_user_meta_data ->> 'conta' from auth.users u where u.id = auth.uid()), '') <> 'empresa'
     and not public.sou_da_equipe() then
    raise exception 'Só a conta empresarial cadastra um estúdio. O personal entra pelo convite da coordenação.';
  end if;
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 80 then
    raise exception 'Informe o nome do estúdio.';
  end if;
  insert into public.estudios (nome, criado_por) values (btrim(p_nome), auth.uid()) returning id into v_id;
  insert into public.estudio_membros (estudio_id, personal_id, papel) values (v_id, auth.uid(), 'coordenacao');
  return v_id;
end
$$;

commit;
