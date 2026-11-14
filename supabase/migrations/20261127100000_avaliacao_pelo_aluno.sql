-- 69 · Avaliação física registrada pelo aluno e pedida pelo personal (decisão 107).
--
-- • O próprio aluno registra a avaliação (peso, % de gordura e medidas) quando quiser, pelo app.
--   O personal é avisado. Cada um só edita ou apaga as avaliações que registrou (o personal pode
--   apagar qualquer uma).
-- • O personal pede ao aluno que registre: agora, ou programado (todo mês, a cada 2 ou 3 meses).
--   O aluno recebe uma notificação no celular e o pedido fica em destaque no app até ele registrar.
-- • Todo dia, às 9h, o robô faz os pedidos programados que chegaram no dia.
--
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.

begin;

alter table public.avaliacoes_fisicas add column if not exists por_aluno boolean not null default false;

alter table public.vinculos
  add column if not exists avaliacao_pedida_em    timestamptz,
  add column if not exists avaliacao_repetir_meses smallint check (avaliacao_repetir_meses is null or avaliacao_repetir_meses in (1, 2, 3)),
  add column if not exists avaliacao_proxima       date;
comment on column public.vinculos.avaliacao_pedida_em is 'Quando o personal pediu ao aluno que registre a avaliação física (vazio quando ele registra).';
comment on column public.vinculos.avaliacao_repetir_meses is 'Pedido automático da avaliação física: a cada 1, 2 ou 3 meses (vazio: não repete).';

-- Personal ou o próprio aluno registram (ou editam a que registraram).
create or replace function public.salvar_avaliacao_fisica(
  p_vinculo uuid, p_id uuid, p_data date, p_peso numeric, p_gordura numeric, p_medidas jsonb, p_observacao text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v        public.vinculos;
  v_aluno  boolean;
  v_id     uuid := p_id;
  v_medidas jsonb := '{}'::jsonb;
  k text;
  x jsonb;
begin
  select * into v from public.vinculos where id = p_vinculo and situacao = 'ativo';
  if not found or (auth.uid() is distinct from v.personal_id and auth.uid() is distinct from v.aluno_id) then
    raise exception 'Aluno não encontrado.';
  end if;
  v_aluno := auth.uid() is distinct from v.personal_id;
  if p_data is null or p_data > public.hoje_brasilia() then
    raise exception 'Confira a data da avaliação.';
  end if;
  -- Só as medidas conhecidas, com número entre 5 e 300 cm.
  for k, x in select * from jsonb_each(coalesce(p_medidas, '{}'::jsonb)) loop
    if k not in ('peito', 'cintura', 'abdomen', 'quadril', 'braco', 'coxa', 'panturrilha') then
      continue;
    end if;
    if jsonb_typeof(x) <> 'number' or x::text::numeric not between 5 and 300 then
      raise exception 'Confira as medidas (em cm).';
    end if;
    v_medidas := v_medidas || jsonb_build_object(k, round(x::text::numeric, 1));
  end loop;
  if p_peso is null and p_gordura is null and v_medidas = '{}'::jsonb then
    raise exception 'Preencha pelo menos o peso, o percentual de gordura ou uma medida.';
  end if;
  if v_id is null then
    insert into public.avaliacoes_fisicas (vinculo_id, personal_id, data, peso_kg, gordura_pct, medidas, observacao, por_aluno)
    values (p_vinculo, v.personal_id, p_data, p_peso, p_gordura, v_medidas, nullif(btrim(coalesce(p_observacao, '')), ''), v_aluno)
    returning id into v_id;
    -- Avaliação registrada: o pedido em aberto está atendido.
    update public.vinculos set avaliacao_pedida_em = null where id = v.id;
    if v_aluno then
      perform public.notificar(v.personal_id, 'avaliacao_do_aluno', 'Avaliação física registrada',
        coalesce(public.primeiro_nome_do_aluno(v.id), 'O aluno') || ' registrou uma avaliação física. Veja a evolução na ficha.',
        '/agenda/alunos/' || v.id, p_chave => 'avaliacao-aluno:' || v_id, p_vinculo => v.id);
    end if;
  else
    update public.avaliacoes_fisicas
       set data = p_data, peso_kg = p_peso, gordura_pct = p_gordura, medidas = v_medidas,
           observacao = nullif(btrim(coalesce(p_observacao, '')), '')
     where id = v_id and vinculo_id = p_vinculo and por_aluno = v_aluno;
    if not found then
      raise exception 'Avaliação não encontrada.';
    end if;
  end if;
  return v_id;
end
$$;

-- O personal apaga qualquer avaliação dos alunos dele; o aluno, só as que ele registrou.
create or replace function public.apagar_avaliacao_fisica(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.avaliacoes_fisicas a
   where a.id = p_id
     and (a.personal_id = auth.uid()
          or (a.por_aluno and exists (select 1 from public.vinculos v where v.id = a.vinculo_id and v.aluno_id = auth.uid())));
$$;

-- Pede ao aluno (com o app) que registre a avaliação física agora.
create or replace function public.pedir_avaliacao_fisica(p_vinculo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found or v.aluno_id is null then
    raise exception 'Só dá para pedir a aluno que usa o app.';
  end if;
  update public.vinculos set avaliacao_pedida_em = now() where id = v.id;
  perform public.notificar(v.aluno_id, 'avaliacao_pedida', 'Hora da avaliação física',
    coalesce(public.primeiro_nome_do_personal(v.personal_id), 'Seu personal') || ' pediu que você registre seu peso e suas medidas no app.',
    '/aluno/personal/' || v.id, p_chave => 'avaliacao-pedida:' || v.id || ':' || public.hoje_brasilia(), p_vinculo => v.id);
end
$$;

-- Programa o pedido automático (1, 2 ou 3 meses; 0 desliga). O primeiro pedido sai daqui a
-- p_meses meses. Devolve a data do próximo pedido.
create or replace function public.programar_avaliacao_fisica(p_vinculo uuid, p_meses integer)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vinculos;
  v_proxima date;
begin
  select * into v from public.vinculos where id = p_vinculo and personal_id = auth.uid() and situacao = 'ativo';
  if not found or v.aluno_id is null then
    raise exception 'Só dá para programar para aluno que usa o app.';
  end if;
  if coalesce(p_meses, 0) not in (0, 1, 2, 3) then
    raise exception 'Escolha todo mês, a cada 2 ou a cada 3 meses.';
  end if;
  if coalesce(p_meses, 0) = 0 then
    update public.vinculos set avaliacao_repetir_meses = null, avaliacao_proxima = null where id = v.id;
    return null;
  end if;
  v_proxima := (public.hoje_brasilia() + make_interval(months => p_meses))::date;
  update public.vinculos set avaliacao_repetir_meses = p_meses, avaliacao_proxima = v_proxima where id = v.id;
  return v_proxima;
end
$$;

-- Robô das 9h: faz os pedidos programados que chegaram.
create or replace function public.pedir_avaliacoes_programadas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje date := public.hoje_brasilia();
  v    public.vinculos;
  prox date;
  n    integer := 0;
begin
  for v in
    select * from public.vinculos
     where situacao = 'ativo' and aluno_id is not null and avaliacao_repetir_meses is not null
       and avaliacao_proxima is not null and avaliacao_proxima <= hoje
  loop
    prox := v.avaliacao_proxima;
    while prox <= hoje loop
      prox := (prox + make_interval(months => v.avaliacao_repetir_meses))::date;
    end loop;
    update public.vinculos set avaliacao_pedida_em = now(), avaliacao_proxima = prox where id = v.id;
    perform public.notificar(v.aluno_id, 'avaliacao_pedida', 'Hora da avaliação física',
      coalesce(public.primeiro_nome_do_personal(v.personal_id), 'Seu personal') || ' pediu que você registre seu peso e suas medidas no app.',
      '/aluno/personal/' || v.id, p_chave => 'avaliacao-pedida:' || v.id || ':' || hoje, p_vinculo => v.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.salvar_avaliacao_fisica(uuid, uuid, date, numeric, numeric, jsonb, text) from public, anon;
revoke all on function public.apagar_avaliacao_fisica(uuid)                                              from public, anon;
revoke all on function public.pedir_avaliacao_fisica(uuid)                                               from public, anon;
revoke all on function public.programar_avaliacao_fisica(uuid, integer)                                  from public, anon;
revoke all on function public.pedir_avaliacoes_programadas()                                             from public, anon, authenticated;
grant execute on function public.salvar_avaliacao_fisica(uuid, uuid, date, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.apagar_avaliacao_fisica(uuid)                                            to authenticated;
grant execute on function public.pedir_avaliacao_fisica(uuid)                                             to authenticated;
grant execute on function public.programar_avaliacao_fisica(uuid, integer)                                to authenticated;

-- Todo dia às 9h (Brasília).
select cron.unschedule(jobname) from cron.job where jobname = 'pbell-avaliacoes-programadas';
select cron.schedule('pbell-avaliacoes-programadas', '0 12 * * *', $$select public.pedir_avaliacoes_programadas()$$);

commit;
