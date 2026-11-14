"use server";

// Avaliação física com evolução (decisão 105, migração 67): o personal registra; o personal e o
// aluno veem. O aluno vê no app, sem notificação no celular.

import type { AvaliacaoFisica, Medida } from "@/lib/avaliacao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

/** Avaliações do vínculo, da mais antiga para a mais nova (vazio antes da migração 67). */
export async function avaliacoesDoVinculo(vinculoId: string): Promise<AvaliacaoFisica[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase
    .from("avaliacoes_fisicas")
    .select("id, data, peso_kg, gordura_pct, medidas, observacao")
    .eq("vinculo_id", vinculoId)
    .order("data")
    .order("criado_em");
  if (error) return [];
  return (data ?? []).map((a) => ({
    id: a.id,
    data: a.data,
    pesoKg: a.peso_kg == null ? null : Number(a.peso_kg),
    gorduraPct: a.gordura_pct == null ? null : Number(a.gordura_pct),
    medidas: (a.medidas ?? {}) as Partial<Record<Medida, number>>,
    observacao: a.observacao,
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
