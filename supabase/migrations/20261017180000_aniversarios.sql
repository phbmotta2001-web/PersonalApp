-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: aniversários dos alunos do mês na agenda do personal.
--
-- Decisão de 17/10/2026: o personal vê o DIA e o MÊS do aniversário dos alunos
-- ativos (além da idade, que já via). O e-mail continua nunca aparecendo.
-- O aluno é avisado disso no convite e no perfil.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261017140000_aluno_cancela_e_remarca.sql.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Alunos ativos do personal logado que fazem aniversário no mês de p_data (Brasília).
-- Quem nasceu em 29/02 aparece em 28/02 nos anos que não são bissextos.
create or replace function public.aniversariantes_do_mes(p_data date default null)
returns table (vinculo_id uuid, nome text, dia integer, faz_anos integer)
language sql
stable
security definer
set search_path = ''
as $$
  with ref as (select coalesce(p_data, public.hoje_brasilia()) as d)
  select v.id,
         a.nome_completo,
         case
           when extract(month from a.data_nascimento) = 2 and extract(day from a.data_nascimento) = 29
                and extract(day from (date_trunc('month', ref.d) + interval '1 month' - interval '1 day')) = 28
           then 28
           else extract(day from a.data_nascimento)::int
         end,
         (extract(year from ref.d) - extract(year from a.data_nascimento))::int
    from ref, public.vinculos v
    join public.alunos a on a.id = v.aluno_id
   where v.personal_id = auth.uid()
     and v.situacao = 'ativo'
     and extract(month from a.data_nascimento) = extract(month from ref.d)
   order by 3, 2
$$;

revoke all on function public.aniversariantes_do_mes(date) from public, anon;
grant execute on function public.aniversariantes_do_mes(date) to authenticated;

commit;
