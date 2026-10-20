"use server";

// Tabela de valores do personal logado (valor de cada aula por vezes na semana).
// Gravar passa pela função salvar_precos do banco, que confere quem está logado.

import { frase } from "@/lib/formato";
import { PLANOS_ONLINE, problemasDaTabela, type TabelaDeValores, type TabelaOnline } from "@/lib/precos";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

export async function lerTabelaDeValores(): Promise<TabelaDeValores> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return {};
  const { data } = await supabase
    .from("precos_aula")
    .select("vezes_semana, valor_aula_centavos")
    .eq("personal_id", id);
  return Object.fromEntries((data ?? []).map((p) => [p.vezes_semana, p.valor_aula_centavos]));
}

export async function salvarTabelaDeValores(tabela: TabelaDeValores): Promise<Resposta> {
  const problemas = problemasDaTabela(tabela);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_precos", {
    p_precos: Object.entries(tabela).map(([vezes, valor]) => ({ vezes: Number(vezes), valor_aula_centavos: valor })),
  });
  return error ? { ok: false, erro: "Não foi possível salvar os valores. Tente de novo." } : { ok: true };
}

// ─── Planos online ─────────────────────────────────────────────────────────

export async function lerTabelaOnline(): Promise<TabelaOnline> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return {};
  const { data } = await supabase.from("precos_online").select("ciclo_meses, valor_centavos").eq("personal_id", id);
  return Object.fromEntries((data ?? []).map((p) => [p.ciclo_meses, p.valor_centavos]));
}

export async function salvarTabelaOnline(tabela: TabelaOnline): Promise<Resposta> {
  const valores = Object.entries(tabela);
  if (valores.some(([meses, v]) => !PLANOS_ONLINE.some((p) => p.meses === Number(meses)) || v == null || Number.isNaN(v) || v < 100 || v > 10_000_000))
    return { ok: false, erro: "Confira os valores dos planos online (de R$ 1,00 a R$ 100.000,00)." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_precos_online", {
    p_precos: valores.map(([meses, valor]) => ({ ciclo_meses: Number(meses), valor_centavos: valor })),
  });
  return error ? { ok: false, erro: "Não foi possível salvar os planos online. Tente de novo." } : { ok: true };
}
