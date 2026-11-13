-- 45 · Treino do aluno do personal, só por texto (decisão 81), como o do estúdio (decisão 73).
-- O personal escreve o treino de cada dia da semana; o aluno vê no app. Fica simples de propósito:
-- no futuro, pode virar o atalho para um app de treino parceiro.

begin;

create table public.vinculo_treinos (
  vinculo_id     uuid not null references public.vinculos (id) on delete cascade,
  dia_semana     smallint not null check (dia_semana between 0 and 6),
  texto          text not null check (char_length(btrim(texto)) between 1 and 1000),
  atualizado_em  timestamptz not null default now(),
  primary key (vinculo_id, dia_semana)
);
alter table public.vinculo_treinos enable row level security;

-- Personal do vínculo ou o próprio aluno (vínculo ativo) leem o treino.
create or replace function public.treino_do_vinculo(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo;
  if not found or not (v.personal_id = auth.uid() or (v.aluno_id = auth.uid() and v.situacao = 'ativo')) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('dia', dia_semana, 'texto', texto) order by dia_semana)
                     from public.vinculo_treinos where vinculo_id = p_vinculo), '[]'::jsonb);
end
$$;

-- Só o personal escreve; texto vazio apaga o dia.
create or replace function public.salvar_treino_vinculo(p_vinculo uuid, p_dia integer, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao in ('ativo', 'convidado')) then
    raise exception 'Só o personal do aluno escreve o treino.';
  end if;
  if p_dia is null or p_dia not between 0 and 6 then
    raise exception 'Escolha o dia da semana.';
  end if;
  if char_length(coalesce(p_texto, '')) > 1000 then
    raise exception 'O treino de cada dia pode ter até 1000 letras.';
  end if;
  if btrim(coalesce(p_texto, '')) = '' then
    delete from public.vinculo_treinos where vinculo_id = p_vinculo and dia_semana = p_dia;
  else
    insert into public.vinculo_treinos (vinculo_id, dia_semana, texto) values (p_vinculo, p_dia, btrim(p_texto))
    on conflict (vinculo_id, dia_semana) do update set texto = excluded.texto, atualizado_em = now();
  end if;
end
$$;

revoke all on function public.treino_do_vinculo(uuid)                     from public, anon;
revoke all on function public.salvar_treino_vinculo(uuid, integer, text) from public, anon;
grant execute on function public.treino_do_vinculo(uuid)                     to authenticated;
grant execute on function public.salvar_treino_vinculo(uuid, integer, text) to authenticated;

commit;
