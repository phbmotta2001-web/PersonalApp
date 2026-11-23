-- 74 · Treino por séries, unidades, início e fim do treino e relatório do mês (decisão 117).
--
-- • Exercício: carga em kg, lb ou placas; repetições ou segundos (isometria); observação.
-- • Na aula, cada série é registrada (carga e repetições/segundos). O personal pode trocar o treino
--   do dia, começar o treino antes do horário e encerrá-lo antes do fim.
-- • Relatório do mês: o personal envia pelo app e o aluno vê um botão no Início até abrir.

begin;

-- ─── Exercícios: unidade, medida e observação ─────────────────────────────────────────────────
alter table public.vinculo_exercicios
  add column if not exists unidade text not null default 'kg' check (unidade in ('kg', 'lb', 'placas')),
  add column if not exists medida text not null default 'reps' check (medida in ('reps', 'segundos')),
  add column if not exists observacao text check (observacao is null or char_length(observacao) <= 200);

-- ─── Registro por série ───────────────────────────────────────────────────────────────────────
-- series: [{"c": carga, "r": repetições ou segundos}], na ordem.
alter table public.treino_registros
  add column if not exists series jsonb not null default '[]'::jsonb,
  add column if not exists unidade text not null default 'kg',
  add column if not exists medida text not null default 'reps';

-- ─── Aula: treino escolhido, início e fim ─────────────────────────────────────────────────────
alter table public.aulas
  add column if not exists treino_dia smallint check (treino_dia is null or treino_dia between 0 and 6),
  add column if not exists treino_iniciado_em timestamptz,
  add column if not exists treino_encerrado_em timestamptz;

-- ─── Relatórios enviados ──────────────────────────────────────────────────────────────────────
create table if not exists public.relatorios_mensais (
  vinculo_id  uuid not null references public.vinculos (id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  enviado_em  timestamptz not null default now(),
  visto_em    timestamptz,
  primary key (vinculo_id, mes)
);
alter table public.relatorios_mensais enable row level security;

-- Treino completo, agora com unidade, medida e observação.
create or replace function public.treino_completo(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode_ver_treino(p_vinculo) then
    return jsonb_build_object('dias', '[]'::jsonb, 'exercicios', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia_semana, 'foco', texto) order by dia_semana)
                        from public.vinculo_treinos where vinculo_id = p_vinculo), '[]'::jsonb),
    'exercicios', coalesce((select jsonb_agg(jsonb_build_object(
                              'id', id, 'dia', dia_semana, 'ordem', ordem, 'nome', nome, 'series', series,
                              'repeticoes', repeticoes, 'carga', carga_kg, 'descanso', descanso_seg,
                              'unidade', unidade, 'medida', medida, 'obs', observacao)
                              order by dia_semana, ordem)
                              from public.vinculo_exercicios where vinculo_id = p_vinculo), '[]'::jsonb)
  );
end
$$;

-- O personal salva o treino de um dia (agora com unidade, medida e observação).
create or replace function public.salvar_treino_do_dia(p_vinculo uuid, p_dia integer, p_foco text, p_exercicios jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e        jsonb;
  i        integer := 0;
  v_ids    uuid[] := '{}';
  v_id     uuid;
  v_foco   text := nullif(btrim(coalesce(p_foco, '')), '');
  v_unid   text;
  v_med    text;
  v_obs    text;
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao in ('ativo', 'convidado')) then
    raise exception 'Só o personal do aluno monta o treino.';
  end if;
  if p_dia is null or p_dia not between 0 and 6 then
    raise exception 'Escolha o dia da semana.';
  end if;
  if char_length(coalesce(v_foco, '')) > 120 then
    raise exception 'O que será trabalhado no dia pode ter até 120 letras.';
  end if;
  if jsonb_typeof(coalesce(p_exercicios, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_exercicios, '[]'::jsonb)) > 40 then
    raise exception 'Use no máximo 40 exercícios por dia.';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_exercicios, '[]'::jsonb)) loop
    if char_length(btrim(coalesce(e ->> 'nome', ''))) = 0 then
      raise exception 'Escreva o nome de cada exercício.';
    end if;
    v_unid := coalesce(nullif(e ->> 'unidade', ''), 'kg');
    v_med := coalesce(nullif(e ->> 'medida', ''), 'reps');
    v_obs := nullif(btrim(coalesce(e ->> 'obs', '')), '');
    if v_unid not in ('kg', 'lb', 'placas') or v_med not in ('reps', 'segundos') then
      raise exception 'Confira a unidade da carga e das repetições.';
    end if;
    if char_length(coalesce(v_obs, '')) > 200 then
      raise exception 'A observação de cada exercício pode ter até 200 letras.';
    end if;
    v_id := nullif(e ->> 'id', '')::uuid;
    if v_id is not null and exists (select 1 from public.vinculo_exercicios where id = v_id and vinculo_id = p_vinculo) then
      update public.vinculo_exercicios
         set dia_semana = p_dia, ordem = i, nome = btrim(e ->> 'nome'),
             series = nullif(e ->> 'series', '')::smallint,
             repeticoes = nullif(btrim(coalesce(e ->> 'repeticoes', '')), ''),
             carga_kg = nullif(e ->> 'carga', '')::numeric,
             descanso_seg = nullif(e ->> 'descanso', '')::smallint,
             unidade = v_unid, medida = v_med, observacao = v_obs,
             atualizado_em = now()
       where id = v_id;
    else
      insert into public.vinculo_exercicios (vinculo_id, dia_semana, ordem, nome, series, repeticoes, carga_kg, descanso_seg, unidade, medida, observacao)
      values (p_vinculo, p_dia, i, btrim(e ->> 'nome'),
              nullif(e ->> 'series', '')::smallint,
              nullif(btrim(coalesce(e ->> 'repeticoes', '')), ''),
              nullif(e ->> 'carga', '')::numeric,
              nullif(e ->> 'descanso', '')::smallint,
              v_unid, v_med, v_obs)
      returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
    i := i + 1;
  end loop;

  delete from public.vinculo_exercicios
   where vinculo_id = p_vinculo and dia_semana = p_dia and not (id = any (v_ids));

  if v_foco is null and i = 0 then
    delete from public.vinculo_treinos where vinculo_id = p_vinculo and dia_semana = p_dia;
  else
    insert into public.vinculo_treinos (vinculo_id, dia_semana, texto) values (p_vinculo, p_dia, v_foco)
    on conflict (vinculo_id, dia_semana) do update set texto = excluded.texto, atualizado_em = now();
  end if;
end
$$;

-- A aula em que se registra o treino: vale desde o início antecipado pelo personal.
create or replace function public.aula_do_treino(p_aula uuid, p_registrar boolean)
returns public.aulas
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas where id = p_aula;
  if not found or a.vinculo_id is null or not (a.personal_id = auth.uid() or a.aluno_id = auth.uid()) then
    raise exception 'Aula não encontrada.';
  end if;
  if p_registrar and (a.situacao not in ('agendada', 'confirmada', 'realizada')
                      or now() < least(a.inicio - interval '30 minutes', coalesce(a.treino_iniciado_em, a.inicio))
                      or now() > a.fim + interval '12 hours') then
    raise exception 'O treino só pode ser registrado no horário da aula.';
  end if;
  return a;
end
$$;

-- Estado do treino na aula: o dia escolhido, início e fim, e o que já foi marcado.
create or replace function public.treino_da_aula(p_aula uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  a := public.aula_do_treino(p_aula, false);
  return jsonb_build_object(
    'dia', a.treino_dia,
    'iniciado', a.treino_iniciado_em,
    'encerrado', a.treino_encerrado_em,
    'registros', coalesce((select jsonb_agg(jsonb_build_object('exercicio', exercicio_id, 'feito', feito, 'series', series))
                             from public.treino_registros where aula_id = a.id and exercicio_id is not null), '[]'::jsonb));
end
$$;

-- Marca um exercício na aula com cada série. Personal ou aluno.
create or replace function public.registrar_series(p_aula uuid, p_exercicio uuid, p_feito boolean, p_series jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a     public.aulas;
  ex    public.vinculo_exercicios;
  s     jsonb;
  lista jsonb := '[]'::jsonb;
  c     numeric;
  r     integer;
begin
  a := public.aula_do_treino(p_aula, true);
  select * into ex from public.vinculo_exercicios where id = p_exercicio and vinculo_id = a.vinculo_id;
  if not found then
    raise exception 'Exercício não encontrado no treino.';
  end if;
  if jsonb_typeof(coalesce(p_series, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_series, '[]'::jsonb)) > 20 then
    raise exception 'Use no máximo 20 séries.';
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_series, '[]'::jsonb)) loop
    c := nullif(s ->> 'c', '')::numeric;
    r := nullif(s ->> 'r', '')::numeric::integer;
    if c is not null and c not between 0 and 2000 then
      raise exception 'Confira a carga.';
    end if;
    if r is not null and r not between 0 and 3600 then
      raise exception 'Confira as repetições.';
    end if;
    lista := lista || jsonb_build_array(jsonb_build_object('c', c, 'r', r));
  end loop;
  insert into public.treino_registros (aula_id, vinculo_id, exercicio_id, nome, feito, series, unidade, medida, carga_kg, repeticoes, registrado_por)
  values (a.id, a.vinculo_id, ex.id, ex.nome, coalesce(p_feito, false), lista, ex.unidade, ex.medida,
          (select max((x ->> 'c')::numeric) from jsonb_array_elements(lista) x),
          (select least(max((x ->> 'r')::integer), 500) from jsonb_array_elements(lista) x),
          auth.uid())
  on conflict (aula_id, exercicio_id) do update
     set feito = excluded.feito, series = excluded.series, unidade = excluded.unidade, medida = excluded.medida,
         carga_kg = excluded.carga_kg, repeticoes = excluded.repeticoes,
         nome = excluded.nome, registrado_por = excluded.registrado_por, atualizado_em = now();
end
$$;

-- O personal troca o treino da aula por o de outro dia (vazio: volta ao do dia da semana).
create or replace function public.escolher_treino_da_aula(p_aula uuid, p_dia integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas where id = p_aula and personal_id = auth.uid();
  if not found or a.vinculo_id is null then
    raise exception 'Só o personal da aula troca o treino.';
  end if;
  if p_dia is not null and not exists (select 1 from public.vinculo_exercicios where vinculo_id = a.vinculo_id and dia_semana = p_dia)
     and not exists (select 1 from public.vinculo_treinos where vinculo_id = a.vinculo_id and dia_semana = p_dia) then
    raise exception 'Este aluno não tem treino nesse dia.';
  end if;
  update public.aulas set treino_dia = p_dia where id = a.id;
end
$$;

-- O personal começa o treino antes do horário (até 2 h antes) ou o encerra antes do fim.
create or replace function public.iniciar_treino(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas;
begin
  select * into a from public.aulas where id = p_aula and personal_id = auth.uid();
  if not found or a.vinculo_id is null or a.situacao not in ('agendada', 'confirmada') then
    raise exception 'Aula não encontrada.';
  end if;
  if now() < a.inicio - interval '2 hours' or now() >= a.fim then
    raise exception 'Dá para começar o treino até 2 horas antes da aula.';
  end if;
  update public.aulas set treino_iniciado_em = now(), treino_encerrado_em = null where id = a.id;
end
$$;

create or replace function public.encerrar_treino(p_aula uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.aulas set treino_encerrado_em = now()
   where id = p_aula and personal_id = auth.uid() and vinculo_id is not null;
  if not found then
    raise exception 'Aula não encontrada.';
  end if;
end
$$;

-- Evolução: cada exercício feito, com a data, a aula, as séries e as unidades.
create or replace function public.evolucao_do_treino(p_vinculo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode_ver_treino(p_vinculo) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'exercicio', r.exercicio_id, 'nome', r.nome, 'aula', r.aula_id,
             'data', to_char(a.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
             'carga', r.carga_kg, 'repeticoes', r.repeticoes,
             'series', r.series, 'unidade', r.unidade, 'medida', r.medida)
             order by a.inicio)
      from public.treino_registros r
      join public.aulas a on a.id = r.aula_id
     where r.vinculo_id = p_vinculo and r.feito), '[]'::jsonb);
end
$$;

-- ─── Relatório do mês ─────────────────────────────────────────────────────────────────────────
-- Personal: os alunos com treino registrado no mês e se o relatório já foi enviado.
create or replace function public.relatorios_do_mes(p_mes date)
returns table (vinculo_id uuid, aulas integer, enviado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
         (select count(distinct r.aula_id)::integer from public.treino_registros r join public.aulas a on a.id = r.aula_id
           where r.vinculo_id = v.id and r.feito
             and (a.inicio at time zone 'America/Sao_Paulo')::date >= date_trunc('month', p_mes)::date
             and (a.inicio at time zone 'America/Sao_Paulo')::date < (date_trunc('month', p_mes) + interval '1 month')::date),
         (select m.enviado_em from public.relatorios_mensais m where m.vinculo_id = v.id and m.mes = date_trunc('month', p_mes)::date)
    from public.vinculos v
   where v.personal_id = auth.uid() and v.situacao = 'ativo';
$$;

create or replace function public.enviar_relatorio_mes(p_vinculo uuid, p_mes date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo') then
    raise exception 'Só o personal do aluno envia o relatório.';
  end if;
  if p_mes is null or date_trunc('month', p_mes)::date > date_trunc('month', public.hoje_brasilia())::date then
    raise exception 'Escolha um mês que já começou.';
  end if;
  insert into public.relatorios_mensais (vinculo_id, mes) values (p_vinculo, date_trunc('month', p_mes)::date)
  on conflict (vinculo_id, mes) do update set enviado_em = now();
end
$$;

-- Aluno: relatórios recebidos (últimos 12 meses).
create or replace function public.meus_relatorios()
returns table (vinculo_id uuid, mes date, enviado_em timestamptz, visto_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.vinculo_id, m.mes, m.enviado_em, m.visto_em
    from public.relatorios_mensais m
    join public.vinculos v on v.id = m.vinculo_id and v.aluno_id = auth.uid() and v.situacao = 'ativo'
   where m.mes >= (date_trunc('month', public.hoje_brasilia()) - interval '12 months')::date
   order by m.mes desc;
$$;

create or replace function public.marcar_relatorio_visto(p_vinculo uuid, p_mes date)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.relatorios_mensais m set visto_em = coalesce(m.visto_em, now())
    from public.vinculos v
   where m.vinculo_id = p_vinculo and m.mes = date_trunc('month', p_mes)::date
     and v.id = m.vinculo_id and v.aluno_id = auth.uid();
$$;

revoke all on function public.treino_da_aula(uuid)                              from public, anon;
revoke all on function public.registrar_series(uuid, uuid, boolean, jsonb)      from public, anon;
revoke all on function public.escolher_treino_da_aula(uuid, integer)            from public, anon;
revoke all on function public.iniciar_treino(uuid)                              from public, anon;
revoke all on function public.encerrar_treino(uuid)                             from public, anon;
revoke all on function public.relatorios_do_mes(date)                           from public, anon;
revoke all on function public.enviar_relatorio_mes(uuid, date)                  from public, anon;
revoke all on function public.meus_relatorios()                                 from public, anon;
revoke all on function public.marcar_relatorio_visto(uuid, date)                from public, anon;
grant execute on function public.treino_da_aula(uuid)                           to authenticated;
grant execute on function public.registrar_series(uuid, uuid, boolean, jsonb)   to authenticated;
grant execute on function public.escolher_treino_da_aula(uuid, integer)         to authenticated;
grant execute on function public.iniciar_treino(uuid)                           to authenticated;
grant execute on function public.encerrar_treino(uuid)                          to authenticated;
grant execute on function public.relatorios_do_mes(date)                        to authenticated;
grant execute on function public.enviar_relatorio_mes(uuid, date)               to authenticated;
grant execute on function public.meus_relatorios()                              to authenticated;
grant execute on function public.marcar_relatorio_visto(uuid, date)             to authenticated;

commit;
