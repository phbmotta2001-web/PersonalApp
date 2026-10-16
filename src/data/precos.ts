"use server";

// Tabela de valores do personal logado (valor de cada aula por vezes na semana).
// Gravar passa pela função salvar_precos do banco, que confere quem está logado.

import { frase } from "@/lib/formato";
import { problemasDaTabela, type TabelaDeValores } from "@/lib/precos";
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
