-- 66 · Confirmar o pagamento de uma mensalidade que ainda não foi gerada (decisão 104).
--
-- • A mensalidade do estúdio é gerada 7 dias antes do vencimento. Se o aluno começou a ser cobrado
--   depois do dia do vencimento do mês, a do mês aparece só como previsão ("vencida") e não havia
--   como dar "Recebido". Agora a coordenação confirma direto: a mensalidade é criada já paga.

begin;

create or replace function public.receber_mensalidade_prevista_estudio(p_aluno uuid, p_mes date, p_vencimento date, p_valor integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  al  public.estudio_alunos;
  v_ref date := date_trunc('month', p_mes)::date;
begin
  select * into al from public.estudio_alunos where id = p_aluno;
  if not found or not public.coordena_estudio(al.estudio_id) then
    raise exception 'Aluno não encontrado.';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'Confira o valor.';
  end if;
  insert into public.estudio_cobrancas (estudio_id, estudio_aluno_id, aluno_id, referencia, vencimento, valor_centavos, tipo, situacao, pago_em)
  values (al.estudio_id, al.id, al.aluno_id, v_ref, coalesce(p_vencimento, v_ref), p_valor, 'mensalidade', 'paga', public.hoje_brasilia())
  on conflict (estudio_aluno_id, referencia, tipo)
  do update set situacao = 'paga', pago_em = public.hoje_brasilia()
   where public.estudio_cobrancas.situacao = 'aberta';
end
$$;

revoke all on function public.receber_mensalidade_prevista_estudio(uuid, date, date, integer) from public, anon;
grant execute on function public.receber_mensalidade_prevista_estudio(uuid, date, date, integer) to authenticated;

commit;
