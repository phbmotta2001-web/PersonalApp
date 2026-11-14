"use server";

// Avaliação física com evolução (decisão 105, migração 67): o personal registra; o personal e o
// aluno veem. Decisão 107 (migração 69): o aluno também registra, e o personal pede (agora ou
// programado), com notificação no celular.

import type { AvaliacaoFisica, Medida, PedidoDeAvaliacao } from "@/lib/avaliacao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

/** Avaliações do vínculo, da mais antiga para a mais nova (vazio antes da migração 67). */
export async function avaliacoesDoVinculo(vinculoId: string): Promise<AvaliacaoFisica[]> {
  const supabase = await criarClienteSupabase();
  // "*": antes da migração 69 não há por_aluno.
  const { data, error } = await supabase.from("avaliacoes_fisicas").select("*").eq("vinculo_id", vinculoId).order("data").order("criado_em");
  if (error) return [];
  return (data ?? []).map((a) => ({
    id: a.id,
    data: a.data,
    pesoKg: a.peso_kg == null ? null : Number(a.peso_kg),
    gorduraPct: a.gordura_pct == null ? null : Number(a.gordura_pct),
    medidas: (a.medidas ?? {}) as Partial<Record<Medida, number>>,
    observacao: a.observacao,
    porAluno: (a as { por_aluno?: boolean }).por_aluno === true,
  }));
}

export async function salvarAvaliacao(
  vinculoId: string,
  id: string | null,
  dados: { data: string; pesoKg: number | null; gorduraPct: number | null; medidas: Partial<Record<Medida, number>>; observacao: string },
): Promise<Resposta> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return { ok: false, erro: "Confira a data da avaliação." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_avaliacao_fisica", {
    p_vinculo: vinculoId,
    p_id: id,
    p_data: dados.data,
    p_peso: dados.pesoKg,
    p_gordura: dados.gorduraPct,
    p_medidas: dados.medidas,
    p_observacao: dados.observacao,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar a avaliação.") } : { ok: true };
}

export async function apagarAvaliacao(id: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("apagar_avaliacao_fisica", { p_id: id });
  return error ? { ok: false, erro: "Não foi possível apagar a avaliação." } : { ok: true };
}

/** Decisão 107: pedido em aberto e programação (null antes da migração 69). */
export async function pedidoDeAvaliacao(vinculoId: string): Promise<PedidoDeAvaliacao | null> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase
    .from("vinculos")
    .select("avaliacao_pedida_em, avaliacao_repetir_meses, avaliacao_proxima")
    .eq("id", vinculoId)
    .maybeSingle();
  if (error || !data) return null;
  return { pedidaEm: data.avaliacao_pedida_em, repetirMeses: data.avaliacao_repetir_meses, proxima: data.avaliacao_proxima };
}

/** O personal pede agora (o aluno recebe uma notificação no celular). */
export async function pedirAvaliacao(vinculoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("pedir_avaliacao_fisica", { p_vinculo: vinculoId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível pedir a avaliação.") } : { ok: true };
}

/** Pedido automático a cada 1, 2 ou 3 meses (0 desliga). */
export async function programarAvaliacao(vinculoId: string, meses: number): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("programar_avaliacao_fisica", { p_vinculo: vinculoId, p_meses: meses });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível programar o pedido.") } : { ok: true };
}
