-- 75 · Regras do personal no primeiro acesso do aluno (decisão 118).
--
-- Na primeira vez que o aluno entra depois de virar aluno de um personal, o Início mostra as regras
-- desse personal (antecedência para desmarcar, para marcar reposição, pausas) com "Li e entendi".
-- Quem já era aluno antes desta migração não vê (já usa o app).

begin;

alter table public.vinculos add column if not exists regras_vistas_em timestamptz;

update public.vinculos set regras_vistas_em = now()
 where aluno_id is not null and regras_vistas_em is null;

-- Aluno: regras dos personais que ainda não confirmou.
create or replace function public.regras_pendentes()
returns table (vinculo_id uuid, cancelamento_h integer, reposicao_h integer, pausa_dias integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, p.antecedencia_cancelamento_h, p.antecedencia_reposicao_h, p.pausa_dias_ano
    from public.vinculos v
    join public.personais p on p.id = v.personal_id
   where v.aluno_id = auth.uid() and v.situacao = 'ativo' and v.regras_vistas_em is null
   order by v.aceito_em;
$$;

create or replace function public.confirmar_regras(p_vinculo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.vinculos set regras_vistas_em = coalesce(regras_vistas_em, now())
   where id = p_vinculo and aluno_id = auth.uid();
  if not found then
    raise exception 'Vínculo não encontrado.';
  end if;
end
$$;

revoke all on function public.regras_pendentes()        from public, anon;
revoke all on function public.confirmar_regras(uuid)    from public, anon;
grant execute on function public.regras_pendentes()     to authenticated;
grant execute on function public.confirmar_regras(uuid) to authenticated;

commit;
