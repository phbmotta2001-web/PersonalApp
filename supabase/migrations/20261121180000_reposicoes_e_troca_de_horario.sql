-- 62 · Reposições até o fim do mês e troca de horário num dia (decisão 100).
--
-- • A reposição vale, por padrão, até o fim do mês da aula perdida (antes: 30 dias). Em Ajustes,
--   a coordenação ainda pode escolher um número de dias. As reposições que já existem não mudam.
-- • Professor e coordenação veem quantas reposições cada aluno tem (na ficha do aluno).
-- • Troca de horário: na lista da aula, o professor (ou a coordenação) passa o aluno para outra
--   aula com vaga, só naquele dia. O lugar dele na turma continua o mesmo nas semanas seguintes.
--   O professor que recebe o aluno é avisado. "Desfazer" devolve o aluno à aula dele.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

-- ─── Validade da reposição ────────────────────────────────────────────────
alter table public.estudios add column if not exists reposicao_fim_do_mes boolean not null default true;
comment on column public.estudios.reposicao_fim_do_mes is 'A reposição vale até o fim do mês da aula perdida (senão, validade_reposicao_dias).';
update public.estudios set reposicao_fim_do_mes = true;

create or replace function public.validade_reposicao_estudio(p_estudio uuid, p_data date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case when e.reposicao_fim_do_mes
              then (date_trunc('month', p_data) + interval '1 month - 1 day')::date
              else p_data + e.validade_reposicao_dias end
    from public.estudios e where e.id = p_estudio;
$$;

-- p_validade = 0: até o fim do mês.
create or replace function public.salvar_regras_alunos_estudio(p_estudio uuid, p_falta_h integer, p_marcar_h integer, p_validade integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação muda as regras de faltas e reposições.';
  end if;
  if p_falta_h is null or p_falta_h not between 0 and 72 then
    raise exception 'Aviso de falta: de 0 a 72 horas antes.';
  end if;
  if p_marcar_h is null or p_marcar_h not between 0 and 48 then
    raise exception 'Marcar reposição: de 0 a 48 horas antes.';
  end if;
  if p_validade is null or p_validade not between 0 and 120 then
    raise exception 'A reposição vale de 1 a 120 dias, ou até o fim do mês.';
  end if;
  update public.estudios
     set antecedencia_falta_h = p_falta_h, antecedencia_marcar_h = p_marcar_h,
         reposicao_fim_do_mes = (p_validade = 0),
         validade_reposicao_dias = case when p_validade = 0 then validade_reposicao_dias else p_validade end
   where id = p_estudio;
end
$$;

-- validade_dias = 0: até o fim do mês.
create or replace function public.meus_estudios_aluno()
returns table (estudio_id uuid, nome text, estudio_aluno_id uuid, falta_h integer, marcar_h integer,
               validade_dias integer, funcionamento jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nome, al.id, e.antecedencia_falta_h, e.antecedencia_marcar_h,
         case when e.reposicao_fim_do_mes then 0 else e.validade_reposicao_dias end,
         coalesce((select jsonb_agg(jsonb_build_object('dia', f.dia_semana, 'inicio_min', f.inicio_min, 'fim_min', f.fim_min))
                     from public.estudio_funcionamento f where f.estudio_id = e.id), '[]'::jsonb)
    from public.estudio_alunos al join public.estudios e on e.id = al.estudio_id
   where al.aluno_id = auth.uid() and al.situacao = 'ativo'
   order by e.nome;
$$;

-- ─── Reposições do aluno, para a equipe ───────────────────────────────────
create or replace function public.reposicoes_do_aluno_estudio(p_estudio_aluno uuid)
returns table (modalidade text, valido_ate date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ea public.estudio_alunos;
begin
  select * into ea from public.estudio_alunos where estudio_alunos.id = p_estudio_aluno;
  if not found then
    raise exception 'Aluno não encontrado.';
  end if;
  if not public.coordena_estudio(ea.estudio_id)
     and not exists (select 1 from public.turma_alunos ta join public.turmas t on t.id = ta.turma_id
                      where ta.estudio_aluno_id = ea.id and t.professor_id = auth.uid())
     and not exists (select 1 from public.presencas p join public.aulas_turma a on a.id = p.aula_turma_id
                      where p.estudio_aluno_id = ea.id and a.professor_id = auth.uid()) then
    raise exception 'Só a coordenação e os professores do aluno veem as reposições dele.';
  end if;
  return query
  select r.modalidade, r.valido_ate from public.estudio_reposicoes r
   where r.estudio_aluno_id = ea.id and r.usada_aula_id is null and r.valido_ate >= public.hoje_brasilia()
   order by r.valido_ate;
end
$$;

-- ─── Troca de horário num dia ─────────────────────────────────────────────
alter table public.presencas add column if not exists troca_de uuid references public.aulas_turma (id) on delete set null;
comment on column public.presencas.troca_de is 'Troca de horário: a aula do aluno que ele trocou por esta (só naquele dia).';
alter table public.presencas drop constraint if exists presencas_origem_check;
alter table public.presencas add constraint presencas_origem_check
  check (origem in ('fixa', 'reposicao', 'experimental', 'troca'));

create or replace function public.trocar_horario_estudio(p_aula uuid, p_aluno uuid, p_destino uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.aulas_turma;
  d      public.aulas_turma;
  td     public.turmas;
  v_nome text;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  if a.professor_id is distinct from auth.uid() and not public.coordena_estudio(a.estudio_id) then
    raise exception 'Só o professor da aula ou a coordenação trocam o aluno de horário.';
  end if;
  if a.situacao = 'cancelada' or a.inicio <= now() then
    raise exception 'Esta aula já começou ou foi cancelada.';
  end if;
  select split_part(btrim(nome), ' ', 1) into v_nome from public.estudio_alunos
   where id = p_aluno and estudio_id = a.estudio_id and situacao = 'ativo';
  if v_nome is null then
    raise exception 'Aluno de fora deste estúdio.';
  end if;
  if not exists (select 1 from public.turma_alunos where turma_id = a.turma_id and estudio_aluno_id = p_aluno) then
    raise exception 'Só o aluno da turma troca de horário.';
  end if;
  if exists (select 1 from public.presencas where aula_turma_id = a.id and estudio_aluno_id = p_aluno and situacao = 'falta_avisada') then
    raise exception 'A falta deste aluno já foi avisada nesta aula.';
  end if;

  select * into d from public.aulas_turma where id = p_destino for update;
  select * into td from public.turmas where id = d.turma_id;
  if d.id is null or d.estudio_id <> a.estudio_id or td.tipo <> 'turma' or d.situacao = 'cancelada' then
    raise exception 'Escolha outra aula do estúdio.';
  end if;
  if d.id = a.id then
    raise exception 'Escolha um horário diferente.';
  end if;
  if d.inicio <= now() then
    raise exception 'Escolha uma aula que ainda vai acontecer.';
  end if;
  if exists (select 1 from public.turma_alunos where turma_id = d.turma_id and estudio_aluno_id = p_aluno)
     or exists (select 1 from public.presencas where aula_turma_id = d.id and estudio_aluno_id = p_aluno) then
    raise exception 'O aluno já está nesta aula.';
  end if;
  if public.ocupacao_aula_turma(d.id) >= td.vagas then
    raise exception 'Esta aula está lotada.';
  end if;

  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
  values (a.id, p_aluno, 'falta_avisada', 'fixa')
  on conflict (aula_turma_id, estudio_aluno_id) do update set situacao = 'falta_avisada', marcado_em = now();
  insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem, troca_de)
  values (d.id, p_aluno, 'presente', 'troca', a.id);

  if d.professor_id is not null and d.professor_id is distinct from auth.uid() then
    perform public.notificar(d.professor_id, 'troca_horario_estudio', 'Aluno a mais na sua aula',
      v_nome || ' trocou de horário e vem à sua turma de ' || public.texto_aula_turma(d.id) || '.',
      '/agenda/turma/' || d.id, now(), null, null, null, null, null, true);
  end if;
  return public.texto_aula_turma(d.id);
end
$$;

-- Avisar a falta (mesma de 20261111140000, com a validade nova e a troca de horário).
create or replace function public.avisar_falta_estudio(p_aula uuid, p_aluno uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        public.aulas_turma;
  t        public.turmas;
  e        public.estudios;
  p        public.presencas;
  v_al     uuid;
  v_nome   text;
  fixo     boolean;
  no_prazo boolean;
  credito  boolean := false;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  select * into e from public.estudios where id = a.estudio_id;
  if p_aluno is null then
    v_al := public.meu_aluno_no_estudio(a.estudio_id);
    if v_al is null then
      raise exception 'Você não é aluno deste estúdio.';
    end if;
  else
    if a.professor_id is distinct from auth.uid() and not public.coordena_estudio(a.estudio_id) then
      raise exception 'Só o professor da aula ou a coordenação avisam a falta de um aluno.';
    end if;
    if not exists (select 1 from public.estudio_alunos where id = p_aluno and estudio_id = a.estudio_id) then
      raise exception 'Aluno de fora deste estúdio.';
    end if;
    v_al := p_aluno;
  end if;
  if a.situacao = 'cancelada' then
    raise exception 'Esta aula foi cancelada.';
  end if;
  if a.inicio <= now() then
    raise exception 'A aula já começou.';
  end if;
  fixo := exists (select 1 from public.turma_alunos where turma_id = a.turma_id and estudio_aluno_id = v_al);
  select * into p from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
  if p.situacao = 'falta_avisada' then
    raise exception 'A falta já foi avisada.';
  end if;
  if not fixo and p.aula_turma_id is null then
    raise exception 'Este aluno não está nesta aula.';
  end if;
  no_prazo := now() <= a.inicio - make_interval(hours => e.antecedencia_falta_h);

  if not fixo then
    -- Reposição ou troca de horário: no prazo, desmarca (a reposição volta; a troca vira reposição).
    if no_prazo then
      delete from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
      update public.estudio_reposicoes set usada_aula_id = null where usada_aula_id = a.id and estudio_aluno_id = v_al;
      if p.origem = 'troca' then
        insert into public.estudio_reposicoes (estudio_id, estudio_aluno_id, modalidade, aula_perdida_id, valido_ate)
        values (a.estudio_id, v_al, t.modalidade, a.id,
                public.validade_reposicao_estudio(a.estudio_id, (a.inicio at time zone 'America/Sao_Paulo')::date));
      end if;
      credito := true;
    else
      update public.presencas set situacao = 'falta_avisada', marcado_em = now()
       where aula_turma_id = a.id and estudio_aluno_id = v_al;
    end if;
  else
    insert into public.presencas (aula_turma_id, estudio_aluno_id, situacao, origem)
    values (a.id, v_al, 'falta_avisada', 'fixa')
    on conflict (aula_turma_id, estudio_aluno_id) do update set situacao = 'falta_avisada', marcado_em = now();
    if no_prazo then
      insert into public.estudio_reposicoes (estudio_id, estudio_aluno_id, modalidade, aula_perdida_id, valido_ate)
      values (a.estudio_id, v_al, t.modalidade, a.id,
              public.validade_reposicao_estudio(a.estudio_id, (a.inicio at time zone 'America/Sao_Paulo')::date));
      credito := true;
    end if;
  end if;

  if p_aluno is null and a.professor_id is not null then
    select split_part(btrim(nome), ' ', 1) into v_nome from public.estudio_alunos where id = v_al;
    perform public.notificar(a.professor_id, 'falta_aluno_estudio', 'Falta avisada',
      v_nome || ' não vem à turma de ' || public.texto_aula_turma(a.id) || '.',
      '/agenda/turma/' || a.id, now(), null, null, null, null, null, true);
  end if;
  return jsonb_build_object('credito', credito, 'fixo', fixo, 'prazo_h', e.antecedencia_falta_h);
end
$$;

-- Desfazer a falta avisada (mesma de 20261111140000): se foi troca de horário, o aluno sai da outra aula.
create or replace function public.desfazer_falta_estudio(p_aula uuid, p_aluno uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a    public.aulas_turma;
  t    public.turmas;
  d    public.aulas_turma;
  v_al uuid;
  v_nome text;
begin
  select * into a from public.aulas_turma where id = p_aula for update;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
  select * into t from public.turmas where id = a.turma_id;
  if p_aluno is null then
    v_al := public.meu_aluno_no_estudio(a.estudio_id);
  elsif a.professor_id = auth.uid() or public.coordena_estudio(a.estudio_id) then
    v_al := p_aluno;
  end if;
  if v_al is null or not exists (select 1 from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al
                                    and situacao = 'falta_avisada' and origem = 'fixa') then
    raise exception 'Não há falta avisada para desfazer.';
  end if;
  if a.inicio <= now() then
    raise exception 'A aula já começou.';
  end if;
  if exists (select 1 from public.estudio_reposicoes where aula_perdida_id = a.id and estudio_aluno_id = v_al and usada_aula_id is not null) then
    raise exception 'A reposição desta falta já foi usada.';
  end if;
  if public.ocupacao_aula_turma(a.id) >= t.vagas then
    raise exception 'A vaga já foi ocupada por outro aluno.';
  end if;
  select au.* into d from public.presencas p join public.aulas_turma au on au.id = p.aula_turma_id
   where p.troca_de = a.id and p.estudio_aluno_id = v_al and p.origem = 'troca';
  if d.id is not null then
    if d.inicio <= now() then
      raise exception 'A aula da troca já começou.';
    end if;
    delete from public.presencas where aula_turma_id = d.id and estudio_aluno_id = v_al;
    if d.professor_id is not null and d.professor_id is distinct from auth.uid() then
      select split_part(btrim(nome), ' ', 1) into v_nome from public.estudio_alunos where id = v_al;
      perform public.notificar(d.professor_id, 'troca_horario_estudio', 'Troca desfeita',
        v_nome || ' voltou para o horário dele e não vem mais à sua turma de ' || public.texto_aula_turma(d.id) || '.',
        '/agenda/turma/' || d.id, now(), null, null, null, null, null, true);
    end if;
  end if;
  delete from public.estudio_reposicoes where aula_perdida_id = a.id and estudio_aluno_id = v_al;
  delete from public.presencas where aula_turma_id = a.id and estudio_aluno_id = v_al;
end
$$;

-- Agenda do aluno (mesma de 20261119100000): a troca de horário aparece como aula dele.
create or replace function public.agenda_aluno_estudio(p_estudio uuid, p_de date, p_ate date)
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
              when exists (select 1 from public.presencas p where p.aula_turma_id = a.id and p.estudio_aluno_id = v_al and p.origem in ('reposicao', 'troca')) then 'reposicao'
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

revoke all on function public.validade_reposicao_estudio(uuid, date)       from public, anon, authenticated;
revoke all on function public.reposicoes_do_aluno_estudio(uuid)            from public, anon;
revoke all on function public.trocar_horario_estudio(uuid, uuid, uuid)     from public, anon;
grant execute on function public.reposicoes_do_aluno_estudio(uuid)         to authenticated;
grant execute on function public.trocar_horario_estudio(uuid, uuid, uuid)  to authenticated;

commit;
