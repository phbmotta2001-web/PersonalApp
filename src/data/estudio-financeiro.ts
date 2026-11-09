"use server";

// P-Bell Estúdio, financeiro (decisão 55): configuração do estúdio, tabela de mensalidades,
// mensalidades dos alunos e quanto pagar a cada professor. Roda só no servidor; quem confere
// se é a coordenação são as funções do banco.

import { problemasDoPix, normalizarChave, type TipoChavePix } from "@/lib/pix";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import type { ModeloDePagamento, TipoDeEstudio, ValoresDePagamento } from "./estudio";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid|invalid input/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);
const centavosOk = (v: number | null) => v == null || (Number.isInteger(v) && v >= 0 && v <= 10_000_000);

const paraBanco = (v: ValoresDePagamento) => ({
  valor_hora_centavos: v.valorHora,
  valor_aula_centavos: v.valorAula,
  valor_por_aluno_centavos: v.valorPorAluno,
  percentual: v.percentual,
});
const valoresOk = (v: ValoresDePagamento) =>
  centavosOk(v.valorHora) && centavosOk(v.valorAula) && centavosOk(v.valorPorAluno) && (v.percentual == null || (v.percentual >= 0 && v.percentual <= 100));

export interface DadosConfig {
  nome: string;
  tipo: TipoDeEstudio;
  pagamentoModelo: ModeloDePagamento;
  valores: ValoresDePagamento;
  maxAlunosTurma: number;
}

export async function salvarConfigEstudio(estudioId: string, c: DadosConfig): Promise<Resposta> {
  if (!c.nome?.trim() || c.nome.trim().length < 2) return { ok: false, erro: "Informe o nome." };
  if (!valoresOk(c.valores)) return { ok: false, erro: "Confira os valores." };
  if (!Number.isInteger(c.maxAlunosTurma) || c.maxAlunosTurma < 1 || c.maxAlunosTurma > 100) return { ok: false, erro: "Máximo de alunos por turma: de 1 a 100." };
  const modelo = c.tipo === "academia" ? "hora" : c.pagamentoModelo;
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_config_estudio", {
    p_estudio: estudioId,
    p: { nome: c.nome.trim(), tipo: c.tipo, pagamento_modelo: modelo, max_alunos_turma: c.maxAlunosTurma, ...paraBanco(c.valores) },
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar.") } : { ok: true };
}

export async function salvarValorProfessor(estudioId: string, personalId: string, v: ValoresDePagamento): Promise<Resposta> {
  if (!valoresOk(v)) return { ok: false, erro: "Confira os valores." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_valor_professor", { p_estudio: estudioId, p_personal: personalId, p: paraBanco(v) });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o valor.") } : { ok: true };
}

/** Tabela de mensalidades: vezes na semana → centavos (vezes sem valor deixam de ser oferecidas). */
export async function salvarPrecosEstudio(estudioId: string, precos: Partial<Record<number, number>>): Promise<Resposta> {
  const lista = Object.entries(precos)
    .filter(([, v]) => v != null)
    .map(([vezes, v]) => ({ vezes: Number(vezes), valor_centavos: v as number }));
  if (lista.some((p) => !Number.isInteger(p.vezes) || p.vezes < 1 || p.vezes > 7 || !Number.isInteger(p.valor_centavos) || p.valor_centavos < 100))
    return { ok: false, erro: "Cada mensalidade precisa ser de pelo menos R$ 1,00." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_precos_estudio", { p_estudio: estudioId, p: lista });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar a tabela.") } : { ok: true };
}

export async function salvarPixEstudio(estudioId: string, p: { tipo: TipoChavePix; chave: string; nome: string; cidade: string }): Promise<Resposta> {
  const dados = { ...p, chave: normalizarChave(p.tipo, p.chave), nome: p.nome.trim(), cidade: p.cidade.trim() };
  const problemas = problemasDoPix(dados);
  if (problemas.length) return { ok: false, erro: problemas[0] };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_pix_estudio", {
    p_estudio: estudioId,
    p_tipo: dados.tipo,
    p_chave: dados.chave,
    p_nome: dados.nome,
    p_cidade: dados.cidade,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o Pix.") } : { ok: true };
}

export async function salvarMensalidadeAluno(alunoId: string, valorCentavos: number | null, dia: number | null): Promise<Resposta> {
  if (!centavosOk(valorCentavos)) return { ok: false, erro: "Confira o valor." };
  if (dia != null && (!Number.isInteger(dia) || dia < 1 || dia > 28)) return { ok: false, erro: "Vencimento: dia 1 a 28." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_mensalidade_aluno", { p_aluno: alunoId, p_valor_centavos: valorCentavos, p_dia: dia });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar a mensalidade.") } : { ok: true };
}

export async function gerarMensalidadesAgora(estudioId: string): Promise<{ ok: true; criadas: number } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("gerar_cobrancas_do_estudio", { p_estudio: estudioId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível gerar as mensalidades.") } : { ok: true, criadas: (data as number) ?? 0 };
}

export async function marcarMensalidade(cobrancaId: string, situacao: "aberta" | "paga" | "cancelada"): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_cobranca_estudio", { p_cobranca: cobrancaId, p_situacao: situacao });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível atualizar.") } : { ok: true };
}

/** Marca o pagamento do professor no mês (valor em centavos) ou desfaz (null). */
export async function marcarPagamentoProfessor(estudioId: string, personalId: string, mes: string, valorCentavos: number | null): Promise<Resposta> {
  if (!/^\d{4}-\d{2}-01$/.test(mes)) return { ok: false, erro: "Mês inválido." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_pagamento_professor", {
    p_estudio: estudioId,
    p_personal: personalId,
    p_mes: mes,
    p_valor_centavos: valorCentavos,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível registrar.") } : { ok: true };
}

// ─── Leitura do mês ──────────────────────────────────────────────────────────

export interface MensalidadeDoEstudio {
  id: string;
  aluno: string;
  vencimento: string;
  valor: number;
  situacao: "aberta" | "paga" | "cancelada";
  pagoEm: string | null;
  alunoAvisou: boolean;
}

export interface PagamentoDoProfessor {
  personalId: string;
  nome: string;
  aulas: number;
  minutos: number;
  presencas: number;
  valor: number;
  pagoEm: string | null;
  valorPago: number | null;
}

export interface FinanceiroDoMes {
  mensalidades: MensalidadeDoEstudio[];
  professores: PagamentoDoProfessor[];
}

/** Mensalidades que vencem no mês e o pagamento de cada professor (mes = "AAAA-MM-01"). */
export async function lerFinanceiroDoMes(estudioId: string, mes: string): Promise<FinanceiroDoMes> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}-01$/.test(mes)) return { mensalidades: [], professores: [] };
  const [a, m] = mes.split("-").map(Number);
  const proximo = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const [{ data: cobrancas }, { data: professores }] = await Promise.all([
    supabase
      .from("estudio_cobrancas")
      .select("id, vencimento, valor_centavos, situacao, pago_em, aluno_avisou_em, estudio_alunos(nome)")
      .eq("estudio_id", estudioId)
      .gte("vencimento", mes)
      .lt("vencimento", proximo)
      .order("vencimento"),
    supabase.rpc("pagamento_professores", { p_estudio: estudioId, p_mes: mes }),
  ]);
  return {
    mensalidades: (cobrancas ?? []).map((c) => ({
      id: c.id,
      aluno: (c.estudio_alunos as unknown as { nome: string } | null)?.nome ?? "Aluno",
      vencimento: c.vencimento,
      valor: c.valor_centavos,
      situacao: c.situacao,
      pagoEm: c.pago_em,
      alunoAvisou: c.aluno_avisou_em != null,
    })),
    professores: ((professores ?? []) as {
      personal_id: string;
      nome: string;
      aulas: number;
      minutos: number;
      presencas: number;
      valor_centavos: number;
      pago_em: string | null;
      valor_pago_centavos: number | null;
    }[]).map((p) => ({
      personalId: p.personal_id,
      nome: p.nome,
      aulas: p.aulas,
      minutos: p.minutos,
      presencas: p.presencas,
      valor: p.valor_centavos,
      pagoEm: p.pago_em,
      valorPago: p.valor_pago_centavos,
    })),
  };
}
