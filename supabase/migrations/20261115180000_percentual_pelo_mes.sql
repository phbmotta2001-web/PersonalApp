-- 48 · Professor no percentual recebe pelo mês (decisão 86), não pelas aulas dadas.
-- Antes, a parte da mensalidade só contava depois de uma aula dada no mês. Agora é a % da
-- mensalidade dos alunos das turmas dele, pelo mês inteiro; as reposições continuam pagas por aula.
-- Muda pagamento_professores (migração 37) e previsao_pagamento_professores (migração 46).

begin;

create or replace function public.pagamento_professores(p_estudio uuid, p_mes date)
returns table (personal_id uuid, nome text, aulas integer, minutos integer, presencas integer,
               valor_centavos integer, pago_em date, valor_pago_centavos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e       public.estudios;
  v_ini   timestamptz := public.instante_brasilia(date_trunc('month', p_mes)::date, 0);
  v_fim   timestamptz := public.instante_brasilia((date_trunc('month', p_mes) + interval '1 month')::date, 0);
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê o pagamento dos professores.';
  end if;
  select * into e from public.estudios where id = p_estudio;

  return query
  with todas as (
    select a.*, t.tipo from public.aulas_turma a join public.turmas t on t.id = a.turma_id
     where a.estudio_id = p_estudio and a.situacao = 'agendada'
       and a.inicio >= v_ini and a.inicio < v_fim and a.fim <= now()
  ),
  dadas as (select * from todas where ausencia_id is null),
  repostas as (
    select r.professor_id,
           count(*)::integer as aulas,
           sum(extract(epoch from r.fim - r.inicio) / 60)::integer as minutos,
           sum(case
                 when r.tipo = 'turma' and e.reposicao_modelo = 'por_aluno'
                   then (select count(*) from public.presencas p where p.aula_turma_id = r.id and p.situacao = 'presente')
                        * coalesce(e.reposicao_valor_centavos, 0)
                 else round(extract(epoch from r.fim - r.inicio) / 3600.0
                            * coalesce(case when e.reposicao_modelo = 'hora' then e.reposicao_valor_centavos end, e.valor_hora_centavos, 0))
               end)::integer as valor
      from todas r where r.ausencia_id is not null and r.professor_id is not null
     group by r.professor_id
  ),
  por_prof as (
    select d.professor_id,
           (count(*) filter (where d.tipo = 'turma'))::integer as aulas,
           sum(extract(epoch from d.fim - d.inicio) / 60)::integer as minutos,
           coalesce(sum(extract(epoch from d.fim - d.inicio) / 60) filter (where d.tipo = 'turno'), 0)::integer as minutos_turno,
           (select count(*)::integer from public.presencas p
             where p.aula_turma_id in (select x.id from dadas x where x.professor_id = d.professor_id)
               and p.situacao = 'presente') as presencas
      from dadas d where d.professor_id is not null
     group by d.professor_id
  ),
  -- Decisão 86: no percentual, o professor recebe pelo mês, pelas turmas dele (não pelas aulas
  -- dadas). Aluno em turmas de professores diferentes: a mensalidade se divide pelas turmas.
  partes as (
    select t.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from public.turma_alunos ta
      join public.turmas t on t.id = ta.turma_id and t.estudio_id = p_estudio and t.ativa and t.tipo = 'turma'
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where ta.desde < (date_trunc('month', p_mes) + interval '1 month')::date
     group by t.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt where pt.professor_id is not null group by pt.professor_id
  )
  select m.personal_id, pe.nome_completo,
         coalesce(pp.aulas, 0) + coalesce(rp.aulas, 0), coalesce(pp.minutos, 0) + coalesce(rp.minutos, 0), coalesce(pp.presencas, 0),
         ((case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
                                    + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
                 + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
          end) + coalesce(rp.valor, 0))::integer,
         pg.pago_em, pg.valor_centavos
    from public.estudio_membros m
    join public.personais pe on pe.id = m.personal_id
    left join por_prof pp on pp.professor_id = m.personal_id
    left join repostas rp on rp.professor_id = m.personal_id
    left join base_percentual bp on bp.professor_id = m.personal_id
    left join public.estudio_pagamentos pg
           on pg.estudio_id = p_estudio and pg.personal_id = m.personal_id and pg.mes = date_trunc('month', p_mes)::date
   where m.estudio_id = p_estudio and (pp.aulas is not null or rp.aulas is not null or bp.soma is not null or m.papel = 'professor')
   order by pe.nome_completo;
end
$$;

create or replace function public.previsao_pagamento_professores(p_estudio uuid, p_mes date)
returns table (personal_id uuid, valor_centavos integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e       public.estudios;
  v_ini   timestamptz := public.instante_brasilia(date_trunc('month', p_mes)::date, 0);
  v_fim   timestamptz := public.instante_brasilia((date_trunc('month', p_mes) + interval '1 month')::date, 0);
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê o pagamento dos professores.';
  end if;
  select * into e from public.estudios where id = p_estudio;

  return query
  with todas as (
    select a.*, t.tipo,
           (case when a.fim <= now()
                 then (select count(*) from public.presencas p where p.aula_turma_id = a.id and p.situacao = 'presente')
                 else (select count(*) from public.turma_alunos ta
                         join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
                        where ta.turma_id = a.turma_id)
            end)::integer as presentes
      from public.aulas_turma a join public.turmas t on t.id = a.turma_id
     where a.estudio_id = p_estudio and a.situacao = 'agendada' and a.inicio >= v_ini and a.inicio < v_fim
  ),
  dadas as (select * from todas where ausencia_id is null),
  repostas as (
    select r.professor_id,
           sum(case
                 when r.tipo = 'turma' and e.reposicao_modelo = 'por_aluno'
                   then r.presentes * coalesce(e.reposicao_valor_centavos, 0)
                 else round(extract(epoch from r.fim - r.inicio) / 3600.0
                            * coalesce(case when e.reposicao_modelo = 'hora' then e.reposicao_valor_centavos end, e.valor_hora_centavos, 0))
               end)::integer as valor
      from todas r where r.ausencia_id is not null and r.professor_id is not null
     group by r.professor_id
  ),
  por_prof as (
    select d.professor_id,
           (count(*) filter (where d.tipo = 'turma'))::integer as aulas,
           sum(extract(epoch from d.fim - d.inicio) / 60)::integer as minutos,
           coalesce(sum(extract(epoch from d.fim - d.inicio) / 60) filter (where d.tipo = 'turno'), 0)::integer as minutos_turno,
           coalesce(sum(d.presentes) filter (where d.tipo = 'turma'), 0)::integer as presencas
      from dadas d where d.professor_id is not null
     group by d.professor_id
  ),
  -- Decisão 86: no percentual, o professor recebe pelo mês, pelas turmas dele (não pelas aulas
  -- dadas). Aluno em turmas de professores diferentes: a mensalidade se divide pelas turmas.
  partes as (
    select t.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from public.turma_alunos ta
      join public.turmas t on t.id = ta.turma_id and t.estudio_id = p_estudio and t.ativa and t.tipo = 'turma'
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where ta.desde < (date_trunc('month', p_mes) + interval '1 month')::date
     group by t.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt where pt.professor_id is not null group by pt.professor_id
  )
  select m.personal_id,
         ((case e.pagamento_modelo
            when 'hora' then round(coalesce(pp.minutos, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            when 'aula_comissao' then coalesce(pp.aulas, 0) * coalesce(m.valor_aula_centavos, e.valor_aula_centavos, 0)
                                    + coalesce(pp.presencas, 0) * coalesce(m.valor_por_aluno_centavos, e.valor_por_aluno_centavos, 0)
                                    + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
            else round(coalesce(bp.soma, 0) * coalesce(m.percentual, e.percentual, 0) / 100)
                 + round(coalesce(pp.minutos_turno, 0) / 60.0 * coalesce(m.valor_hora_centavos, e.valor_hora_centavos, 0))
          end) + coalesce(rp.valor, 0))::integer
    from public.estudio_membros m
    left join por_prof pp on pp.professor_id = m.personal_id
    left join repostas rp on rp.professor_id = m.personal_id
    left join base_percentual bp on bp.professor_id = m.personal_id
   where m.estudio_id = p_estudio;
end
$$;

commit;
