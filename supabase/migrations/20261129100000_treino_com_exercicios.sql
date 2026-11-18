-- 71 · Treino com exercícios e registro na aula (decisão 114).
--
-- • O treino de cada dia passa a ter duas partes: o FOCO (o que se trabalha no dia, ex.: "peito e
--   tríceps"), que é o texto que já existia em vinculo_treinos, e a lista de EXERCÍCIOS, cada um com
--   séries, repetições, carga e descanso.
-- • Durante a aula, personal e aluno marcam cada exercício feito e registram a carga e as repetições
--   reais. Esses registros formam o gráfico de evolução das cargas.
-- • Mensalidade com valor por aula personalizado: a matrícula guarda o valor da aula combinado.

begin;

-- ─── Foco do dia: o texto antigo vira o foco, e pode ficar vazio quando só há exercícios ───────
alter table public.vinculo_treinos alter column texto drop not null;
alter table public.vinculo_treinos drop constraint if exists vinculo_treinos_texto_check;
alter table public.vinculo_treinos
  add constraint vinculo_treinos_texto_check check (texto is null or char_length(btrim(texto)) between 1 and 1000);

-- ─── Exercícios de cada dia ───────────────────────────────────────────────────────────────────
create table public.vinculo_exercicios (
  id            uuid primary key default gen_random_uuid(),
  vinculo_id    uuid not null references public.vinculos (id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  ordem         smallint not null default 0,
  nome          text not null check (char_length(btrim(nome)) between 1 and 80),
  series        smallint check (series is null or series between 1 and 20),
  repeticoes    text check (repeticoes is null or char_length(btrim(repeticoes)) between 1 and 20),
  carga_kg      numeric(6, 2) check (carga_kg is null or carga_kg between 0 and 2000),
  descanso_seg  smallint check (descanso_seg is null or descanso_seg between 0 and 900),
  atualizado_em timestamptz not null default now()
);
create index vinculo_exercicios_dia on public.vinculo_exercicios (vinculo_id, dia_semana, ordem);
alter table public.vinculo_exercicios enable row level security;

-- ─── Registro de cada exercício na aula ───────────────────────────────────────────────────────
create table public.treino_registros (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references public.aulas (id) on delete cascade,
  vinculo_id    uuid not null references public.vinculos (id) on delete cascade,
  -- Se o exercício sair da ficha, o registro fica (com o nome guardado) para o gráfico.
  exercicio_id  uuid references public.vinculo_exercicios (id) on delete set null,
  nome          text not null,
  feito         boolean not null default false,
  carga_kg      numeric(6, 2) check (carga_kg is null or carga_kg between 0 and 2000),
  repeticoes    smallint check (repeticoes is null or repeticoes between 0 and 500),
  registrado_por uuid,
  atualizado_em timestamptz not null default now(),
  unique (aula_id, exercicio_id)
);
create index treino_registros_vinculo on public.treino_registros (vinculo_id);
alter table public.treino_registros enable row level security;

-- Mensalidade com valor por aula combinado (vazio = mensalidade digitada ou pela tabela).
alter table public.matriculas add column if not exists valor_aula_centavos integer
  check (valor_aula_centavos is null or valor_aula_centavos between 100 and 1000000);

-- Quem pode ver o treino: o personal do vínculo ou o aluno (vínculo ativo).
create or replace function public.pode_ver_treino(p_vinculo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vinculos v
     where v.id = p_vinculo
       and (v.personal_id = auth.uid() or (v.aluno_id = auth.uid() and v.situacao = 'ativo'))
  );
$$;

-- Treino completo: o foco de cada dia e os exercícios.
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
                              'repeticoes', repeticoes, 'carga', carga_kg, 'descanso', descanso_seg)
                              order by dia_semana, ordem)
                              from public.vinculo_exercicios where vinculo_id = p_vinculo), '[]'::jsonb)
  );
end
$$;

-- O personal salva o treino de um dia: o foco e a lista de exercícios na ordem da tela.
-- p_exercicios: [{id?, nome, series, repeticoes, carga, descanso}]. Exercícios que saíram da lista
-- são apagados. Foco vazio e nenhum exercício: o dia fica sem treino.
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
    v_id := nullif(e ->> 'id', '')::uuid;
    if v_id is not null and exists (select 1 from public.vinculo_exercicios where id = v_id and vinculo_id = p_vinculo) then
      update public.vinculo_exercicios
         set dia_semana = p_dia, ordem = i, nome = btrim(e ->> 'nome'),
             series = nullif(e ->> 'series', '')::smallint,
             repeticoes = nullif(btrim(coalesce(e ->> 'repeticoes', '')), ''),
             carga_kg = nullif(e ->> 'carga', '')::numeric,
             descanso_seg = nullif(e ->> 'descanso', '')::smallint,
             atualizado_em = now()
       where id = v_id;
    else
      insert into public.vinculo_exercicios (vinculo_id, dia_semana, ordem, nome, series, repeticoes, carga_kg, descanso_seg)
      values (p_vinculo, p_dia, i, btrim(e ->> 'nome'),
              nullif(e ->> 'series', '')::smallint,
              nullif(btrim(coalesce(e ->> 'repeticoes', '')), ''),
              nullif(e ->> 'carga', '')::numeric,
              nullif(e ->> 'descanso', '')::smallint)
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

-- A aula em que personal ou aluno podem registrar o treino: só a deles, não cancelada, do início
-- (com 30 min de folga) até 12 h depois do fim.
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
                      or now() < a.inicio - interval '30 minutes' or now() > a.fim + interval '12 hours') then
    raise exception 'O treino só pode ser registrado no horário da aula.';
  end if;
  return a;
end
$$;

-- O que já foi marcado na aula.
create or replace function public.registros_da_aula(p_aula uuid)
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
  return coalesce((select jsonb_agg(jsonb_build_object('exercicio', exercicio_id, 'feito', feito, 'carga', carga_kg, 'repeticoes', repeticoes))
                     from public.treino_registros where aula_id = a.id), '[]'::jsonb);
end
$$;

-- Marca um exercício na aula (feito, carga e repetições reais). Personal ou aluno.
create or replace function public.registrar_exercicio(p_aula uuid, p_exercicio uuid, p_feito boolean, p_carga numeric, p_repeticoes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a  public.aulas;
  ex public.vinculo_exercicios;
begin
  a := public.aula_do_treino(p_aula, true);
  select * into ex from public.vinculo_exercicios where id = p_exercicio and vinculo_id = a.vinculo_id;
  if not found then
    raise exception 'Exercício não encontrado no treino.';
  end if;
  if p_carga is not null and p_carga not between 0 and 2000 then
    raise exception 'Confira a carga.';
  end if;
  if p_repeticoes is not null and p_repeticoes not between 0 and 500 then
    raise exception 'Confira as repetições.';
  end if;
  insert into public.treino_registros (aula_id, vinculo_id, exercicio_id, nome, feito, carga_kg, repeticoes, registrado_por)
  values (a.id, a.vinculo_id, ex.id, ex.nome, coalesce(p_feito, false), p_carga, p_repeticoes, auth.uid())
  on conflict (aula_id, exercicio_id) do update
     set feito = excluded.feito, carga_kg = excluded.carga_kg, repeticoes = excluded.repeticoes,
         nome = excluded.nome, registrado_por = excluded.registrado_por, atualizado_em = now();
end
$$;

-- Evolução: cada exercício feito, com a data da aula, a carga e as repetições.
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
             'exercicio', r.exercicio_id, 'nome', r.nome,
             'data', to_char(a.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
             'carga', r.carga_kg, 'repeticoes', r.repeticoes)
             order by a.inicio)
      from public.treino_registros r
      join public.aulas a on a.id = r.aula_id
     where r.vinculo_id = p_vinculo and r.feito), '[]'::jsonb);
end
$$;

-- Valor da aula combinado na matrícula ativa (só o personal). Vazio desfaz.
create or replace function public.salvar_valor_aula_matricula(p_vinculo uuid, p_valor integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vinculos where id = p_vinculo and personal_id = auth.uid()) then
    raise exception 'Só o personal do aluno muda a matrícula.';
  end if;
  if p_valor is not null and p_valor not between 100 and 1000000 then
    raise exception 'Confira o valor da aula.';
  end if;
  update public.matriculas set valor_aula_centavos = p_valor
   where vinculo_id = p_vinculo and personal_id = auth.uid() and situacao = 'ativa';
end
$$;

revoke all on function public.pode_ver_treino(uuid)                                          from public, anon, authenticated;
revoke all on function public.aula_do_treino(uuid, boolean)                                  from public, anon, authenticated;
revoke all on function public.treino_completo(uuid)                                          from public, anon;
revoke all on function public.salvar_treino_do_dia(uuid, integer, text, jsonb)               from public, anon;
revoke all on function public.registros_da_aula(uuid)                                        from public, anon;
revoke all on function public.registrar_exercicio(uuid, uuid, boolean, numeric, integer)     from public, anon;
revoke all on function public.evolucao_do_treino(uuid)                                       from public, anon;
revoke all on function public.salvar_valor_aula_matricula(uuid, integer)                     from public, anon;
grant execute on function public.treino_completo(uuid)                                       to authenticated;
grant execute on function public.salvar_treino_do_dia(uuid, integer, text, jsonb)            to authenticated;
grant execute on function public.registros_da_aula(uuid)                                     to authenticated;
grant execute on function public.registrar_exercicio(uuid, uuid, boolean, numeric, integer)  to authenticated;
grant execute on function public.evolucao_do_treino(uuid)                                    to authenticated;
grant execute on function public.salvar_valor_aula_matricula(uuid, integer)                  to authenticated;

commit;
