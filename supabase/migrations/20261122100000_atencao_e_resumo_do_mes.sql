-- 63 · Reposições vencendo, aluno sumindo e resumo do mês (decisão 101).
--
-- • Reposições vencendo: faltando 10 dias ou menos para vencer, o aluno vê um destaque no Início
--   do app (sem notificação no celular). Na aba Alunos, a coordenação vê quem tem reposição vencendo.
-- • Aluno sumindo: quem faltou às últimas 3 aulas seguidas (com ou sem aviso) aparece na aba Alunos
--   e a coordenação é avisada uma vez (de novo só depois que o aluno voltar e sumir outra vez).
-- • Resumo do mês: na aba Financeiro, os números do mês escolhido. No dia 1, a coordenação é
--   avisada com o resumo do mês que terminou.
-- Os avisos saem todo dia às 9h (horário de Brasília).
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

alter table public.estudio_alunos add column if not exists alerta_sumido_em timestamptz;
comment on column public.estudio_alunos.alerta_sumido_em is 'Quando a coordenação foi avisada de que o aluno sumiu (3 faltas seguidas).';

-- Quantas faltas seguidas, das aulas mais recentes que já aconteceram para trás.
create or replace function public.faltas_seguidas_estudio(p_estudio_aluno uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with ultimas as (
    select p.situacao, row_number() over (order by a.inicio desc) n
      from public.presencas p
      join public.aulas_turma a on a.id = p.aula_turma_id
     where p.estudio_aluno_id = p_estudio_aluno and a.inicio < now() and a.situacao <> 'cancelada'
  )
  select coalesce((select min(n) - 1 from ultimas where situacao = 'presente'),
                  (select count(*) from ultimas))::integer;
$$;

-- Para a aba Alunos da coordenação: quem tem reposição vencendo e quem está sumindo.
create or replace function public.atencao_alunos_estudio(p_estudio uuid)
returns table (estudio_aluno_id uuid, nome text, whatsapp text, com_app boolean, tipo text, quantidade integer, ate date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê os alunos que precisam de atenção.';
  end if;
  return query
  select al.id, al.nome, al.whatsapp, al.aluno_id is not null, 'sumindo'::text, f.n, null::date
    from public.estudio_alunos al
    cross join lateral (select public.faltas_seguidas_estudio(al.id) n) f
   where al.estudio_id = p_estudio and al.situacao = 'ativo' and f.n >= 3
  union all
  select al.id, al.nome, al.whatsapp, al.aluno_id is not null, 'reposicao'::text, count(*)::integer, min(r.valido_ate)
    from public.estudio_alunos al
    join public.estudio_reposicoes r on r.estudio_aluno_id = al.id
   where al.estudio_id = p_estudio and al.situacao = 'ativo'
     and r.usada_aula_id is null and r.valido_ate between public.hoje_brasilia() and public.hoje_brasilia() + 10
   group by al.id, al.nome, al.whatsapp, al.aluno_id
   order by 5 desc, 2;
end
$$;

-- Resumo do mês (p_mes: qualquer dia do mês).
create or replace function public.resumo_mes_estudio(p_estudio uuid, p_mes date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ini  date := date_trunc('month', p_mes)::date;
  v_fim  date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_hoje date := public.hoje_brasilia();
  r      jsonb;
begin
  if auth.uid() is not null and not public.coordena_estudio(p_estudio) then
    raise exception 'Só a coordenação vê o resumo do mês.';
  end if;
  select jsonb_build_object(
    'novos', (select count(*) from public.estudio_alunos
               where estudio_id = p_estudio and situacao in ('ativo', 'encerrado')
                 and (criado_em at time zone 'America/Sao_Paulo')::date >= v_ini and (criado_em at time zone 'America/Sao_Paulo')::date < v_fim),
    'saidas', (select count(*) from public.estudio_alunos
                where estudio_id = p_estudio and situacao = 'encerrado'
                  and (encerrado_em at time zone 'America/Sao_Paulo')::date >= v_ini and (encerrado_em at time zone 'America/Sao_Paulo')::date < v_fim),
    'experimentais', (select count(*) from public.estudio_experimentais where estudio_id = p_estudio and data >= v_ini and data < v_fim),
    'matricularam', (select count(*) from public.estudio_experimentais
                      where estudio_id = p_estudio and data >= v_ini and data < v_fim and resultado = 'matriculou'),
    'recebido_centavos', (select coalesce(sum(valor_centavos), 0) from public.estudio_cobrancas
                           where estudio_id = p_estudio and situacao = 'paga' and pago_em >= v_ini and pago_em < v_fim),
    'atrasadas', (select count(*) from public.estudio_cobrancas
                   where estudio_id = p_estudio and situacao = 'aberta' and vencimento >= v_ini and vencimento < least(v_fim, v_hoje)),
    'atrasado_centavos', (select coalesce(sum(valor_centavos), 0) from public.estudio_cobrancas
                           where estudio_id = p_estudio and situacao = 'aberta' and vencimento >= v_ini and vencimento < least(v_fim, v_hoje)),
    'presencas', (select count(*) from public.presencas p join public.aulas_turma a on a.id = p.aula_turma_id
                   where a.estudio_id = p_estudio and a.situacao <> 'cancelada' and a.inicio < now() and p.situacao = 'presente'
                     and a.inicio >= public.instante_brasilia(v_ini, 0) and a.inicio < public.instante_brasilia(v_fim, 0)),
    'faltas', (select count(*) from public.presencas p join public.aulas_turma a on a.id = p.aula_turma_id
                where a.estudio_id = p_estudio and a.situacao <> 'cancelada' and a.inicio < now() and p.situacao in ('falta', 'falta_avisada')
                  and a.inicio >= public.instante_brasilia(v_ini, 0) and a.inicio < public.instante_brasilia(v_fim, 0)),
    'reposicoes_vencidas', (select count(*) from public.estudio_reposicoes
                             where estudio_id = p_estudio and usada_aula_id is null
                               and valido_ate >= v_ini and valido_ate < least(v_fim, v_hoje)),
    'ativos', (select count(*) from public.estudio_alunos where estudio_id = p_estudio and situacao = 'ativo')
  ) into r;
  return r;
end
$$;

-- Robô das 9h: aluno sumindo e, no dia 1, o resumo do mês (só para a coordenação).
create or replace function public.avisos_diarios_estudio()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x      record;
  v_hoje date := public.hoje_brasilia();
  v_mes  date := (date_trunc('month', public.hoje_brasilia()) - interval '1 month')::date;
  v_res  jsonb;
  v_nome text;
  v_txt  text;
  meses  text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
begin
  -- Aluno sumindo: avisa a coordenação uma vez (de novo só depois de uma presença).
  for x in
    select al.id, al.estudio_id, al.nome, f.n
      from public.estudio_alunos al
      cross join lateral (select public.faltas_seguidas_estudio(al.id) n) f
     where al.situacao = 'ativo' and f.n >= 3
       and (al.alerta_sumido_em is null
            or al.alerta_sumido_em < (select max(a.inicio) from public.presencas p join public.aulas_turma a on a.id = p.aula_turma_id
                                       where p.estudio_aluno_id = al.id and p.situacao = 'presente'))
  loop
    perform public.notificar(m.personal_id, 'aluno_sumindo_estudio', 'Aluno faltando',
              split_part(btrim(x.nome), ' ', 1) || ' faltou às últimas ' || x.n || ' aulas. Que tal entrar em contato?',
              '/estudio/' || x.estudio_id || '?aba=alunos', p_chave => 'sumindo:' || x.id || ':' || v_hoje || ':' || m.personal_id)
       from public.estudio_membros m
      where m.estudio_id = x.estudio_id and m.papel = 'coordenacao';
    update public.estudio_alunos set alerta_sumido_em = now() where id = x.id;
  end loop;

  -- Dia 1: o resumo do mês que terminou.
  if extract(day from v_hoje) = 1 then
    for x in select e.id, e.nome from public.estudios e loop
      v_res := public.resumo_mes_estudio(x.id, v_mes);
      if (v_res ->> 'ativos')::integer = 0 and (v_res ->> 'novos')::integer = 0 then
        continue;
      end if;
      v_txt := (v_res ->> 'novos') || case when (v_res ->> 'novos') = '1' then ' aluno entrou' else ' alunos entraram' end
            || ' e ' || (v_res ->> 'saidas') || case when (v_res ->> 'saidas') = '1' then ' saiu' else ' saíram' end
            || ' · R$ ' || replace(to_char((v_res ->> 'recebido_centavos')::bigint / 100, 'FM999,999,990'), ',', '.') || ' recebidos';
      if (v_res ->> 'experimentais')::integer > 0 then
        v_txt := v_txt || ' · ' || (v_res ->> 'matricularam') || ' de ' || (v_res ->> 'experimentais') || ' experimentais viraram matrícula';
      end if;
      v_nome := meses[extract(month from v_mes)::integer];
      perform public.notificar(m.personal_id, 'resumo_mes_estudio', 'Resumo de ' || v_nome, v_txt || '.',
                '/estudio/' || x.id || '?aba=financeiro&mes=' || to_char(v_mes, 'YYYY-MM'),
                p_chave => 'resumo:' || x.id || ':' || v_mes || ':' || m.personal_id)
         from public.estudio_membros m
        where m.estudio_id = x.id and m.papel = 'coordenacao';
    end loop;
  end if;
end
$$;

revoke all on function public.faltas_seguidas_estudio(uuid)       from public, anon, authenticated;
revoke all on function public.avisos_diarios_estudio()            from public, anon, authenticated;
revoke all on function public.atencao_alunos_estudio(uuid)        from public, anon;
revoke all on function public.resumo_mes_estudio(uuid, date)      from public, anon;
grant execute on function public.atencao_alunos_estudio(uuid)     to authenticated;
grant execute on function public.resumo_mes_estudio(uuid, date)   to authenticated;

-- Todo dia às 9h de Brasília (12h UTC).
select cron.schedule('pbell-avisos-diarios-estudio', '0 12 * * *', $$select public.avisos_diarios_estudio()$$);

commit;
