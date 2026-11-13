-- 55 · O aluno muda a própria frequência e fila de espera (decisão 94).
-- • O aluno entra numa turma com vaga (aumenta a frequência), troca uma turma dele por outra
--   (muda o dia) ou sai de uma turma (diminui, desde que fique em pelo menos uma). A turma muda
--   na hora; a mensalidade acompanha a partir da próxima cobrança gerada. A coordenação e os
--   professores das turmas envolvidas são avisados.
-- • Turma cheia: o aluno entra na lista de espera (para aumentar ou para trocar por uma turma dele).
--   Quando abre vaga, o 1º da fila é avisado e tem 24 h para entrar; depois a vaga vai para o
--   seguinte. A vaga oferecida fica guardada para ele nesse prazo.
-- • Todos veem quantos estão na fila de cada turma; só a equipe vê os nomes.

begin;

create table if not exists public.estudio_fila (
  id                uuid primary key default gen_random_uuid(),
  estudio_id        uuid not null references public.estudios (id) on delete cascade,
  turma_id          uuid not null references public.turmas (id) on delete cascade,
  estudio_aluno_id  uuid not null references public.estudio_alunos (id) on delete cascade,
  -- Turma do aluno que ele larga quando entrar (troca de dia); vazio: aumenta a frequência.
  trocar_turma_id   uuid references public.turmas (id) on delete set null,
  situacao          text not null default 'esperando'
                    check (situacao in ('esperando', 'oferecida', 'entrou', 'saiu', 'expirou')),
  criado_em         timestamptz not null default now(),
  oferecida_em      timestamptz,
  expira_em         timestamptz
);
create unique index if not exists estudio_fila_uma_por_turma
  on public.estudio_fila (turma_id, estudio_aluno_id) where situacao in ('esperando', 'oferecida');
create index if not exists estudio_fila_por_turma on public.estudio_fila (turma_id, criado_em) where situacao in ('esperando', 'oferecida');
comment on table public.estudio_fila is 'Lista de espera das turmas: o 1º recebe a vaga por 24 h, depois o seguinte.';
alter table public.estudio_fila enable row level security;
create policy "equipe e o próprio aluno veem a fila" on public.estudio_fila
  for select to authenticated using (
    public.papel_no_estudio(estudio_id) is not null
    or exists (select 1 from public.estudio_alunos al where al.id = estudio_aluno_id and al.aluno_id = (select auth.uid())));

-- "Pilates · Seg 07:00"
create or replace function public.texto_turma(p_turma uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.modalidade || ' · ' || (array['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'])[t.dia_semana + 1] || ' '
         || lpad((t.inicio_min / 60)::text, 2, '0') || ':' || lpad((t.inicio_min % 60)::text, 2, '0')
    from public.turmas t where t.id = p_turma;
$$;

-- Vagas da turma que ainda dá para ocupar: as vagas menos os alunos ativos e as vagas guardadas
-- para quem foi chamado da fila (menos a guardada para o próprio aluno).
create or replace function public.vagas_livres_turma(p_turma uuid, p_para uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select t.vagas
         - (select count(*)::integer from public.turma_alunos ta
              join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
             where ta.turma_id = t.id)
         - (select count(*)::integer from public.estudio_fila f
             where f.turma_id = t.id and f.situacao = 'oferecida' and f.expira_em > now()
               and f.estudio_aluno_id is distinct from p_para)
    from public.turmas t where t.id = p_turma;
$$;

-- Chama o próximo da fila enquanto houver vaga livre.
create or replace function public.oferecer_vagas_fila(p_turma uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  f  public.estudio_fila;
  al public.estudio_alunos;
  n  integer := 0;
begin
  loop
    exit when coalesce(public.vagas_livres_turma(p_turma), 0) <= 0;
    select * into f from public.estudio_fila
     where turma_id = p_turma and situacao = 'esperando'
     order by criado_em
     limit 1
     for update skip locked;
    exit when not found;
    select * into al from public.estudio_alunos where id = f.estudio_aluno_id;
    if al.situacao <> 'ativo' then
      update public.estudio_fila set situacao = 'saiu' where id = f.id;
      continue;
    end if;
    update public.estudio_fila
       set situacao = 'oferecida', oferecida_em = now(), expira_em = now() + interval '24 hours'
     where id = f.id;
    if al.aluno_id is not null then
      perform public.notificar(al.aluno_id, 'vaga_fila', 'Abriu uma vaga para você',
        'Abriu vaga em ' || public.texto_turma(p_turma) || '. Você tem 24 h para entrar na turma.',
        '/aluno/estudio/' || f.estudio_id,
        p_chave => 'vaga-fila:' || f.id);
    end if;
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Saiu alguém da turma: chama a fila. Entrou: quem estava na fila daquela turma sai dela.
create or replace function public.turma_alunos_fila()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.oferecer_vagas_fila(old.turma_id);
    return old;
  end if;
  update public.estudio_fila set situacao = 'entrou'
   where turma_id = new.turma_id and estudio_aluno_id = new.estudio_aluno_id and situacao in ('esperando', 'oferecida');
  return new;
end
$$;
drop trigger if exists turma_alunos_fila on public.turma_alunos;
create trigger turma_alunos_fila
  after insert or delete on public.turma_alunos
  for each row execute function public.turma_alunos_fila();

-- Mais vagas na turma também chama a fila.
create or replace function public.turmas_vagas_fila()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vagas > old.vagas then
    perform public.oferecer_vagas_fila(new.id);
  end if;
  return new;
end
$$;
drop trigger if exists turmas_vagas_fila on public.turmas;
create trigger turmas_vagas_fila
  after update of vagas on public.turmas
  for each row execute function public.turmas_vagas_fila();

-- Passou o prazo de 24 h: a vaga vai para o seguinte (cron a cada 10 min).
create or replace function public.expirar_ofertas_fila()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.estudio_fila f set situacao = 'expirou'
     where f.situacao = 'oferecida' and f.expira_em <= now()
    returning f.id, f.turma_id, f.estudio_id, f.estudio_aluno_id
  loop
    perform public.notificar(al.aluno_id, 'vaga_fila_expirou', 'O prazo da vaga acabou',
        'O prazo de 24 h para entrar em ' || public.texto_turma(r.turma_id) || ' acabou e a vaga foi para o próximo da fila.',
        '/aluno/estudio/' || r.estudio_id, p_chave => 'vaga-fila-expirou:' || r.id)
      from public.estudio_alunos al where al.id = r.estudio_aluno_id and al.aluno_id is not null;
    n := n + 1;
  end loop;
  perform public.oferecer_vagas_fila(t.turma_id)
    from (select distinct f.turma_id from public.estudio_fila f where f.situacao = 'esperando') t;
  return n;
end
$$;

-- Avisa a coordenação e os professores das turmas envolvidas sobre a mudança de frequência.
create or replace function public.avisar_mudanca_frequencia(p_estudio uuid, p_texto text, p_turmas uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.personal_id as quem, true as coordena
      from public.estudio_membros m where m.estudio_id = p_estudio and m.papel = 'coordenacao'
    union
    select t.professor_id, false
      from public.turmas t
     where t.id = any (p_turmas) and t.professor_id is not null
       and not exists (select 1 from public.estudio_membros m
                        where m.estudio_id = p_estudio and m.personal_id = t.professor_id and m.papel = 'coordenacao')
  loop
    perform public.notificar(r.quem, 'frequencia_aluno', 'Mudança de frequência', p_texto,
      case when r.coordena then '/estudio/' || p_estudio || '?aba=alunos' else '/agenda/estudio/' || p_estudio end,
      p_chave => 'frequencia:' || md5(p_texto || now()::text) || ':' || r.quem);
  end loop;
end
$$;

-- O aluno entra numa turma (toda semana). Com p_trocar, larga essa turma dele.
-- Se veio da fila e não disse qual largar, vale a troca escolhida ao entrar na fila.
create or replace function public.entrar_na_turma_estudio(p_turma uuid, p_trocar uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t       public.turmas;
  v_al    uuid;
  v_nome  text;
  v_troca uuid := p_trocar;
begin
  select * into t from public.turmas where id = p_turma for update;
  if not found or not t.ativa or t.tipo <> 'turma' or t.avulsa is not null then
    raise exception 'Turma não encontrada.';
  end if;
  v_al := public.meu_aluno_no_estudio(t.estudio_id);
  if v_al is null then
    raise exception 'Você não é aluno deste estúdio.';
  end if;
  if exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Você já está nesta turma.';
  end if;
  if v_troca is null then
    select f.trocar_turma_id into v_troca from public.estudio_fila f
     where f.turma_id = t.id and f.estudio_aluno_id = v_al and f.situacao in ('esperando', 'oferecida');
  end if;
  if v_troca is not null and not exists (select 1 from public.turma_alunos where turma_id = v_troca and estudio_aluno_id = v_al) then
    if p_trocar is not null then
      raise exception 'Escolha uma turma sua para trocar.';
    end if;
    v_troca := null; -- a turma escolhida na fila já não é dele
  end if;
  if coalesce(public.vagas_livres_turma(t.id, v_al), 0) <= 0 then
    raise exception 'Esta turma está cheia. Entre na lista de espera.';
  end if;

  insert into public.turma_alunos (turma_id, estudio_aluno_id) values (t.id, v_al);
  if v_troca is not null then
    delete from public.turma_alunos where turma_id = v_troca and estudio_aluno_id = v_al;
  end if;

  select nome into v_nome from public.estudio_alunos where id = v_al;
  perform public.avisar_mudanca_frequencia(t.estudio_id,
    v_nome || ' entrou na turma de ' || public.texto_turma(t.id)
      || coalesce(' no lugar da de ' || public.texto_turma(v_troca), '') || '.',
    array_remove(array[t.id, v_troca], null));
end
$$;

-- O aluno sai de uma turma dele (diminui a frequência); precisa ficar em pelo menos uma.
create or replace function public.sair_da_turma_estudio(p_turma uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.turmas;
  v_al   uuid;
  v_nome text;
begin
  select * into t from public.turmas where id = p_turma;
  if not found then
    raise exception 'Turma não encontrada.';
  end if;
  v_al := public.meu_aluno_no_estudio(t.estudio_id);
  if v_al is null or not exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Esta turma não é sua.';
  end if;
  if (select count(*) from public.turma_alunos where estudio_aluno_id = v_al) <= 1 then
    raise exception 'Esta é sua única turma. Para sair do estúdio, fale com a coordenação.';
  end if;
  delete from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al;
  select nome into v_nome from public.estudio_alunos where id = v_al;
  perform public.avisar_mudanca_frequencia(t.estudio_id,
    v_nome || ' saiu da turma de ' || public.texto_turma(t.id) || '.', array[t.id]);
end
$$;

-- Entrar na fila de uma turma cheia (p_trocar: a turma dele que larga quando entrar). Devolve a posição.
create or replace function public.entrar_na_fila_estudio(p_turma uuid, p_trocar uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t    public.turmas;
  v_al uuid;
  v_id uuid;
begin
  select * into t from public.turmas where id = p_turma for update;
  if not found or not t.ativa or t.tipo <> 'turma' or t.avulsa is not null then
    raise exception 'Turma não encontrada.';
  end if;
  v_al := public.meu_aluno_no_estudio(t.estudio_id);
  if v_al is null then
    raise exception 'Você não é aluno deste estúdio.';
  end if;
  if exists (select 1 from public.turma_alunos where turma_id = t.id and estudio_aluno_id = v_al) then
    raise exception 'Você já está nesta turma.';
  end if;
  if exists (select 1 from public.estudio_fila where turma_id = t.id and estudio_aluno_id = v_al and situacao in ('esperando', 'oferecida')) then
    raise exception 'Você já está na fila desta turma.';
  end if;
  if p_trocar is not null and not exists (select 1 from public.turma_alunos where turma_id = p_trocar and estudio_aluno_id = v_al) then
    raise exception 'Escolha uma turma sua para trocar.';
  end if;
  if coalesce(public.vagas_livres_turma(t.id, v_al), 0) > 0 then
    raise exception 'Esta turma tem vaga: entre direto.';
  end if;
  insert into public.estudio_fila (estudio_id, turma_id, estudio_aluno_id, trocar_turma_id)
  values (t.estudio_id, t.id, v_al, p_trocar)
  returning id into v_id;
  return (select count(*)::integer from public.estudio_fila
           where turma_id = t.id and situacao in ('esperando', 'oferecida')
             and criado_em <= (select criado_em from public.estudio_fila where id = v_id));
end
$$;

create or replace function public.sair_da_fila_estudio(p_turma uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.estudio_fila;
begin
  select x.* into f from public.estudio_fila x
    join public.estudio_alunos al on al.id = x.estudio_aluno_id and al.aluno_id = auth.uid()
   where x.turma_id = p_turma and x.situacao in ('esperando', 'oferecida')
   for update of x;
  if not found then
    raise exception 'Você não está na fila desta turma.';
  end if;
  update public.estudio_fila set situacao = 'saiu' where id = f.id;
  if f.situacao = 'oferecida' then
    perform public.oferecer_vagas_fila(f.turma_id);
  end if;
end
$$;

-- As filas em que o aluno logado está (todos os estúdios), com a posição.
create or replace function public.minha_fila_estudio()
returns table (estudio_id uuid, estudio text, turma_id uuid, turma text, trocar text,
               situacao text, posicao integer, expira_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.estudio_id, e.nome, f.turma_id, public.texto_turma(f.turma_id), public.texto_turma(f.trocar_turma_id),
         f.situacao,
         (select count(*)::integer from public.estudio_fila g
           where g.turma_id = f.turma_id and g.situacao in ('esperando', 'oferecida') and g.criado_em <= f.criado_em),
         f.expira_em
    from public.estudio_fila f
    join public.estudio_alunos al on al.id = f.estudio_aluno_id and al.aluno_id = auth.uid() and al.situacao = 'ativo'
    join public.estudios e on e.id = f.estudio_id
   where f.situacao in ('esperando', 'oferecida')
   order by f.criado_em;
$$;

-- Agenda do aluno: + a turma, as vagas livres na turma (toda semana) e quantos estão na fila.
drop function if exists public.agenda_aluno_estudio(uuid, date, date);
create function public.agenda_aluno_estudio(p_estudio uuid, p_de date, p_ate date)
returns table (aula_id uuid, inicio timestamptz, fim timestamptz, modalidade text, professor text,
               vagas integer, ocupadas integer, minha text, avisei_falta boolean, cancelada boolean,
               turma_id uuid, livres integer, na_fila integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_al uuid := public.meu_aluno_no_estudio(p_estudio);
begin
  if v_al is null then
    return;
  end if;
  return query
  select a.id, a.inicio, a.fim, t.modalidade, split_part(btrim(pe.nome_completo), ' ', 1),
         t.vagas, public.ocupacao_aula_turma(a.id),
         case when exists (select 1 from public.turma_alunos ta where ta.turma_id = t.id and ta.estudio_aluno_id = v_al) then 'fixa'
              when exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = v_al and p.origem = 'reposicao') then 'reposicao'
         end,
         exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = v_al and p.situacao = 'falta_avisada'),
         a.situacao = 'cancelada',
         t.id,
         case when t.avulsa is null then public.vagas_livres_turma(t.id, v_al) end,
         (select count(*)::integer from public.estudio_fila f where f.turma_id = t.id and f.situacao in ('esperando', 'oferecida'))
    from public.aulas_turma a
    join public.turmas t on t.id = a.turma_id and t.tipo = 'turma'
    left join public.personais pe on pe.id = a.professor_id
   where a.estudio_id = p_estudio
     and a.inicio >= public.instante_brasilia(p_de, 0) and a.inicio < public.instante_brasilia(p_ate + 1, 0)
   order by a.inicio;
end
$$;

revoke all on function public.texto_turma(uuid)                       from public, anon, authenticated;
revoke all on function public.vagas_livres_turma(uuid, uuid)          from public, anon, authenticated;
revoke all on function public.oferecer_vagas_fila(uuid)               from public, anon, authenticated;
revoke all on function public.expirar_ofertas_fila()                  from public, anon, authenticated;
revoke all on function public.avisar_mudanca_frequencia(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.entrar_na_turma_estudio(uuid, uuid)     from public, anon;
revoke all on function public.sair_da_turma_estudio(uuid)             from public, anon;
revoke all on function public.entrar_na_fila_estudio(uuid, uuid)      from public, anon;
revoke all on function public.sair_da_fila_estudio(uuid)              from public, anon;
revoke all on function public.minha_fila_estudio()                    from public, anon;
revoke all on function public.agenda_aluno_estudio(uuid, date, date)  from public, anon;
grant execute on function public.entrar_na_turma_estudio(uuid, uuid)    to authenticated;
grant execute on function public.sair_da_turma_estudio(uuid)            to authenticated;
grant execute on function public.entrar_na_fila_estudio(uuid, uuid)     to authenticated;
grant execute on function public.sair_da_fila_estudio(uuid)             to authenticated;
grant execute on function public.minha_fila_estudio()                   to authenticated;
grant execute on function public.agenda_aluno_estudio(uuid, date, date) to authenticated;

select cron.schedule('pbell-fila-de-espera', '*/10 * * * *', $$select public.expirar_ofertas_fila()$$);

commit;
