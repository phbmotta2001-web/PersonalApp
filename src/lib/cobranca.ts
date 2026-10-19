// Cobranças (Fase 1, etapa 7). Ver docs/plano-fase-1-agenda.md.
//
// Regras (decisões de 18/10/2026):
// - Mensalidades geradas sozinhas pela matrícula; a 1ª é proporcional (o banco calcula).
// - Cada mensalidade aparece uma semana antes do vencimento.
// - Atrasada: vermelho para os dois (e o nome do aluno em vermelho na lista do personal).
// - Pagamento por fora: o aluno avisa "Já paguei" e o personal confirma.

import { centavosParaReais } from "./matricula";

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

/** "Mensalidade 18/10 a 17/11" ou a descrição da cobrança avulsa. */
export function descricaoDaCobranca(c: Pick<Cobranca, "tipo" | "descricao" | "periodoInicio" | "periodoFim">): string {
  if (c.tipo === "avulsa") return c.descricao ?? "Cobrança avulsa";
  return c.periodoInicio && c.periodoFim
    ? `Mensalidade ${dataBr(c.periodoInicio)} a ${dataBr(c.periodoFim)}`
    : "Mensalidade";
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
): string {
  const atrasada = c.vencimento < hoje;
  const linhas = [
    `Oi, ${primeiroNome}! ${atrasada ? "Passando para lembrar" : "Lembrete"}: ${descricaoDaCobranca(c).toLowerCase()}, ${centavosParaReais(c.valorCentavos)}, ${textoDoVencimento(c.vencimento, hoje)}.`,
  ];
  if (pixCopiaECola) linhas.push("", "Pix copia e cola:", pixCopiaECola);
  linhas.push("", "Depois de pagar, toque em \"Já paguei\" no Pienel. Obrigado!");
  return linhas.join("\n");
}
