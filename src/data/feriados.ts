"use server";

// Feriados do personal logado: a regra geral (trabalha ou não) e as exceções.
// Roda só no servidor. Salvar também acerta bloqueios e aulas (public.salvar_feriados).

import { feriadoDoDia, type RegraDeFeriados } from "@/lib/feriados";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";

export async function lerRegraDeFeriados(): Promise<RegraDeFeriados> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { trabalha: true, excecoes: [] };
  const [{ data: p }, { data: excecoes }] = await Promise.all([
    supabase.from("personais").select("trabalha_em_feriados").eq("id", id).maybeSingle(),
    supabase.from("feriados_excecoes").select("data").eq("personal_id", id),
  ]);
  return { trabalha: p?.trabalha_em_feriados ?? true, excecoes: (excecoes ?? []).map((e) => e.data as string) };
}

export async function salvarRegraDeFeriados(regra: RegraDeFeriados): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (typeof regra?.trabalha !== "boolean" || !Array.isArray(regra.excecoes))
    return { ok: false, erro: "Escolha se você trabalha em feriados." };
  const excecoes = regra.excecoes.filter((d) => typeof d === "string" && feriadoDoDia(d));
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_feriados", { p_trabalha: regra.trabalha, p_excecoes: excecoes });
  return error ? { ok: false, erro: "Não foi possível salvar. Tente de novo." } : { ok: true };
}
