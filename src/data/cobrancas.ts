"use server";

// Cobranças e chave Pix (Fase 1, etapa 7). Roda só no servidor.
// As regras ficam no banco (gerar_cobrancas, marcar_cobranca_paga, aluno_avisar_pagamento…).

import QRCode from "qrcode";
import { mensalidadesPrevistas, type Cobranca, type FormaPagamento } from "@/lib/cobranca";
import { reaisParaCentavos } from "@/lib/matricula";
import { pixCopiaECola, problemasDoPix, type DadosPix, type TipoChavePix } from "@/lib/pix";
import { frase } from "@/lib/formato";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import { listarMeusAlunos } from "./convites";

const CAMPOS =
  "id, vinculo_id, tipo, descricao, periodo_inicio, periodo_fim, vencimento, valor_centavos, situacao, pago_em, forma_pagamento, valor_pago_centavos, aluno_avisou_em, desconto_centavos";

interface Linha {
  id: string;
  vinculo_id: string;
  tipo: Cobranca["tipo"];
  descricao: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  vencimento: string;
  valor_centavos: number;
  situacao: Cobranca["situacao"];
  pago_em: string | null;
  forma_pagamento: FormaPagamento | null;
  valor_pago_centavos: number | null;
  aluno_avisou_em: string | null;
  desconto_centavos: number;
}

const paraCobranca = (l: Linha): Cobranca => ({
  id: l.id,
  vinculoId: l.vinculo_id,
  tipo: l.tipo,
  descricao: l.descricao,
  periodoInicio: l.periodo_inicio,
  periodoFim: l.periodo_fim,
  vencimento: l.vencimento,
  valorCentavos: l.valor_centavos,
  situacao: l.situacao,
  pagoEm: l.pago_em,
  formaPagamento: l.forma_pagamento,
  valorPagoCentavos: l.valor_pago_centavos,
  alunoAvisouEm: l.aluno_avisou_em,
  descontoCentavos: l.desconto_centavos ?? 0,
});

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /cobrança|valor|data|pagamento|aluno|vencimento|cobrado|avisou/i.test(m) ? m : padrao;
}

export type CobrancaComAluno = Cobranca & { nome: string };

/** Cobranças do personal logado: as em aberto (qualquer data) e as pagas ou canceladas dos últimos 60 dias. */
export async function listarCobrancas(vinculoId?: string): Promise<CobrancaComAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  let consulta = supabase
    .from("cobrancas")
    .select(CAMPOS)
    .eq("personal_id", id)
    .or(`situacao.eq.aberta,atualizada_em.gte.${new Date(Date.now() - 60 * 86_400_000).toISOString()}`)
    .order("vencimento");
  if (vinculoId) consulta = consulta.eq("vinculo_id", vinculoId);
  const [{ data }, alunos] = await Promise.all([consulta, listarMeusAlunos()]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return ((data ?? []) as Linha[]).map((l) => ({ ...paraCobranca(l), nome: nomes.get(l.vinculo_id) ?? "Aluno" }));
}

/** Resumo do mês do personal: a receber, recebido e atrasado (em centavos). */
export async function resumoDasCobrancas(hoje: string): Promise<{ aReceber: number; recebido: number; atrasado: number }> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { aReceber: 0, recebido: 0, atrasado: 0 };
  const mes = hoje.slice(0, 7);
  const [a, m] = mes.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const [{ data: abertas }, { data: pagas }] = await Promise.all([
    supabase.from("cobrancas").select("vencimento, valor_centavos").eq("personal_id", id).eq("situacao", "aberta"),
    supabase
      .from("cobrancas")
      .select("valor_pago_centavos")
      .eq("personal_id", id)
      .eq("situacao", "paga")
      .gte("pago_em", `${mes}-01`)
      .lt("pago_em", proximo),
  ]);
  const soma = (l: number[]) => l.reduce((s, v) => s + v, 0);
  return {
    aReceber: soma((abertas ?? []).filter((c) => c.vencimento >= hoje).map((c) => c.valor_centavos)),
    recebido: soma((pagas ?? []).map((c) => c.valor_pago_centavos ?? 0)),
    atrasado: soma((abertas ?? []).filter((c) => c.vencimento < hoje).map((c) => c.valor_centavos)),
  };
}

/**
 * Financeiro do mês do personal (centavos): recebido no mês, a receber até o fim do
 * mês (as em aberto que vencem até lá + as mensalidades que ainda vão ser criadas)
 * e atrasado. `previsto` é a parte que ainda não virou cobrança.
 */
export async function financeiroDoMes(
  hoje: string,
): Promise<{ recebido: number; aReceber: number; previsto: number; atrasado: number }> {
  const zero = { recebido: 0, aReceber: 0, previsto: 0, atrasado: 0 };
  const { supabase, id } = await usuarioAtual();
  if (!id) return zero;
  const [a, m] = hoje.split("-").map(Number);
  const proximo = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const fimDoMes = new Date(Date.parse(`${proximo}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const [{ data: abertas }, { data: pagas }, { data: matriculas }, { data: mensalidades }] = await Promise.all([
    supabase.from("cobrancas").select("vencimento, valor_centavos").eq("personal_id", id).eq("situacao", "aberta"),
    supabase
      .from("cobrancas")
      .select("valor_pago_centavos, valor_centavos")
      .eq("personal_id", id)
      .eq("situacao", "paga")
      .gte("pago_em", `${hoje.slice(0, 7)}-01`)
      .lt("pago_em", proximo),
    supabase
      .from("matriculas")
      .select("id, valor_centavos, dia_vencimento, ciclo_meses, fim")
      .eq("personal_id", id)
      .eq("situacao", "ativa")
      .not("valor_centavos", "is", null)
      .not("dia_vencimento", "is", null),
    supabase.from("cobrancas").select("matricula_id, vencimento").eq("personal_id", id).eq("tipo", "mensalidade"),
  ]);
  const ultimo = new Map<string, string>();
  for (const c of mensalidades ?? [])
    if (c.matricula_id && (ultimo.get(c.matricula_id) ?? "") < c.vencimento) ultimo.set(c.matricula_id, c.vencimento);
  const previsto = mensalidadesPrevistas(
    (matriculas ?? []).map((mt) => ({
      valorCentavos: mt.valor_centavos as number,
      diaVencimento: mt.dia_vencimento as number,
      cicloMeses: mt.ciclo_meses,
      fim: mt.fim,
      ultimoVencimento: ultimo.get(mt.id) ?? null,
    })),
    hoje,
    fimDoMes,
  );
  const soma = (l: number[]) => l.reduce((s, v) => s + v, 0);
  const emAberto = abertas ?? [];
  return {
    recebido: soma((pagas ?? []).map((c) => c.valor_pago_centavos ?? c.valor_centavos)),
    aReceber: soma(emAberto.filter((c) => c.vencimento >= hoje && c.vencimento <= fimDoMes).map((c) => c.valor_centavos)) + previsto,
    previsto,
    atrasado: soma(emAberto.filter((c) => c.vencimento < hoje).map((c) => c.valor_centavos)),
  };
}

/** Vínculos com alguma cobrança atrasada (para o nome ficar em vermelho). */
export async function alunosComAtraso(hoje: string): Promise<string[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("cobrancas")
    .select("vinculo_id")
    .eq("personal_id", id)
    .eq("situacao", "aberta")
    .lt("vencimento", hoje);
  return [...new Set((data ?? []).map((c) => c.vinculo_id))];
}

export async function lerCobranca(cobrancaId: string): Promise<CobrancaComAluno | null> {
  const lista = await listarCobrancasPorId(cobrancaId);
  return lista[0] ?? null;
}

async function listarCobrancasPorId(cobrancaId: string): Promise<CobrancaComAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase.from("cobrancas").select(CAMPOS).eq("id", cobrancaId).eq("personal_id", id),
    listarMeusAlunos(),
  ]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return ((data ?? []) as Linha[]).map((l) => ({ ...paraCobranca(l), nome: nomes.get(l.vinculo_id) ?? "Aluno" }));
}

// ─── Ações do personal ─────────────────────────────────────────────────────

export async function marcarCobrancaPaga(
  cobrancaId: string,
  pagoEm: string,
  forma: FormaPagamento,
  valor: string,
): Promise<Resposta> {
  const centavos = reaisParaCentavos(valor);
  if (centavos === null || Number.isNaN(centavos)) return { ok: false, erro: "Confira o valor recebido." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_cobranca_paga", {
    p_cobranca: cobrancaId,
    p_pago_em: pagoEm,
    p_forma: forma,
    p_valor: centavos,
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível salvar. Tente de novo.") } : { ok: true };
}

export async function desfazerCobranca(cobrancaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("desfazer_cobranca", { p_cobranca: cobrancaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível desfazer.") } : { ok: true };
}

export async function alterarValorCobranca(cobrancaId: string, valor: string): Promise<Resposta> {
  const centavos = reaisParaCentavos(valor);
  if (centavos === null || Number.isNaN(centavos)) return { ok: false, erro: "Confira o valor." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("alterar_valor_cobranca", { p_cobranca: cobrancaId, p_valor: centavos });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível mudar o valor.") } : { ok: true };
}

export async function cancelarCobranca(cobrancaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("cancelar_cobranca", { p_cobranca: cobrancaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível cancelar.") } : { ok: true };
}

export async function criarCobrancaAvulsa(
  vinculoId: string,
  descricao: string,
  valor: string,
  vencimento: string,
): Promise<Resposta> {
  const centavos = reaisParaCentavos(valor);
  if (centavos === null || Number.isNaN(centavos)) return { ok: false, erro: "Confira o valor." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("criar_cobranca_avulsa", {
    p_vinculo: vinculoId,
    p_descricao: descricao.trim(),
    p_valor: centavos,
    p_vencimento: vencimento,
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível criar a cobrança.") } : { ok: true };
}

// ─── Chave Pix ─────────────────────────────────────────────────────────────

/** A chave Pix do personal logado (null se ainda não cadastrou). */
export async function lerPix(): Promise<DadosPix | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data } = await supabase
    .from("personais")
    .select("pix_tipo, pix_chave, pix_nome, pix_cidade")
    .eq("id", id)
    .maybeSingle();
  if (!data?.pix_chave) return null;
  return { tipo: data.pix_tipo as TipoChavePix, chave: data.pix_chave, nome: data.pix_nome ?? "", cidade: data.pix_cidade ?? "" };
}

export async function salvarPix(pix: DadosPix): Promise<Resposta> {
  const problemas = problemasDoPix(pix);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };
  const { error } = await supabase
    .from("personais")
    .update({ pix_tipo: pix.tipo, pix_chave: pix.chave.trim(), pix_nome: pix.nome.trim().slice(0, 25), pix_cidade: pix.cidade.trim().slice(0, 15) })
    .eq("id", id);
  return error ? { ok: false, erro: "Não foi possível salvar a chave Pix." } : { ok: true };
}

/** Pix copia e cola da cobrança e o QR Code (SVG) com o mesmo código. */
export async function pixDaCobranca(
  pix: DadosPix | null,
  cobranca: Pick<Cobranca, "id" | "valorCentavos">,
): Promise<{ codigo: string; qrSvg: string } | null> {
  if (!pix) return null;
  const codigo = pixCopiaECola(pix, cobranca.valorCentavos, `KOUT${cobranca.id.replace(/-/g, "").slice(0, 19)}`);
  const qrSvg = await QRCode.toString(codigo, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { codigo, qrSvg };
}

// ─── Aluno ─────────────────────────────────────────────────────────────────

/** Cobranças do aluno logado com um personal: em aberto e as últimas pagas. */
export async function cobrancasDoAluno(vinculoId: string): Promise<Cobranca[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("cobrancas")
    .select(CAMPOS)
    .eq("aluno_id", id)
    .eq("vinculo_id", vinculoId)
    .neq("situacao", "cancelada")
    .order("vencimento", { ascending: false })
    .limit(12);
  return ((data ?? []) as Linha[]).map(paraCobranca);
}

/** A chave Pix do personal, para o aluno pagar. */
export async function pixParaAluno(vinculoId: string): Promise<DadosPix | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("pix_para_aluno", { p_vinculo: vinculoId });
  const p = data as { tipo: TipoChavePix; chave: string; nome: string; cidade: string } | null;
  return p ? { tipo: p.tipo, chave: p.chave, nome: p.nome, cidade: p.cidade } : null;
}

export async function alunoAvisarPagamento(cobrancaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("aluno_avisar_pagamento", { p_cobranca: cobrancaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível avisar. Tente de novo.") } : { ok: true };
}

/** Recebido em cada um dos últimos `meses` meses (o atual por último): [{ mes: "AAAA-MM", centavos }]. */
export async function recebidoPorMes(hoje: string, meses = 6): Promise<{ mes: string; centavos: number }[]> {
  const [a, m] = hoje.split("-").map(Number);
  const lista = Array.from({ length: meses }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (meses - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const { supabase, id } = await usuarioAtual();
  if (!id) return lista.map((mes) => ({ mes, centavos: 0 }));
  const { data } = await supabase
    .from("cobrancas")
    .select("pago_em, valor_pago_centavos, valor_centavos")
    .eq("personal_id", id)
    .eq("situacao", "paga")
    .gte("pago_em", `${lista[0]}-01`);
  const soma = new Map<string, number>();
  for (const c of data ?? []) {
    if (!c.pago_em) continue;
    const mes = c.pago_em.slice(0, 7);
    soma.set(mes, (soma.get(mes) ?? 0) + (c.valor_pago_centavos ?? c.valor_centavos));
  }
  return lista.map((mes) => ({ mes, centavos: soma.get(mes) ?? 0 }));
}
