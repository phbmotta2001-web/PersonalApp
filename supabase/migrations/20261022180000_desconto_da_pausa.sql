-- ═══════════════════════════════════════════════════════════════════════════
-- Pienel, Fase 1: desconto da pausa personalizável.
--
-- Decisão de 21/10/2026: o Pienel sugere o desconto (valor do mês ÷ 30 × dias, até o
-- limite de dias por ano) e explica a conta; o personal pode trocar o valor.
--
-- Como aplicar: Supabase > SQL Editor > New query > colar tudo > Run. UMA vez,
-- depois de 20261022140000_pausa_da_matricula.sql.
-- Está dentro de begin/commit: se der erro em qualquer ponto, nada muda.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop function public.registrar_pausa(uuid, date, date, boolean, text);

create or replace function public.registrar_pausa(
  p_vinculo uuid, p_inicio date, p_fim date, p_com_desconto boolean, p_motivo text,
  p_desconto_centavos integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m          public.matriculas;
  v_limite   integer;
  v_usados   integer;
  v_dias     integer;
  v_desc_d   integer := 0;
  v_desc     integer := 0;
  v_aulas    integer;
  v_cob      public.cobrancas;
  v_id       uuid;
begin
  select * into m from public.matriculas
   where vinculo_id = p_vinculo and personal_id = auth.uid() and situacao = 'ativa';
  if not found then
    raise exception 'Este aluno não tem matrícula ativa.';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Confira as datas da pausa.';
  end if;
  if p_inicio < public.hoje_brasilia() then
    raise exception 'A pausa começa hoje ou depois.';
  end if;
  if p_fim - p_inicio > 180 then
    raise exception 'A pausa pode ter no máximo 6 meses.';
  end if;
  if exists (select 1 from public.pausas where matricula_id = m.id and cancelada_em is null
                and daterange(inicio, fim, '[]') && daterange(p_inicio, p_fim, '[]')) then
    raise exception 'Já existe uma pausa nessas datas.';
  end if;

  v_dias := p_fim - p_inicio + 1;
  if coalesce(p_com_desconto, false) and m.valor_centavos is not null then
    select pausa_dias_ano into v_limite from public.personais where id = m.personal_id;
    select coalesce(sum(dias_com_desconto), 0) into v_usados
      from public.pausas
     where vinculo_id = p_vinculo and cancelada_em is null
       and extract(year from inicio) = extract(year from p_inicio);
    v_desc_d := greatest(0, least(v_dias, v_limite - v_usados));
    v_desc := round(m.valor_centavos::numeric / m.ciclo_meses * v_desc_d / 30)::integer;
    -- Valor escolhido pelo personal no lugar da sugestão (até o valor da mensalidade).
    if p_desconto_centavos is not null then
      if p_desconto_centavos < 0 then
        raise exception 'Confira o valor do desconto.';
      end if;
      v_desc := least(p_desconto_centavos, m.valor_centavos);
    end if;
  end if;

  insert into public.pausas
    (personal_id, vinculo_id, matricula_id, inicio, fim, motivo, com_desconto, dias_com_desconto, desconto_centavos)
  values
    (m.personal_id, p_vinculo, m.id, p_inicio, p_fim, nullif(left(btrim(coalesce(p_motivo, '')), 120), ''),
     coalesce(p_com_desconto, false), v_desc_d, v_desc)
  returning id into v_id;

  -- Aulas fixas do período: em pausa (o horário fica livre).
  update public.aulas
     set situacao = 'pausada'
   where matricula_id = m.id and origem = 'fixa' and situacao in ('agendada', 'confirmada')
     and inicio > now()
     and (inicio at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
  get diagnostics v_aulas = row_count;

  -- Desconto: na próxima mensalidade em aberto que cobre a pausa (ou espera a próxima).
  if v_desc > 0 then
    select * into v_cob from public.cobrancas
     where matricula_id = m.id and tipo = 'mensalidade' and situacao = 'aberta'
       and coalesce(periodo_fim, vencimento) >= p_inicio
     order by vencimento limit 1;
    if found then
      v_desc := least(v_desc, v_cob.valor_centavos - 1);
      update public.cobrancas
         set valor_centavos = valor_centavos - v_desc,
             desconto_centavos = desconto_centavos + v_desc,
             atualizada_em = now()
       where id = v_cob.id;
      update public.pausas set desconto_centavos = v_desc, desconto_aplicado = true, cobranca_id = v_cob.id
       where id = v_id;
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'aulas', v_aulas, 'dias', v_dias,
                            'dias_com_desconto', v_desc_d, 'desconto_centavos', v_desc);
end
$$;

revoke all on function public.registrar_pausa(uuid, date, date, boolean, text, integer) from public, anon;
grant execute on function public.registrar_pausa(uuid, date, date, boolean, text, integer) to authenticated;

commit;
