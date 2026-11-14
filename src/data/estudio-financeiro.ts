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
export async function salvarPrecosEstudio(
  estudioId: string,
  precos: Partial<Record<number, number>>,
  precosPlano: Partial<Record<number, Partial<Record<number, number>>>> = {},
): Promise<Resposta> {
  const linhas = (meses: number, tabela: Partial<Record<number, number>>) =>
    Object.entries(tabela)
      .filter(([, v]) => v != null)
      .map(([vezes, v]) => ({ vezes: Number(vezes), meses, valor_centavos: v as number }));
  const lista = [
    ...linhas(1, precos),
    ...Object.entries(precosPlano).flatMap(([meses, tabela]) => ([3, 6, 12].includes(Number(meses)) ? linhas(Number(meses), tabela ?? {}) : [])),
  ];
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

/** Decisão 90: planos de 3, 6 e 12 meses oferecidos e a taxa de matrícula (null: não cobra). */
export async function salvarPlanosEstudio(
  estudioId: string,
  planos: { meses: number; pagamento: "mensal" | "unico" }[],
  taxaCentavos: number | null,
): Promise<Resposta> {
  if (planos.some((p) => ![3, 6, 12].includes(p.meses) || !["mensal", "unico"].includes(p.pagamento))) return { ok: false, erro: "Confira os planos." };
  if (taxaCentavos != null && (!Number.isInteger(taxaCentavos) || taxaCentavos < 100)) return { ok: false, erro: "A taxa precisa ser de pelo menos R$ 1,00." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_planos_estudio", { p_estudio: estudioId, p_planos: planos, p_taxa: taxaCentavos });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar os planos.") } : { ok: true };
}

/** Plano do aluno (1, 3, 6 ou 12 meses; início "AAAA-MM-01") e se cobra a taxa de matrícula. */
export async function salvarPlanoAluno(alunoId: string, meses: number, inicio: string | null, taxa: boolean): Promise<Resposta> {
  if (![1, 3, 6, 12].includes(meses)) return { ok: false, erro: "Escolha o plano." };
  if (inicio != null && !/^\d{4}-\d{2}-01$/.test(inicio)) return { ok: false, erro: "Confira o mês de início." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_plano_aluno", { p_aluno: alunoId, p_meses: meses, p_inicio: inicio, p_taxa: taxa });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o plano.") } : { ok: true };
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
  alunoId: string;
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
      .select("id, estudio_aluno_id, vencimento, valor_centavos, situacao, pago_em, aluno_avisou_em, tipo, estudio_alunos(nome)")
      .eq("estudio_id", estudioId)
      .gte("vencimento", mes)
      .lt("vencimento", proximo)
      .order("vencimento"),
    supabase.rpc("pagamento_professores", { p_estudio: estudioId, p_mes: mes }),
  ]);
  return {
    mensalidades: (cobrancas ?? []).map((c) => ({
      id: c.id,
      alunoId: c.estudio_aluno_id,
      aluno: ((c.estudio_alunos as unknown as { nome: string } | null)?.nome ?? "Aluno") + (c.tipo === "taxa" ? " (taxa de matrícula)" : ""),
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

// ─── Painel da coordenação (decisão 62) ──────────────────────────────────────

export interface PagamentoDoAluno {
  /** devendo: mensalidade vencida em aberto; vencendo: vence em até 7 dias; pago: a última foi paga. */
  situacao: "devendo" | "vencendo" | "pago" | "em_dia";
  cobrancaId: string | null;
  valor: number;
  vencimento: string | null;
  pagoEm: string | null;
  alunoAvisou: boolean;
  /** Mensalidades vencidas em aberto (soma), quando devendo. */
  devido: number;
}

const DIAS_VENCENDO = 7;

/** A situação de pagamento de cada aluno do estúdio (pela mensalidade mais recente). */
export async function pagamentosDosAlunos(estudioId: string, hoje: string): Promise<Record<string, PagamentoDoAluno>> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return {};
  const { data, error } = await supabase
    .from("estudio_cobrancas")
    .select("id, estudio_aluno_id, vencimento, valor_centavos, situacao, pago_em, aluno_avisou_em")
    .eq("estudio_id", estudioId)
    .neq("situacao", "cancelada")
    .order("vencimento", { ascending: false })
    .limit(2000);
  if (error || !data) return {};
  const [a, m, d] = hoje.split("-").map(Number);
  const limite = new Date(Date.UTC(a, m - 1, d + DIAS_VENCENDO)).toISOString().slice(0, 10);
  const porAluno: Record<string, PagamentoDoAluno> = {};
  for (const c of data) {
    const atual = porAluno[c.estudio_aluno_id];
    const aberta = c.situacao === "aberta";
    if (aberta && c.vencimento < hoje) {
      // A mais antiga vencida é a que se cobra; a soma vai junto.
      const devido = (atual?.situacao === "devendo" ? atual.devido : 0) + c.valor_centavos;
      porAluno[c.estudio_aluno_id] = {
        situacao: "devendo",
        cobrancaId: c.id,
        valor: c.valor_centavos,
        vencimento: c.vencimento,
        pagoEm: null,
        alunoAvisou: c.aluno_avisou_em != null,
        devido,
      };
      continue;
    }
    if (atual) continue;
    porAluno[c.estudio_aluno_id] = {
      situacao: aberta ? (c.vencimento <= limite ? "vencendo" : "em_dia") : "pago",
      cobrancaId: c.id,
      valor: c.valor_centavos,
      vencimento: c.vencimento,
      pagoEm: c.pago_em,
      alunoAvisou: c.aluno_avisou_em != null,
      devido: 0,
    };
  }
  return porAluno;
}

export interface MesDoEstudio {
  /** "AAAA-MM". */
  mes: string;
  /** Mensalidades recebidas no mês (pela data do pagamento). */
  receita: number;
  /** O que os professores ganharam no mês (o valor pago, se já foi marcado). */
  professores: number;
}

/** Receita e custo dos professores dos últimos `n` meses, terminando em `ate` ("AAAA-MM"). */
export async function historicoDoEstudio(estudioId: string, ate: string, n = 6): Promise<MesDoEstudio[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}$/.test(ate)) return [];
  const [a, m] = ate.split("-").map(Number);
  const meses = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - n + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const fim = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
  const [{ data: pagas }, ...professores] = await Promise.all([
    supabase
      .from("estudio_cobrancas")
      .select("valor_centavos, pago_em")
      .eq("estudio_id", estudioId)
      .eq("situacao", "paga")
      .gte("pago_em", `${meses[0]}-01`)
      .lt("pago_em", fim),
    ...meses.map((mes) => supabase.rpc("pagamento_professores", { p_estudio: estudioId, p_mes: `${mes}-01` })),
  ]);
  return meses.map((mes, i) => ({
    mes,
    receita: (pagas ?? []).filter((c) => c.pago_em?.startsWith(mes)).reduce((s, c) => s + c.valor_centavos, 0),
    professores: ((professores[i].data ?? []) as { valor_centavos: number; valor_pago_centavos: number | null }[]).reduce(
      (s, p) => s + (p.valor_pago_centavos ?? p.valor_centavos),
      0,
    ),
  }));
}

export interface FaltasDoProfessor {
  personalId: string;
  faltas: number;
  ferias: number;
}

/**
 * Dias de falta e de férias de cada professor no mês ("AAAA-MM"), até hoje. Com o
 * funcionamento definido, contam só os dias em que o estúdio abre.
 */
export async function faltasDosProfessores(estudioId: string, mes: string, hoje: string, diasAbertos: number[] | null): Promise<FaltasDoProfessor[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}$/.test(mes)) return [];
  const inicio = `${mes}-01`;
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const ate = ultimo < hoje ? ultimo : hoje;
  if (ate < inicio) return [];
  const { data, error } = await supabase
    .from("estudio_ausencias")
    .select("personal_id, tipo, de, ate")
    .eq("estudio_id", estudioId)
    .is("cancelada_em", null)
    .lte("de", ate)
    .gte("ate", inicio);
  if (error || !data) return [];
  const contagem = new Map<string, { faltas: Set<string>; ferias: Set<string> }>();
  for (const x of data) {
    const c = contagem.get(x.personal_id) ?? { faltas: new Set<string>(), ferias: new Set<string>() };
    contagem.set(x.personal_id, c);
    const de = x.de > inicio ? x.de : inicio;
    const fim = x.ate < ate ? x.ate : ate;
    for (let t = Date.parse(de); t <= Date.parse(fim); t += 86_400_000) {
      const dia = new Date(t);
      if (diasAbertos && !diasAbertos.includes(dia.getUTCDay())) continue;
      (x.tipo === "falta" ? c.faltas : c.ferias).add(dia.toISOString().slice(0, 10));
    }
  }
  return [...contagem].map(([personalId, c]) => ({ personalId, faltas: c.faltas.size, ferias: c.ferias.size }));
}

export interface ResumoDoProfessor {
  personalId: string;
  /** Dias de falta no mês (até hoje). */
  faltas: number;
  /** Quanto deve receber no fim do mês, contando as aulas que ainda vão acontecer (null: sem a migração 46). */
  previsto: number | null;
}

/** Aba Professores (decisão 83): faltas no mês e previsão do pagamento de cada professor. */
export async function resumoDosProfessores(estudioId: string, hoje: string, diasAbertos: number[] | null): Promise<ResumoDoProfessor[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const mes = hoje.slice(0, 7);
  const [faltas, { data, error }] = await Promise.all([
    faltasDosProfessores(estudioId, mes, hoje, diasAbertos),
    supabase.rpc("previsao_pagamento_professores", { p_estudio: estudioId, p_mes: `${mes}-01` }),
  ]);
  const previstos = new Map(error ? [] : ((data ?? []) as { personal_id: string; valor_centavos: number }[]).map((p) => [p.personal_id, p.valor_centavos]));
  const ids = new Set([...faltas.map((f) => f.personalId), ...previstos.keys()]);
  return [...ids].map((personalId) => ({
    personalId,
    faltas: faltas.find((f) => f.personalId === personalId)?.faltas ?? 0,
    previsto: error ? null : (previstos.get(personalId) ?? 0),
  }));
}

export interface MesDeAlunos {
  mes: string;
  /** Alunos que entraram no mês. */
  novos: number;
  /** Alunos que saíram no mês. */
  saidas: number;
  /** Alunos ativos no fim do mês (ou hoje, no mês atual). */
  ativos: number;
}

/** Mês ("AAAA-MM") de um instante, no horário de Brasília. */
const mesEmBrasilia = (iso: string) => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 7);

/** Decisão 84: entradas, saídas e alunos ativos em cada um dos últimos n meses (até "AAAA-MM"). */
export async function crescimentoDoEstudio(estudioId: string, ate: string, n = 6): Promise<MesDeAlunos[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}$/.test(ate)) return [];
  const [a, m] = ate.split("-").map(Number);
  const meses = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - n + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  let { data, error } = await supabase.from("estudio_alunos").select("criado_em, situacao, encerrado_em").eq("estudio_id", estudioId);
  if (error) {
    // Sem a migração 47: quem saiu não tem data e não entra nas contas.
    const r = await supabase.from("estudio_alunos").select("criado_em, situacao").eq("estudio_id", estudioId).eq("situacao", "ativo");
    data = (r.data ?? []).map((x) => ({ ...x, encerrado_em: null }));
    error = r.error;
  }
  if (error || !data) return [];
  const alunos = data
    .filter((x) => x.situacao === "ativo" || x.encerrado_em)
    .map((x) => ({ entrou: mesEmBrasilia(x.criado_em), saiu: x.situacao === "ativo" ? null : mesEmBrasilia(x.encerrado_em as string) }));
  return meses.map((mes) => ({
    mes,
    novos: alunos.filter((x) => x.entrou === mes).length,
    saidas: alunos.filter((x) => x.saiu === mes).length,
    ativos: alunos.filter((x) => x.entrou <= mes && (x.saiu === null || x.saiu > mes)).length,
  }));
}

/** Quanto cada professor deve receber no mês ("AAAA-MM-01"), contando as aulas que ainda vão acontecer. */
export async function previsaoDosProfessores(estudioId: string, mes: string): Promise<Record<string, number> | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data, error } = await supabase.rpc("previsao_pagamento_professores", { p_estudio: estudioId, p_mes: mes });
  if (error) return null;
  return Object.fromEntries(((data ?? []) as { personal_id: string; valor_centavos: number }[]).map((p) => [p.personal_id, p.valor_centavos]));
}

/** Decisão 104: "Recebido" numa mensalidade que ainda não foi gerada (só prevista): cria já paga. */
export async function receberMensalidadePrevista(alunoId: string, mes: string, vencimento: string | null, valorCentavos: number): Promise<Resposta> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: "Mês inválido." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("receber_mensalidade_prevista_estudio", {
    p_aluno: alunoId,
    p_mes: `${mes}-01`,
    p_vencimento: vencimento || null,
    p_valor: valorCentavos,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível confirmar.") } : { ok: true };
}
