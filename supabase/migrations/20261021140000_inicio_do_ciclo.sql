-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: início do ciclo nas aulas a cada 15 dias / N semanas.
--
-- Decisão de 20/10/2026: ao alterar a matrícula de um aluno com aulas a cada 2 ou
-- mais semanas, o personal escolhe a data da próxima aula; o ciclo passa a contar
-- dali. Sem mexer, o Pienel sugere a próxima aula do ciclo atual (não muda nada).
-- Aqui: as aulas futuras só agendadas são todas refeitas, para não sobrar aula do
-- ciclo antigo entre hoje e a data escolhida. O histórico continua intacto.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261021100000_matricula_suspensa.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.salvar_matricula(p_vinculo uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v           public.vinculos;
  m           public.matriculas;
  v_hoje      date := public.hoje_brasilia();
  v_mod       text := coalesce(p_dados ->> 'modalidade', 'presencial');
  v_horarios  jsonb := case when coalesce(p_dados ->> 'modalidade', 'presencial') = 'online' then '[]'::jsonb
                            else coalesce(p_dados -> 'horarios', '[]'::jsonb) end;
  v_intervalo integer := coalesce((p_dados ->> 'intervalo_semanas')::integer, 1);
  v_duracao   integer := coalesce((p_dados ->> 'duracao')::integer, 60);
  v_ciclo     integer := case when coalesce(p_dados ->> 'modalidade', 'presencial') = 'presencial' then 1
                              else coalesce((p_dados ->> 'ciclo_meses')::integer, 1) end;
  v_fora      boolean := coalesce((p_dados ->> 'valor_fora_do_padrao')::boolean, false);
  v_venc      integer := (p_dados ->> 'dia_vencimento')::integer;
  v_inicio    date := (p_dados ->> 'inicio')::date;
  v_fim       date := (p_dados ->> 'fim')::date;
  v_a_partir  date := (p_dados ->> 'a_partir')::date;
  v_local     text := nullif(btrim(coalesce(p_dados ->> 'local', '')), '');
  v_desde     date;
  v_id        uuid;
  choque      text;
  v_valor     integer;
  v_n         integer;
begin
  select * into v from public.vinculos
   where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado entre os seus alunos ativos.';
  end if;

  if v_mod not in ('presencial', 'online', 'hibrido') then
    raise exception 'Escolha o tipo de acompanhamento.';
  end if;
  if v_intervalo not between 1 and 8 or v_ciclo not in (1, 3, 6, 12) then
    raise exception 'Confira a frequência e o plano.';
  end if;
  if v_duracao not in (30, 45, 60, 90) then
    raise exception 'Escolha uma duração de aula de 30, 45, 60 ou 90 minutos.';
  end if;
  if v_local is not null and char_length(v_local) > 80 then
    raise exception 'Use até 80 caracteres no local.';
  end if;
  if jsonb_typeof(v_horarios) <> 'array' then
    raise exception 'Confira os horários.';
  end if;
  v_n := jsonb_array_length(v_horarios);
  if v_mod <> 'online' and v_n not between 1 and 7 then
    raise exception 'Escolha de 1 a 7 horários fixos.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer)
     where h.dia not between 0 and 6 or h.inicio_min % 30 <> 0
        or h.inicio_min < 0 or h.inicio_min + v_duracao > 1440
  ) then
    raise exception 'Confira os horários: de 30 em 30 minutos, terminando até meia-noite.';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_horarios) with ordinality as a(h, n)
      join jsonb_array_elements(v_horarios) with ordinality as b(h, n)
        on (a.h ->> 'dia')::integer = (b.h ->> 'dia')::integer and a.n < b.n
       and abs((a.h ->> 'inicio_min')::integer - (b.h ->> 'inicio_min')::integer) < v_duracao
  ) then
    raise exception 'Dois horários da matrícula se sobrepõem no mesmo dia.';
  end if;

  select * into m from public.matriculas where vinculo_id = p_vinculo and situacao = 'ativa';

  if m.id is null then
    if v_inicio is null then
      raise exception 'Escolha a data de início.';
    end if;
    v_desde := v_inicio;
  else
    v_desde := greatest(coalesce(v_a_partir, v_hoje), v_hoje);
  end if;
  if v_fim is not null and v_fim < coalesce(m.inicio, v_inicio) then
    raise exception 'A data de fim tem que ser depois do início.';
  end if;
  if m.id is not null and v_fim is not null and v_fim < v_hoje then
    raise exception 'Para terminar antes de hoje, use "Encerrar matrícula".';
  end if;

  -- Valor: presencial e híbrido pelas aulas presenciais do mês (aula × vezes × 4 ÷ N
  -- semanas), vezes os meses do plano; online pelo plano online (total do período);
  -- ou o valor digitado (fora do padrão).
  if v_fora then
    v_valor := (p_dados ->> 'valor_centavos')::integer;
  elsif v_mod in ('presencial', 'hibrido') then
    select round(p.valor_aula_centavos * v_n * 4 / v_intervalo::numeric)::integer * v_ciclo into v_valor
      from public.precos_aula p where p.personal_id = v.personal_id and p.vezes_semana = v_n;
  else
    select p.valor_centavos into v_valor
      from public.precos_online p where p.personal_id = v.personal_id and p.ciclo_meses = v_ciclo;
  end if;
  if v_valor is not null and v_valor not between 1 and 10000000 then
    raise exception 'Confira o valor.';
  end if;

  -- Horário de outro aluno fica indisponível (vale para quinzenais também, por segurança).
  if v_n > 0 then
    select public.nome_do_horario(h.dia, h.inicio_min) || ' já é de ' ||
           coalesce(al.nome_completo, vo.nome_convite)
      into choque
      from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer)
      join public.matriculas o
        on o.personal_id = v.personal_id and o.situacao = 'ativa'
       and o.id is distinct from m.id
       and (o.fim is null or o.fim >= v_desde)
       and (v_fim is null or greatest(o.inicio, o.horarios_desde) <= v_fim)
      join public.matricula_horarios oh
        on oh.matricula_id = o.id and oh.dia_semana = h.dia
       and h.inicio_min < oh.inicio_min + o.duracao_min
       and oh.inicio_min < h.inicio_min + v_duracao
      join public.vinculos vo on vo.id = o.vinculo_id
      left join public.alunos al on al.id = o.aluno_id
     limit 1;
    if choque is not null then
      raise exception 'O horário de %.', choque;
    end if;
  end if;

  if m.id is null then
    insert into public.matriculas
      (vinculo_id, personal_id, aluno_id, modalidade, intervalo_semanas, ciclo_meses, duracao_min, local,
       valor_centavos, valor_fora_do_padrao, dia_vencimento, inicio, fim, horarios_desde)
    values
      (p_vinculo, v.personal_id, v.aluno_id, v_mod, v_intervalo, v_ciclo, v_duracao, v_local,
       v_valor, v_fora, v_venc, v_inicio, v_fim, v_desde)
    returning id into v_id;
  else
    v_id := m.id;
    update public.matriculas
       set modalidade = v_mod, intervalo_semanas = v_intervalo, ciclo_meses = v_ciclo,
           duracao_min = v_duracao, local = v_local,
           valor_centavos = v_valor, valor_fora_do_padrao = v_fora, dia_vencimento = v_venc,
           fim = v_fim, horarios_desde = v_desde
     where id = v_id;

    -- Refaz todas as aulas futuras que ainda estão só agendadas; as novas começam em
    -- v_desde (nas aulas a cada N semanas, a data escolhida para recomeçar o ciclo).
    delete from public.aulas
     where matricula_id = v_id and situacao = 'agendada' and inicio > now();

    delete from public.matricula_horarios where matricula_id = v_id;
  end if;

  insert into public.matricula_horarios (matricula_id, dia_semana, inicio_min)
  select v_id, h.dia, h.inicio_min
    from jsonb_to_recordset(v_horarios) as h(dia integer, inicio_min integer);

  perform public.gerar_aulas(v_id);
  -- (As cobranças são geradas pelo gatilho matriculas_gerar_cobrancas.)
  return v_id;
end
$$;

commit;
