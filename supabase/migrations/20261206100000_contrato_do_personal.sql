-- 78 · Contrato do personal (decisão 126).
--
-- O personal escreve o contrato (Minha conta › Contrato). O aluno lê junto das regras no Início e
-- assina marcando "Li e aceito o contrato". Cada assinatura guarda a data e uma cópia do texto assinado.
-- Se o personal muda o contrato, os alunos ativos assinam de novo no próximo acesso.

begin;

alter table public.personais add column if not exists contrato_texto text
  check (contrato_texto is null or char_length(contrato_texto) between 1 and 20000);
alter table public.personais add column if not exists contrato_versao timestamptz;

create table if not exists public.contratos_assinados (
  id           uuid primary key default gen_random_uuid(),
  vinculo_id   uuid not null references public.vinculos (id) on delete cascade,
  versao       timestamptz not null,
  texto        text not null,
  assinado_em  timestamptz not null default now(),
  unique (vinculo_id, versao)
);
alter table public.contratos_assinados enable row level security;

-- Leitura: o aluno e o personal daquele vínculo. Escrita só pelas funções abaixo.
drop policy if exists contratos_assinados_ler on public.contratos_assinados;
create policy contratos_assinados_ler on public.contratos_assinados for select to authenticated
  using (exists (
    select 1 from public.vinculos v
     where v.id = vinculo_id and (v.aluno_id = (select auth.uid()) or v.personal_id = (select auth.uid()))
  ));
grant select on public.contratos_assinados to authenticated;

-- Personal: salva o contrato (vazio = sem contrato). Só muda a versão se o texto mudou.
create or replace function public.salvar_contrato(p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  if not exists (select 1 from public.personais where id = auth.uid()) then
    raise exception 'Só o personal salva o contrato.';
  end if;
  if v_texto is not null and char_length(v_texto) > 20000 then
    raise exception 'O contrato pode ter até 20.000 caracteres.';
  end if;
  update public.personais
     set contrato_texto  = v_texto,
         contrato_versao = case when v_texto is null then null
                                when contrato_texto is distinct from v_texto then now()
                                else contrato_versao end
   where id = auth.uid();
end
$$;

-- Aluno: regras ainda não vistas e/ou contrato ainda não assinado (na versão atual).
drop function if exists public.regras_pendentes();
create function public.regras_pendentes()
returns table (vinculo_id uuid, cancelamento_h integer, reposicao_h integer, pausa_dias integer,
               regras boolean, contrato text, contrato_versao timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, p.antecedencia_cancelamento_h, p.antecedencia_reposicao_h, p.pausa_dias_ano,
         v.regras_vistas_em is null,
         case when c.pendente then p.contrato_texto end,
         case when c.pendente then p.contrato_versao end
    from public.vinculos v
    join public.personais p on p.id = v.personal_id
    cross join lateral (
      select p.contrato_texto is not null and not exists (
        select 1 from public.contratos_assinados ca where ca.vinculo_id = v.id and ca.versao = p.contrato_versao
      ) as pendente
    ) c
   where v.aluno_id = auth.uid() and v.situacao = 'ativo'
     and (v.regras_vistas_em is null or c.pendente)
   order by v.aceito_em;
$$;

-- Aluno: confirma as regras e assina o contrato da versão que leu.
drop function if exists public.confirmar_regras(uuid);
create or replace function public.confirmar_regras(p_vinculo uuid, p_versao timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  p public.personais;
begin
  select * into v from public.vinculos where id = p_vinculo and aluno_id = auth.uid() for update;
  if not found then
    raise exception 'Vínculo não encontrado.';
  end if;
  select * into p from public.personais where id = v.personal_id;
  if p.contrato_texto is not null
     and not exists (select 1 from public.contratos_assinados where vinculo_id = v.id and versao = p.contrato_versao) then
    if p_versao is distinct from p.contrato_versao then
      raise exception 'O contrato mudou. Leia de novo antes de assinar.';
    end if;
    insert into public.contratos_assinados (vinculo_id, versao, texto) values (v.id, p.contrato_versao, p.contrato_texto);
  end if;
  update public.vinculos set regras_vistas_em = coalesce(regras_vistas_em, now()) where id = v.id;
end
$$;

revoke all on function public.salvar_contrato(text)                     from public, anon;
revoke all on function public.regras_pendentes()                        from public, anon;
revoke all on function public.confirmar_regras(uuid, timestamptz)       from public, anon;
grant execute on function public.salvar_contrato(text)                  to authenticated;
grant execute on function public.regras_pendentes()                     to authenticated;
grant execute on function public.confirmar_regras(uuid, timestamptz)    to authenticated;

commit;
