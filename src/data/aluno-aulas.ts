"use server";

// O aluno cancela, remarca e marca reposição pelo app (Fase 1, etapa 6).
// As regras ficam no banco (aluno_cancelar_aula, aluno_marcar_reposicao,
// aluno_remarcar_aula, livres_para_aluno), que conferem o vínculo do aluno logado.

import { criarClienteSupabase } from "@/lib/supabase/servidor";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /aula|horário|reposição|personal|cancelad|remarcad|hora|pedido|sugest/i.test(m) ? m : padrao;
}

export interface RegrasDoPersonal {
  /** Horas antes da aula para cancelar e ganhar reposição. */
  cancelamentoH: number;
  /** Horas de antecedência para marcar reposição ou remarcar. */
  reposicaoH: number;
}

export async function regrasParaAluno(vinculoId: string): Promise<RegrasDoPersonal> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("regras_para_aluno", { p_vinculo: vinculoId });
  const r = (data ?? {}) as { cancelamento_h?: number; reposicao_h?: number };
  return { cancelamentoH: r.cancelamento_h ?? 12, reposicaoH: r.reposicao_h ?? 8 };
}

/** Horários livres do personal (instantes ISO) entre duas datas "AAAA-MM-DD". */
export async function livresParaAluno(vinculoId: string, de: string, ate: string): Promise<string[]> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("livres_para_aluno", { p_vinculo: vinculoId, p_de: de, p_ate: ate });
  return ((data ?? []) as { inicio: string }[]).map((l) => new Date(l.inicio).toISOString());
}

export async function alunoCancelarAula(
  aulaId: string,
): Promise<{ ok: true; comReposicao: boolean; validoAte: string | null } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("aluno_cancelar_aula", { p_aula: aulaId });
  if (error || !data) return { ok: false, erro: erroDoBanco(error?.message, "Não foi possível cancelar. Tente de novo.") };
  const r = data as { com_reposicao: boolean; valido_ate: string | null };
  return { ok: true, comReposicao: r.com_reposicao, validoAte: r.valido_ate };
}

export async function alunoMarcarReposicao(
  vinculoId: string,
  inicio: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("aluno_marcar_reposicao", { p_vinculo: vinculoId, p_inicio: inicio });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível marcar. Tente de novo.") } : { ok: true };
}

export async function alunoRemarcarAula(aulaId: string, inicio: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("aluno_remarcar_aula", { p_aula: aulaId, p_inicio: inicio });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível remarcar. Tente de novo.") } : { ok: true };
}

/** Responder à sugestão de horário do personal. */
export async function alunoResponderSugestao(aulaId: string, aceitar: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("aluno_responder_sugestao", { p_aula: aulaId, p_aceitar: aceitar });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível responder. Tente de novo.") } : { ok: true };
}

/** Desistir de um pedido que ainda não foi respondido (a reposição volta). */
export async function alunoDesistirPedido(aulaId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("aluno_desistir_pedido", { p_aula: aulaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível desistir. Tente de novo.") } : { ok: true };
}
