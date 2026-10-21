// Cobranças (Fase 1, etapa 7). Ver docs/plano-fase-1-agenda.md.
//
// Regras (decisões de 18/10/2026):
// - Mensalidades geradas sozinhas pela matrícula; a 1ª é proporcional (o banco calcula).
// - Cada mensalidade aparece uma semana antes do vencimento.
// - Atrasada: vermelho para os dois (e o nome do aluno em vermelho na lista do personal).
// - Pagamento por fora: o aluno avisa "Já paguei" e o personal confirma.

import { centavosParaReais, proximoVencimento } from "./matricula";

export type SituacaoCobranca = "a_vencer" | "vence_hoje" | "atrasada" | "paga" | "cancelada";
export type FormaPagamento = "pix" | "dinheiro" | "cartao" | "transferencia" | "outro";

export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "transferencia", rotulo: "Transferência" },
  { valor: "outro", rotulo: "Outro" },
];

export interface Cobranca {
  id: string;
  vinculoId: string;
  tipo: "mensalidade" | "avulsa";
  descricao: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  /** "AAAA-MM-DD" */
  vencimento: string;
  valorCentavos: number;
  situacao: "aberta" | "paga" | "cancelada";
  pagoEm: string | null;
  formaPagamento: FormaPagamento | null;
  valorPagoCentavos: number | null;
  /** O aluno avisou que pagou (ISO), esperando o personal confirmar. */
  alunoAvisouEm: string | null;
}

/** Situação para mostrar: aberta vira "a vencer", "vence hoje" ou "atrasada". */
export function situacaoDaCobranca(c: Pick<Cobranca, "situacao" | "vencimento">, hoje: string): SituacaoCobranca {
  if (c.situacao !== "aberta") return c.situacao;
  if (c.vencimento < hoje) return "atrasada";
  if (c.vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

export const ROTULO_COBRANCA: Record<SituacaoCobranca, string> = {
  a_vencer: "A vencer",
  vence_hoje: "Vence hoje",
  atrasada: "Atrasada",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const COR_COBRANCA: Record<SituacaoCobranca, string> = {
  a_vencer: "bg-brand-soft text-brand",
  vence_hoje: "bg-gold-soft text-gold",
  atrasada: "bg-bad/10 text-bad",
  paga: "bg-ok-soft text-ok",
  cancelada: "bg-surface-2 text-ink-3",
};

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * "Mensalidade 18/10 a 17/11" ou a descrição da cobrança avulsa. Para o aluno, a
 * mensalidade é o vencimento da matrícula: "Matrícula 18/10 a 17/11".
 */
export function descricaoDaCobranca(
  c: Pick<Cobranca, "tipo" | "descricao" | "periodoInicio" | "periodoFim">,
  paraAluno = false,
): string {
  if (c.tipo === "avulsa") return c.descricao ?? "Cobrança avulsa";
  const nome = paraAluno ? "Matrícula" : "Mensalidade";
  return c.periodoInicio && c.periodoFim ? `${nome} ${dataBr(c.periodoInicio)} a ${dataBr(c.periodoFim)}` : nome;
}

/** Dias até o vencimento (negativo = atrasada há N dias). */
export function diasAteVencer(vencimento: string, hoje: string): number {
  return Math.round((Date.parse(vencimento) - Date.parse(hoje)) / 86_400_000);
}

/** "vence em 3 dias", "vence amanhã", "venceu há 2 dias"… */
export function textoDoVencimento(vencimento: string, hoje: string): string {
  const d = diasAteVencer(vencimento, hoje);
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  if (d > 1) return `vence em ${d} dias (${dataBr(vencimento)})`;
  if (d === -1) return "venceu ontem";
  return `venceu há ${-d} dias (${dataBr(vencimento)})`;
}

/** Mensagem pronta para o personal cobrar pelo WhatsApp. */
export function mensagemDeCobranca(
  primeiroNome: string,
  c: Pick<Cobranca, "tipo" | "descricao" | "periodoInicio" | "periodoFim" | "valorCentavos" | "vencimento">,
  hoje: string,
  pixCopiaECola: string | null,
  /** A matrícula do aluno é suspensa se a mensalidade vencer sem pagamento. */
  suspende = false,
  /** Aluno menor sem app: a mensagem vai para o responsável e cita o aluno. */
  doAluno?: string,
): string {
  const atrasada = c.vencimento < hoje;
  const descricao = descricaoDaCobranca(c, true).toLowerCase() + (doAluno ? ` de ${doAluno}` : "");
  const linhas = [
    `Oi, ${primeiroNome}! ${atrasada ? "Passando para lembrar" : "Lembrete"}: ${descricao}, ${centavosParaReais(c.valorCentavos)}, ${textoDoVencimento(c.vencimento, hoje)}.`,
  ];
  if (suspende && c.tipo === "mensalidade")
    linhas.push(
      atrasada
        ? "Sua matrícula está suspensa até o pagamento."
        : "Se não for paga até o vencimento, a matrícula fica suspensa até o pagamento.",
    );
  if (pixCopiaECola) linhas.push("", "Pix copia e cola:", pixCopiaECola);
  linhas.push("", "Depois de pagar, toque em \"Já paguei\" no Pienel. Obrigado!");
  return linhas.join("\n");
}

// ─── Previsão do mês ───────────────────────────────────────────────────────

/** Matrícula ativa com valor, para prever as mensalidades que ainda não foram criadas. */
export interface MatriculaParaPrevisao {
  valorCentavos: number;
  diaVencimento: number;
  cicloMeses: number;
  fim: string | null;
  /** Vencimento da última mensalidade já criada (nulo: nenhuma ainda). */
  ultimoVencimento: string | null;
}

/**
 * Soma das mensalidades que ainda NÃO foram criadas (cada uma aparece só uma semana
 * antes do vencimento) e vencem de `hoje` até `ate`, inclusive. Segue o mesmo
 * calendário do banco (somar_meses_no_dia). Sem mensalidade criada ainda, não prevê:
 * a 1ª (proporcional) sai na hora da matrícula.
 */
export function mensalidadesPrevistas(matriculas: MatriculaParaPrevisao[], hoje: string, ate: string): number {
  let total = 0;
  for (const m of matriculas) {
    if (!m.ultimoVencimento) continue;
    let v = proximoVencimento(m.ultimoVencimento, m.diaVencimento, m.cicloMeses);
    while (v <= ate && (!m.fim || v <= m.fim)) {
      if (v >= hoje) total += m.valorCentavos;
      v = proximoVencimento(v, m.diaVencimento, m.cicloMeses);
    }
  }
  return total;
}
