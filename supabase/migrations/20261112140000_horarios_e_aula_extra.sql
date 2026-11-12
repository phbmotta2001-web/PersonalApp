-- Migração 40 (decisão 66): horários por intervalo ("das … às …") e aula extra.
--
-- 1) turmas.avulsa: data da aula extra (uma vez só, não repete). Vazio = horário padrão,
--    que se repete toda semana. A aula extra é uma "turma" de uma aula só, para usar a mesma
--    agenda, chamada, reposição e pagamento.
-- 2) criar_horarios_estudio: cria de uma vez, em vários dias (padrão) ou numa data (extra),
--    um ou mais intervalos. Turno: um por intervalo. Turma: aulas seguidas da duração escolhida
--    dentro do intervalo (ex.: Pilates de 1 h, das 6h às 10h = 4 aulas). Professor opcional.
-- 3) gerar_aulas_turma, gerar_grade_estudio e alterar_aula_estudio passam a tratar a aula extra.

alter table public.turmas add column avulsa date;

-- A aula extra gera só a aula daquela data; o padrão continua gerando 8 semanas.
create or replace function public.gerar_aulas_turma(p_turma uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.turmas;
  n integer;
begin
  select * into t from public.turmas where id = p_turma and ativa;
  if not found then
    return 0;
  end if;
  if t.avulsa is not null then
    insert into public.aulas_turma (turma_id, estudio_id, inicio, fim, professor_id)
    select t.id, t.estudio_id,
           public.instante_brasilia(t.avulsa, t.inicio_min),
           public.instante_brasilia(t.avulsa, t.inicio_min) + make_interval(mins => t.duracao_min),
           t.professor_id
     where public.instante_brasilia(t.avulsa, t.inicio_min) > now()
    on conflict (turma_id, inicio) do nothing;
    get diagnostics n = row_count;
    return n;
  end if;
  insert into public.aulas_turma (turma_id, estudio_id, inicio, fim, professor_id)
  select t.id, t.estudio_id,
         public.instante_brasilia(d.dia::date, t.inicio_min),
         public.instante_brasilia(d.dia::date, t.inicio_min) + make_interval(mins => t.duracao_min),
         t.professor_id
    from generate_series(public.hoje_brasilia(), public.hoje_brasilia() + 56, interval '1 day') as d(dia)
   where extract(dow from d.dia) = t.dia_semana
     and public.instante_brasilia(d.dia::date, t.inicio_min) > now()
  on conflict (turma_id, inicio) do nothing;
  get diagnostics n = row_count;
  return n;
end
$$;

create or replace function public.criar_horarios_estudio(
  p_estudio uuid, p_tipo text, p_modalidade text, p_professor uuid, p_vagas integer,
  p_duracao integer, p_dias integer[], p_data date, p_intervalos jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  iv     record;
  d      integer;
  t      integer;
  v_id   uuid;
  n      integer := 0;
  v_dias integer[];
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação cria e altera turmas.';
  end if;
  if p_tipo not in ('turma', 'turno') then
    raise exception 'Escolha turma ou turno.';
  end if;
  if char_length(coalesce(btrim(p_modalidade), '')) not between 1 and 60 then
    raise exception '%', case when p_tipo = 'turno' then 'Informe a função (ex.: Musculação).' else 'Informe a modalidade (ex.: Pilates).' end;
  end if;
  if p_tipo = 'turma' and (p_vagas is null or p_vagas not between 1 and 100) then
    raise exception 'Vagas de 1 a 100.';
  end if;
  if p_tipo = 'turma' and (p_duracao is null or p_duracao not between 15 and 240) then
    raise exception 'Escolha a duração de cada aula.';
  end if;
  if p_professor is not null and not exists (
      select 1 from public.estudio_membros where estudio_id = p_estudio and personal_id = p_professor) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  if jsonb_typeof(p_intervalos) <> 'array' or jsonb_array_length(p_intervalos) not between 1 and 10 then
    raise exception 'Informe de 1 a 10 intervalos.';
  end if;
  if p_data is not null then
    if p_data < public.hoje_brasilia() then
      raise exception 'A aula extra precisa ser de hoje em diante.';
    end if;
    v_dias := array[extract(dow from p_data)::integer];
  else
    select array_agg(distinct x) into v_dias from unnest(p_dias) x where x between 0 and 6;
    if v_dias is null then
      raise exception 'Escolha pelo menos um dia.';
    end if;
  end if;

  for iv in select (x ->> 'de')::integer as de, (x ->> 'ate')::integer as ate from jsonb_array_elements(p_intervalos) x loop
    if iv.de is null or iv.ate is null or iv.de < 0 or iv.ate > 1440 or iv.ate <= iv.de then
      raise exception 'Confira os horários: o "às" precisa ser depois do "das".';
    end if;
    if p_tipo = 'turno' and iv.ate - iv.de > 720 then
      raise exception 'Turno de até 12 horas.';
    end if;
    if p_tipo = 'turma' and iv.ate - iv.de < p_duracao then
      raise exception 'O intervalo das % às % não cabe uma aula de % min.',
        to_char(make_time(iv.de / 60, iv.de % 60, 0), 'HH24:MI'), to_char(make_time((iv.ate / 60) % 24, iv.ate % 60, 0), 'HH24:MI'), p_duracao;
    end if;
    foreach d in array v_dias loop
      t := iv.de;
      while t < iv.ate and (p_tipo = 'turno' or t + p_duracao <= iv.ate) loop
        if p_data is null then
          -- Padrão: as mesmas regras de sempre (dentro do funcionamento etc.).
          v_id := public.salvar_horario(p_estudio, null, p_tipo, p_modalidade, d, t,
                    case when p_tipo = 'turno' then iv.ate - iv.de else p_duracao end, p_vagas, p_professor);
        else
          -- Extra: só naquela data (pode ser fora do horário de sempre).
          insert into public.turmas (estudio_id, tipo, modalidade, dia_semana, inicio_min, duracao_min, vagas, professor_id, avulsa)
          values (p_estudio, p_tipo, btrim(p_modalidade), d, t,
                  case when p_tipo = 'turno' then iv.ate - iv.de else p_duracao end,
                  case when p_tipo = 'turma' then p_vagas end, p_professor, p_data)
          returning id into v_id;
          perform public.gerar_aulas_turma(v_id);
        end if;
        n := n + 1;
        exit when p_tipo = 'turno';
        t := t + p_duracao;
      end loop;
    end loop;
  end loop;
  return n;
end
$$;

-- Grade padrão: aula extra não ocupa o horário.
create or replace function public.gerar_grade_estudio(p_estudio uuid, p_duracao integer, p_modalidade text, p_vagas integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  f       record;
  t       integer;
  v_id    uuid;
  n       integer := 0;
  v_vagas integer;
  v_mod   text := coalesce(nullif(btrim(p_modalidade), ''), 'Aula');
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação lança a grade de aulas.';
  end if;
  if p_duracao is null or p_duracao not between 15 and 240 then
    raise exception 'Escolha a duração das aulas.';
  end if;
  if char_length(v_mod) > 60 then
    raise exception 'Modalidade com até 60 letras.';
  end if;
  select coalesce(p_vagas, max_alunos_turma) into v_vagas from public.estudios where id = p_estudio;
  if v_vagas is null or v_vagas not between 1 and 100 then
    raise exception 'Vagas de 1 a 100.';
  end if;
  if not exists (select 1 from public.estudio_funcionamento where estudio_id = p_estudio) then
    raise exception 'Informe primeiro os dias e horários de funcionamento.';
  end if;
  for f in select dia_semana, inicio_min, fim_min from public.estudio_funcionamento where estudio_id = p_estudio order by dia_semana loop
    t := f.inicio_min;
    while t + p_duracao <= f.fim_min loop
      if not exists (select 1 from public.turmas
                      where estudio_id = p_estudio and ativa and tipo = 'turma' and avulsa is null
                        and dia_semana = f.dia_semana and inicio_min = t) then
        insert into public.turmas (estudio_id, tipo, modalidade, dia_semana, inicio_min, duracao_min, vagas, professor_id)
        values (p_estudio, 'turma', v_mod, f.dia_semana, t, p_duracao, v_vagas, null)
        returning id into v_id;
        perform public.gerar_aulas_turma(v_id);
        n := n + 1;
      end if;
      t := t + p_duracao;
    end loop;
  end loop;
  return n;
end
$$;

-- "Todos os dias neste horário" vale só para o padrão; a aula extra muda sozinha.
create or replace function public.alterar_aula_estudio(
  p_aula uuid, p_alcance text, p_acao text,
  p_modalidade text default null, p_vagas integer default null,
  p_troca_professor boolean default false, p_professor uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a     public.aulas_turma;
  tm    public.turmas;
  r     public.turmas;
  n     integer := 0;
begin
  select * into a from public.aulas_turma where id = p_aula;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só a coordenação altera as aulas.';
  end if;
  if p_alcance not in ('dia', 'semana', 'horario') or p_acao not in ('alterar', 'remover', 'reativar') then
    raise exception 'Escolha o que fazer.';
  end if;
  if p_professor is not null and not exists (
      select 1 from public.estudio_membros where estudio_id = a.estudio_id and personal_id = p_professor) then
    raise exception 'Escolha um professor da equipe do estúdio.';
  end if;
  select * into tm from public.turmas where id = a.turma_id;

  if p_alcance = 'dia' then
    if a.chamada_em is not null then
      raise exception 'A chamada desta aula já foi feita.';
    end if;
    if p_acao = 'remover' then
      update public.aulas_turma set situacao = 'cancelada' where id = a.id;
    elsif p_acao = 'reativar' then
      update public.aulas_turma set situacao = 'agendada' where id = a.id;
    elsif p_troca_professor then
      update public.aulas_turma set professor_id = p_professor where id = a.id;
    end if;
    return 1;
  end if;

  if p_acao = 'reativar' then
    raise exception 'Escolha o que fazer.';
  end if;

  for r in select * from public.turmas
            where ativa and estudio_id = a.estudio_id and tipo = tm.tipo
              and case when p_alcance = 'semana' or tm.avulsa is not null then id = tm.id
                       else inicio_min = tm.inicio_min and avulsa is null end
            order by dia_semana loop
    if p_acao = 'remover' then
      perform public.encerrar_turma(r.id);
    elsif r.avulsa is not null then
      update public.turmas
         set modalidade = coalesce(nullif(btrim(p_modalidade), ''), r.modalidade),
             vagas = case when r.tipo = 'turma' then coalesce(p_vagas, r.vagas) end,
             professor_id = case when p_troca_professor then p_professor else r.professor_id end
       where id = r.id;
      if p_troca_professor then
        update public.aulas_turma set professor_id = p_professor where turma_id = r.id and chamada_em is null;
      end if;
    else
      perform public.salvar_horario(
        r.estudio_id, r.id, r.tipo,
        coalesce(nullif(btrim(p_modalidade), ''), r.modalidade),
        r.dia_semana, r.inicio_min, r.duracao_min,
        case when r.tipo = 'turma' then coalesce(p_vagas, r.vagas) end,
        case when p_troca_professor then p_professor else r.professor_id end);
    end if;
    n := n + 1;
  end loop;
  return n;
end
$$;

-- Aluno só entra em turma padrão (a extra é para reposição).
create or replace function public.turma_aluno_so_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.turmas where id = new.turma_id and avulsa is not null) then
    raise exception 'Aula extra não tem alunos fixos: o aluno entra por reposição.';
  end if;
  return new;
end
$$;
create trigger turma_aluno_so_padrao before insert on public.turma_alunos
  for each row execute function public.turma_aluno_so_padrao();

revoke all on function public.turma_aluno_so_padrao() from public, anon, authenticated;
revoke all on function public.criar_horarios_estudio(uuid, text, text, uuid, integer, integer, integer[], date, jsonb) from public, anon;
grant execute on function public.criar_horarios_estudio(uuid, text, text, uuid, integer, integer, integer[], date, jsonb) to authenticated;
