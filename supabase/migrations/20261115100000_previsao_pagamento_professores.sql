-- 46 · Previsão do pagamento de cada professor no fim do mês (decisão 83), para a aba Professores.
-- Mesma conta de pagamento_professores (migração 37), mas com todas as aulas do mês: as já dadas
-- pelo que aconteceu e as que faltam como previstas (alunos presentes = alunos da turma hoje).

begin;

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
  partes as (
    select d.professor_id, ta.estudio_aluno_id,
           count(*)::numeric / sum(count(*)) over (partition by ta.estudio_aluno_id) as fracao
      from dadas d
      join public.turma_alunos ta on ta.turma_id = d.turma_id
      join public.estudio_alunos al on al.id = ta.estudio_aluno_id and al.situacao = 'ativo'
     where d.professor_id is not null and d.tipo = 'turma'
     group by d.professor_id, ta.estudio_aluno_id
  ),
  base_percentual as (
    select pt.professor_id,
           sum(pt.fracao * coalesce(public.mensalidade_do_aluno_estudio(pt.estudio_aluno_id), 0)) as soma
      from partes pt group by pt.professor_id
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

revoke all on function public.previsao_pagamento_professores(uuid, date) from public, anon;
grant execute on function public.previsao_pagamento_professores(uuid, date) to authenticated;

commit;
