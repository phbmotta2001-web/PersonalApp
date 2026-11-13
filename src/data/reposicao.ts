"use server";

// Férias e faltas dos professores do estúdio, e a reposição (decisão 60, migração 37).
// Leituras devolvem vazio se a migração ainda não foi rodada: o resto do estúdio segue normal.

import { agoraEmBrasilia } from "@/lib/expediente";
import { reaisParaCentavos } from "@/lib/matricula";
import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export type ModeloReposicao = "hora" | "por_aluno";
export type TipoAusencia = "ferias" | "falta";

export interface ConfigReposicao {
  modelo: ModeloReposicao;
  valorCentavos: number | null;
  externos: boolean;
}

export interface AulaParaRepor {
  id: string;
  inicio: string;
  fim: string;
  modalidade: string;
  tipo: "turma" | "turno";
  valor: number;
  assumida: boolean;
}

export interface ResumoAusencia {
  id: string;
  estudioId: string;
  personalId: string;
  nome: string;
  tipo: TipoAusencia;
  de: string;
  ate: string;
  aulas: AulaParaRepor[];
}

export interface Ausencia {
  id: string;
  personalId: string;
  tipo: TipoAusencia;
  de: string;
  ate: string;
  avisadoEm: string | null;
}

export interface ReposicaoAberta {
  aulaId: string;
  /** A falta/férias de onde veio (agrupa o pedido de substituição). */
  ausenciaId: string;
  inicio: string;
  fim: string;
  modalidade: string;
  tipo: "turma" | "turno";
  valor: number;
  ausente: string;
}

/** Valor da aula de reposição do estúdio (null: migração 37 ainda não rodada). */
export async function lerConfigReposicao(estudioId: string): Promise<ConfigReposicao | null> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase
    .from("estudios")
    .select("reposicao_modelo, reposicao_valor_centavos, reposicao_externos")
    .eq("id", estudioId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    modelo: data.reposicao_modelo === "por_aluno" ? "por_aluno" : "hora",
    valorCentavos: data.reposicao_valor_centavos,
    externos: data.reposicao_externos === true,
  };
}

export async function salvarConfigReposicao(estudioId: string, modelo: ModeloReposicao, valor: string): Promise<Resposta> {
  const centavos = reaisParaCentavos(valor ?? "");
  if (centavos === null || Number.isNaN(centavos)) return { ok: false, erro: "Informe o valor da reposição (ex.: 40,00)." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_reposicao_estudio", { p_estudio: estudioId, p_modelo: modelo, p_valor: centavos });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o valor da reposição.") } : { ok: true };
}

const paraResumo = (r: Record<string, unknown>): ResumoAusencia => ({
  id: r.id as string,
  estudioId: r.estudio_id as string,
  personalId: r.personal_id as string,
  nome: r.nome as string,
  tipo: r.tipo === "falta" ? "falta" : "ferias",
  de: r.de as string,
  ate: r.ate as string,
  aulas: ((r.aulas as Record<string, unknown>[]) ?? []).map((a) => ({
    id: a.id as string,
    inicio: a.inicio as string,
    fim: a.fim as string,
    modalidade: a.modalidade as string,
    tipo: a.tipo === "turno" ? "turno" : "turma",
    valor: Number(a.valor ?? 0),
    assumida: a.assumida === true,
  })),
});

export async function marcarAusencia(
  estudioId: string,
  personalId: string,
  tipo: TipoAusencia,
  de: string,
  ate: string,
): Promise<{ ok: true; resumo: ResumoAusencia } | { ok: false; erro: string }> {
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.test(de ?? "") || !data.test(ate ?? "")) return { ok: false, erro: "Escolha as datas." };
  if (ate < agoraEmBrasilia().data) return { ok: false, erro: "Escolha datas a partir de hoje." };
  const supabase = await criarClienteSupabase();
  const { data: r, error } = await supabase.rpc("marcar_ausencia", { p_estudio: estudioId, p_personal: personalId, p_tipo: tipo, p_de: de, p_ate: ate });
  if (error || !r) return { ok: false, erro: doBanco(error?.message, "Não foi possível marcar. Se continuar, avise a equipe do P-Bell.") };
  return { ok: true, resumo: paraResumo(r as Record<string, unknown>) };
}

export async function cancelarAusencia(ausenciaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("cancelar_ausencia", { p_ausencia: ausenciaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível desmarcar.") } : { ok: true };
}

/** Avisa pelo app (notificação) e devolve quem foi avisado, para os links do WhatsApp. */
export async function pedirReposicao(
  ausenciaId: string,
  professorId: string | null,
): Promise<{ ok: true; avisados: { nome: string; whatsapp: string }[]; link: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("pedir_reposicao", { p_ausencia: ausenciaId, p_professor: professorId });
  if (error) return { ok: false, erro: doBanco(error.message, "Não foi possível avisar.") };
  const { data: au } = await supabase.from("estudio_ausencias").select("estudio_id").eq("id", ausenciaId).maybeSingle();
  return {
    ok: true,
    avisados: ((data ?? []) as { nome: string; whatsapp: string }[]).map((p) => ({ nome: p.nome, whatsapp: p.whatsapp })),
    link: `${await origemDoSite()}/agenda/estudio/${au?.estudio_id ?? ""}`,
  };
}

/** Férias e faltas de hoje em diante (as não canceladas). */
export async function ausenciasDoEstudio(estudioId: string): Promise<Ausencia[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase
    .from("estudio_ausencias")
    .select("id, personal_id, tipo, de, ate, avisado_em")
    .eq("estudio_id", estudioId)
    .is("cancelada_em", null)
    .gte("ate", agoraEmBrasilia().data)
    .order("de");
  if (error) return [];
  return (data ?? []).map((a) => ({
    id: a.id,
    personalId: a.personal_id,
    tipo: a.tipo === "falta" ? "falta" : "ferias",
    de: a.de,
    ate: a.ate,
    avisadoEm: a.avisado_em,
  }));
}

export async function reposicoesAbertas(estudioId: string): Promise<ReposicaoAberta[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("reposicoes_abertas", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    aulaId: r.aula_id as string,
    ausenciaId: (r.ausencia_id as string | undefined) ?? "",
    inicio: r.inicio as string,
    fim: r.fim as string,
    modalidade: r.modalidade as string,
    tipo: r.tipo === "turno" ? "turno" : "turma",
    valor: Number(r.valor_centavos ?? 0),
    ausente: r.ausente as string,
  }));
}

/** Resumo de uma falta/férias já marcada (para pedir reposição depois). */
export async function resumoDaAusencia(ausenciaId: string): Promise<{ ok: true; resumo: ResumoAusencia } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("resumo_da_ausencia", { p_ausencia: ausenciaId });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível abrir. Tente de novo.") };
  return { ok: true, resumo: paraResumo(data as Record<string, unknown>) };
}

/**
 * Decisão 79: confirma de uma vez os horários marcados. Os que outro professor pegou antes são
 * pulados. Quem faltou e a coordenação são avisados.
 */
export async function assumirReposicoes(aulaIds: string[]): Promise<{ ok: true; assumidas: number; jaPegas: number } | { ok: false; erro: string }> {
  if (!aulaIds.length) return { ok: false, erro: "Marque pelo menos um horário." };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("assumir_reposicoes", { p_aulas: aulaIds });
  if (error) {
    // Migração 44 ainda não rodada: assume uma a uma.
    if (error.code !== "PGRST202") return { ok: false, erro: doBanco(error.message, "Não foi possível confirmar.") };
    let assumidas = 0;
    for (const id of aulaIds) if ((await assumirReposicao(id)).ok) assumidas++;
    return { ok: true, assumidas, jaPegas: aulaIds.length - assumidas };
  }
  const r = (data ?? {}) as { assumidas?: number; ja_pegas?: number };
  return { ok: true, assumidas: Number(r.assumidas ?? 0), jaPegas: Number(r.ja_pegas ?? 0) };
}

/** Recusa o pedido: some para quem recusou e quem pediu é avisado. */
export async function recusarReposicao(ausenciaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("recusar_reposicao", { p_ausencia: ausenciaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível recusar.") } : { ok: true };
}

export async function assumirReposicao(aulaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("assumir_reposicao", { p_aula: aulaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível assumir a aula.") } : { ok: true };
}
