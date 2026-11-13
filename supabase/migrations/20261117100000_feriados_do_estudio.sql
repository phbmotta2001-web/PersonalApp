-- 51 · Feriados no estúdio (decisão 89), como já existe para o personal.
-- A coordenação escolhe "abre em feriados" ou "fecha em feriados", com exceções por feriado.
-- Fechado: as aulas das turmas que caem no feriado ficam canceladas (por_feriado), sem
-- reposição (é o estúdio que está fechado). Aulas extras (data única) não são canceladas.
-- Mudou a regra: as aulas futuras são acertadas na hora (canceladas ou reabertas).

begin;

alter table public.estudios
  add column if not exists trabalha_em_feriados boolean not null default true;

alter table public.aulas_turma
  add column if not exists por_feriado boolean not null default false;

create table if not exists public.estudio_feriados_excecoes (
  estudio_id uuid not null references public.estudios (id) on delete cascade,
  data       date not null,
  primary key (estudio_id, data)
);
comment on table public.estudio_feriados_excecoes is
  'Feriados em que o estúdio faz o contrário da regra geral (abre quando fecha em feriados, ou o inverso).';
alter table public.estudio_feriados_excecoes enable row level security;
create policy "equipe vê as exceções de feriado do estúdio" on public.estudio_feriados_excecoes
  for select to authenticated using (public.papel_no_estudio(estudio_id) is not null);

-- Nome do feriado em que o estúdio fica FECHADO nessa data (null: dia normal).
create or replace function public.feriado_fechado_estudio(p_estudio uuid, p_data date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select f.nome
    from public.feriados_do_ano(extract(year from p_data)::int) f
    join public.estudios e on e.id = p_estudio
   where f.data = p_data
     and e.trabalha_em_feriados = exists (
           select 1 from public.estudio_feriados_excecoes x where x.estudio_id = p_estudio and x.data = p_data)
   limit 1;
$$;

-- Toda aula nova de turma que cai num feriado fechado já nasce cancelada (menos a aula extra).
create or replace function public.aula_turma_no_feriado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'agendada'
     and exists (select 1 from public.turmas t where t.id = new.turma_id and t.avulsa is null)
     and public.feriado_fechado_estudio(new.estudio_id, (new.inicio at time zone 'America/Sao_Paulo')::date) is not null then
    new.situacao := 'cancelada';
    new.por_feriado := true;
  end if;
  return new;
end
$$;
drop trigger if exists aulas_turma_feriado on public.aulas_turma;
create trigger aulas_turma_feriado
  before insert on public.aulas_turma
  for each row execute function public.aula_turma_no_feriado();

-- Acerta as aulas futuras do estúdio com a regra atual.
create or replace function public.sincronizar_feriados_estudio(p_estudio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fecha: cancela as aulas de turma que caem num feriado fechado.
  update public.aulas_turma a
     set situacao = 'cancelada', por_feriado = true
    from public.turmas t
   where t.id = a.turma_id and t.avulsa is null
     and a.estudio_id = p_estudio and a.situacao = 'agendada' and a.inicio > now() and a.chamada_em is null
     and public.feriado_fechado_estudio(p_estudio, (a.inicio at time zone 'America/Sao_Paulo')::date) is not null;
  -- Abre: reabre as que tinham sido canceladas pelo feriado.
  update public.aulas_turma a
     set situacao = 'agendada', por_feriado = false
   where a.estudio_id = p_estudio and a.por_feriado and a.situacao = 'cancelada' and a.inicio > now()
     and public.feriado_fechado_estudio(p_estudio, (a.inicio at time zone 'America/Sao_Paulo')::date) is null;
end
$$;

create or replace function public.salvar_feriados_estudio(p_estudio uuid, p_trabalha boolean, p_excecoes date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda os feriados do estúdio.';
  end if;
  if p_trabalha is null then
    raise exception 'Escolha se o estúdio abre em feriados.';
  end if;
  update public.estudios set trabalha_em_feriados = p_trabalha where id = p_estudio;
  delete from public.estudio_feriados_excecoes where estudio_id = p_estudio;
  insert into public.estudio_feriados_excecoes (estudio_id, data)
  select distinct p_estudio, d from unnest(coalesce(p_excecoes, '{}')) as d
   where exists (select 1 from public.feriados_do_ano(extract(year from d)::int) f where f.data = d);
  perform public.sincronizar_feriados_estudio(p_estudio);
end
$$;

revoke all on function public.feriado_fechado_estudio(uuid, date)              from public, anon;
revoke all on function public.aula_turma_no_feriado()                          from public, anon, authenticated;
revoke all on function public.sincronizar_feriados_estudio(uuid)               from public, anon, authenticated;
revoke all on function public.salvar_feriados_estudio(uuid, boolean, date[])   from public, anon;
grant execute on function public.feriado_fechado_estudio(uuid, date)            to authenticated;
grant execute on function public.salvar_feriados_estudio(uuid, boolean, date[]) to authenticated;

commit;
