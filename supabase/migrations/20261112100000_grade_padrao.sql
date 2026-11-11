-- Migração 39 (decisão 63): grade padrão do estúdio e alteração de aulas com alcance.
--
-- 1) gerar_grade_estudio: lança aulas de X minutos em todo o horário de funcionamento
--    (ex.: aulas de 1 h das 6h às 22h, seg a sex), sem professor, sem repetir horários
--    que já têm turma. Usada no cadastro do estúdio e na aba Turmas.
-- 2) alterar_aula_estudio: a coordenação altera ou remove uma aula escolhendo o alcance:
--      'dia'     só nesta data (exceção: cancela a aula ou troca o professor dela);
--      'semana'  toda semana neste dia e horário (muda a turma: vira o padrão);
--      'horario' todos os dias neste horário (todas as turmas que começam nesta hora).
--    Modalidade e vagas vazias ficam como estão; o professor só muda com p_troca_professor
--    (e então p_professor vazio = sem professor).

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
                      where estudio_id = p_estudio and ativa and tipo = 'turma'
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

  -- Só nesta data: cancela, reativa ou troca o professor desta aula.
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

  -- Toda semana (esta turma) ou todos os dias neste horário (as turmas que começam nesta hora).
  for r in select * from public.turmas
            where ativa and estudio_id = a.estudio_id and tipo = tm.tipo
              and case when p_alcance = 'semana' then id = tm.id else inicio_min = tm.inicio_min end
            order by dia_semana loop
    if p_acao = 'remover' then
      perform public.encerrar_turma(r.id);
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

revoke all on function public.gerar_grade_estudio(uuid, integer, text, integer) from public, anon;
revoke all on function public.alterar_aula_estudio(uuid, text, text, text, integer, boolean, uuid) from public, anon;
grant execute on function public.gerar_grade_estudio(uuid, integer, text, integer) to authenticated;
grant execute on function public.alterar_aula_estudio(uuid, text, text, text, integer, boolean, uuid) to authenticated;
