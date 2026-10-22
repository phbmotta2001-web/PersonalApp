"use server";

// Pausa da matrícula (viagem, doença, ausência). Roda só no servidor. As regras
// (limite de dias com desconto, aulas em pausa, desconto na mensalidade) ficam no
// banco: registrar_pausa e cancelar_pausa conferem quem está logado.

import { usuarioAtual, criarClienteSupabase } from "@/lib/supabase/servidor";

export interface Pausa {
  id: string;
  inicio: string;
  fim: string;
  motivo: string | null;
  comDesconto: boolean;
  diasComDesconto: number;
  descontoCentavos: number;
  descontoAplicado: boolean;
}

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;
const erroDoBanco = (m: string | undefined, padrao: string) =>
  m && !TECNICO.test(m) && /pausa|datas|matrícula|limite|desconto/i.test(m) ? m : padrao;

/** Pausas do aluno que ainda não acabaram (e as deste ano, para o limite de desconto). */
export async function listarPausas(vinculoId: string, hoje: string): Promise<{ atuais: Pausa[]; diasComDescontoNoAno: number }> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { atuais: [], diasComDescontoNoAno: 0 };
  const { data } = await supabase
    .from("pausas")
    .select("id, inicio, fim, motivo, com_desconto, dias_com_desconto, desconto_centavos, desconto_aplicado")
    .eq("personal_id", id)
    .eq("vinculo_id", vinculoId)
    .is("cancelada_em", null)
    .gte("inicio", `${hoje.slice(0, 4)}-01-01`)
    .order("inicio");
  const todas = (data ?? []).map((p) => ({
    id: p.id,
    inicio: p.inicio,
    fim: p.fim,
    motivo: p.motivo,
    comDesconto: p.com_desconto,
    diasComDesconto: p.dias_com_desconto,
    descontoCentavos: p.desconto_centavos,
    descontoAplicado: p.desconto_aplicado,
  }));
  return {
    atuais: todas.filter((p) => p.fim >= hoje),
    diasComDescontoNoAno: todas.filter((p) => p.inicio.slice(0, 4) === hoje.slice(0, 4)).reduce((s, p) => s + p.diasComDesconto, 0),
  };
}

export type ResultadoPausa =
  | { ok: true; aulas: number; diasComDesconto: number; descontoCentavos: number }
  | { ok: false; erro: string };

export async function registrarPausa(
  vinculoId: string,
  inicio: string,
  fim: string,
  comDesconto: boolean,
  motivo: string,
  /** Valor escolhido pelo personal; null usa a sugestão do Pienel. */
  descontoCentavos: number | null = null,
): Promise<ResultadoPausa> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim) || fim < inicio)
    return { ok: false, erro: "Confira as datas da pausa." };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("registrar_pausa", {
    p_vinculo: vinculoId,
    p_inicio: inicio,
    p_fim: fim,
    p_com_desconto: comDesconto,
    p_motivo: motivo.trim(),
    p_desconto_centavos: comDesconto ? descontoCentavos : null,
  });
  if (error || !data) return { ok: false, erro: erroDoBanco(error?.message, "Não foi possível registrar a pausa.") };
  const r = data as { aulas: number; dias_com_desconto: number; desconto_centavos: number };
  return { ok: true, aulas: r.aulas, diasComDesconto: r.dias_com_desconto, descontoCentavos: r.desconto_centavos };
}

export async function cancelarPausa(
  pausaId: string,
): Promise<{ ok: true; ocupadas: number; descontoJaUsado: boolean } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("cancelar_pausa", { p_pausa: pausaId });
  if (error || !data) return { ok: false, erro: erroDoBanco(error?.message, "Não foi possível cancelar a pausa.") };
  const r = data as { ocupadas: number; desconto_ja_usado: boolean };
  return { ok: true, ocupadas: r.ocupadas, descontoJaUsado: r.desconto_ja_usado };
}

/** Alunos do personal logado em pausa hoje: vínculo → último dia da pausa. */
export async function alunosEmPausa(hoje: string): Promise<Record<string, string>> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return {};
  const { data } = await supabase
    .from("pausas")
    .select("vinculo_id, fim")
    .eq("personal_id", id)
    .is("cancelada_em", null)
    .lte("inicio", hoje)
    .gte("fim", hoje);
  return Object.fromEntries((data ?? []).map((p) => [p.vinculo_id, p.fim]));
}
