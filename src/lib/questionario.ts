// Questionários de acompanhamento dos alunos online e híbridos (decisão de 20/10/2026).
// Ver docs/plano-fase-1-agenda.md e a migração 20261020140000_questionarios.sql.

import { minParaHora, nomeDoDia } from "./expediente";

export type TipoPergunta = "nota" | "numero" | "sim_nao" | "escolha" | "texto";

export interface Pergunta {
  id: string;
  tipo: TipoPergunta;
  texto: string;
  obrigatoria: boolean;
  /** Só na múltipla escolha (2 a 8). */
  opcoes?: string[];
  /** Só no número: "kg", "h", "treinos"… */
  unidade?: string;
}

export type Respostas = Record<string, number | boolean | string>;

export const TIPOS_PERGUNTA: { valor: TipoPergunta; rotulo: string; exemplo: string }[] = [
  { valor: "nota", rotulo: "Nota de 0 a 10", exemplo: "Qualidade do sono" },
  { valor: "numero", rotulo: "Número", exemplo: "Peso, horas de sono, treinos" },
  { valor: "sim_nao", rotulo: "Sim ou não", exemplo: "Seguiu a dieta?" },
  { valor: "escolha", rotulo: "Múltipla escolha", exemplo: "Progressão de carga" },
  { valor: "texto", rotulo: "Texto livre", exemplo: "Como foi a semana?" },
];

export const LIMITE_PERGUNTAS = 30;

/** Identificador curto e único para uma pergunta nova. */
export const novoIdPergunta = () => `p${Math.random().toString(36).slice(2, 8)}`;

/** O que impede salvar o modelo (vazia = pode salvar). Espelha a conferência do banco. */
export function problemasDoQuestionario(nome: string, perguntas: Pergunta[]): string[] {
  const p: string[] = [];
  if (nome.trim().length < 2 || nome.trim().length > 60) p.push("dê um nome ao questionário (até 60 caracteres)");
  if (perguntas.length === 0) p.push("inclua pelo menos uma pergunta");
  if (perguntas.length > LIMITE_PERGUNTAS) p.push(`use no máximo ${LIMITE_PERGUNTAS} perguntas`);
  if (perguntas.some((q) => q.texto.trim().length < 2 || q.texto.trim().length > 140))
    p.push("escreva o texto de cada pergunta (até 140 caracteres)");
  if (perguntas.some((q) => q.tipo === "escolha" && (!q.opcoes || q.opcoes.filter((o) => o.trim()).length < 2 || q.opcoes.length > 8)))
    p.push("dê de 2 a 8 opções em cada múltipla escolha");
  return p;
}

/** Perguntas prontas para salvar: sem espaços sobrando e só os campos de cada tipo. */
export function limparPerguntas(perguntas: Pergunta[]): Pergunta[] {
  return perguntas.map((q) => ({
    id: q.id,
    tipo: q.tipo,
    texto: q.texto.trim(),
    obrigatoria: q.obrigatoria,
    ...(q.tipo === "escolha" ? { opcoes: (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
    ...(q.tipo === "numero" && q.unidade?.trim() ? { unidade: q.unidade.trim() } : {}),
  }));
}

/** O que falta responder (vazia = pode enviar). */
export function faltaResponder(perguntas: Pergunta[], respostas: Respostas): string[] {
  return perguntas
    .filter((q) => {
      if (!q.obrigatoria) return false;
      const r = respostas[q.id];
      return r === undefined || r === null || (typeof r === "string" && r.trim() === "");
    })
    .map((q) => q.texto);
}

/** Resposta como texto para mostrar ao personal. */
export function textoDaResposta(q: Pergunta, valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "—";
  if (q.tipo === "sim_nao") return valor ? "Sim" : "Não";
  if (q.tipo === "nota") return `${valor}/10`;
  if (q.tipo === "numero") return `${String(valor).replace(".", ",")}${q.unidade ? ` ${q.unidade}` : ""}`;
  return String(valor);
}

// ─── Programação ────────────────────────────────────────────────────────────

export type Frequencia = "semanal" | "quinzenal" | "mensal";

export const FREQUENCIAS: { valor: Frequencia; rotulo: string }[] = [
  { valor: "semanal", rotulo: "Toda semana" },
  { valor: "quinzenal", rotulo: "A cada 15 dias" },
  { valor: "mensal", rotulo: "Todo mês" },
];

export interface Programacao {
  id: string;
  questionarioId: string;
  nomeQuestionario: string;
  frequencia: Frequencia;
  diaSemana: number | null;
  diaMes: number | null;
  horaMin: number;
  inicio: string;
  ativa: boolean;
}

/** "Toda segunda às 08:00", "A cada 15 dias, na quinta às 18:00", "Todo dia 5 às 09:00". */
export function textoDaProgramacao(p: Pick<Programacao, "frequencia" | "diaSemana" | "diaMes" | "horaMin">): string {
  const hora = minParaHora(p.horaMin);
  if (p.frequencia === "mensal") return `Todo dia ${p.diaMes} às ${hora}`;
  const dia = nomeDoDia(p.diaSemana ?? 1).toLowerCase();
  const artigo = p.diaSemana === 0 || p.diaSemana === 6 ? "todo" : "toda";
  return p.frequencia === "semanal"
    ? `${artigo.charAt(0).toUpperCase() + artigo.slice(1)} ${dia} às ${hora}`
    : `A cada 15 dias, ${p.diaSemana === 0 || p.diaSemana === 6 ? "no" : "na"} ${dia} às ${hora}`;
}

/** Mensagem para o personal mandar o link pelo WhatsApp. */
export function mensagemDoQuestionario(primeiroNome: string, titulo: string, link: string): string {
  return `Oi, ${primeiroNome}! Seu "${titulo}" está pronto. Leva uns 2 minutos. Responda aqui:\n${link}`;
}
