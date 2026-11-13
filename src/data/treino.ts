"use server";

// Treino do aluno do personal, só por texto (decisão 81, migração 45).

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

/** Treino de cada dia (0 = domingo). Vazio se não houver ou se a migração 45 ainda não rodou. */
export async function treinoDoVinculo(vinculoId: string): Promise<Record<number, string>> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("treino_do_vinculo", { p_vinculo: vinculoId });
  if (error || !Array.isArray(data)) return {};
  return Object.fromEntries((data as { dia: number; texto: string }[]).map((t) => [t.dia, t.texto]));
}

export async function salvarTreinoDoVinculo(vinculoId: string, dia: number, texto: string): Promise<Resposta> {
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) return { ok: false, erro: "Escolha o dia." };
  if ((texto ?? "").length > 1000) return { ok: false, erro: "Até 1000 letras por dia." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_treino_vinculo", { p_vinculo: vinculoId, p_dia: dia, p_texto: texto ?? "" });
  if (!error) return { ok: true };
  return { ok: false, erro: /treino|dia|letras/i.test(error.message) && !/function|column/i.test(error.message) ? error.message : "Não foi possível salvar o treino." };
}
