-- ═══════════════════════════════════════════════════════════════════════════
-- P-Bell: a conta da equipe testa todas as áreas (10/11/2026).
--
-- A conta da equipe já é um personal (e pode coordenar um estúdio). Esta função dá a ela
-- também um perfil de ALUNO, com o mesmo login: assim ela abre a área do aluno e aceita
-- convites (inclusive os que ela mesma manda como personal), sem criar outro e-mail.
-- Só vale para quem está na tabela "equipe".
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- ANTES de enviar o site novo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.ativar_aluno_da_equipe()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
begin
  if not public.sou_da_equipe() then
    raise exception 'Só a equipe do P-Bell tem o perfil de teste.';
  end if;
  select nome_completo into v_nome from public.personais where id = auth.uid();
  insert into public.alunos (id, nome_completo, data_nascimento)
  values (auth.uid(), coalesce(v_nome, 'Equipe P-Bell'), date '1990-01-01')
  on conflict (id) do nothing;
end
$$;

revoke all on function public.ativar_aluno_da_equipe() from public, anon;
grant execute on function public.ativar_aluno_da_equipe() to authenticated;

commit;
