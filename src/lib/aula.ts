// O dia a dia das aulas (Fase 1, etapa 5). Ver docs/plano-fase-1-agenda.md.
//
// Regras (decisões de 16/10/2026):
// - Aula que passou sem marcação conta como DADA: o personal só marca as exceções.
// - Falta sem aviso conta como dada, sem reposição.
// - Aluno que cancela com a antecedência mínima (padrão 12 h) ganha reposição; em cima
//   da hora, a aula conta como dada. Cancelada pelo personal: sempre reposição.
// - A reposição vale até o vencimento da mensalidade atual (sem vencimento: 30 dias).

export type SituacaoAula =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "falta"
  | "cancelada_com_aviso"
  | "cancelada_em_cima"
  | "remarcada";

export type OrigemAula = "fixa" | "avulsa" | "reposicao" | "experimental";

/** Situações que ocupam o horário na agenda. */
export const SITUACOES_QUE_OCUPAM: SituacaoAula[] = ["agendada", "confirmada", "realizada", "falta"];

export const ANTECEDENCIA_PADRAO_H = 12;
export const OPCOES_ANTECEDENCIA_H = [2, 4, 6, 12, 24, 48];

/** Como a aula aparece hoje: agendada que já terminou vira "dada". */
export function situacaoEfetiva(situacao: string, fim: string, agora = new Date()): SituacaoAula {
  if ((situacao === "agendada" || situacao === "confirmada") && Date.parse(fim) <= agora.getTime()) return "realizada";
  return situacao as SituacaoAula;
}

export const ROTULO_SITUACAO: Record<SituacaoAula, string> = {
  agendada: "Marcada",
  confirmada: "Confirmada",
  realizada: "Dada",
  falta: "Falta",
  cancelada_com_aviso: "Cancelada (com reposição)",
  cancelada_em_cima: "Cancelada em cima da hora (conta como dada)",
  remarcada: "Remarcada",
};

export const ROTULO_ORIGEM: Record<OrigemAula, string> = {
  fixa: "Horário fixo",
  avulsa: "Aula avulsa",
  reposicao: "Reposição",
  experimental: "Aula experimental",
};

/** Classes de cor de cada situação (etiqueta na agenda). */
export const COR_SITUACAO: Record<SituacaoAula, string> = {
  agendada: "bg-brand-soft text-brand",
  confirmada: "bg-brand-soft text-brand",
  realizada: "bg-ok-soft text-ok",
  falta: "bg-bad/10 text-bad",
  cancelada_com_aviso: "bg-surface-2 text-ink-3",
  cancelada_em_cima: "bg-gold-soft text-gold",
  remarcada: "bg-surface-2 text-ink-3",
};

/** A aula não acontece (some do horário, aparece riscada). */
export const naoAcontece = (s: SituacaoAula) => s === "cancelada_com_aviso" || s === "cancelada_em_cima" || s === "remarcada";

/**
 * Se o aluno cancelar AGORA, foi com antecedência? (O personal pode escolher outra
 * opção quando registra um aviso que recebeu antes.)
 */
export function avisouComAntecedencia(inicio: string, antecedenciaH: number, agora = new Date()): boolean {
  return Date.parse(inicio) - agora.getTime() >= antecedenciaH * 3_600_000;
}

/** "12 horas", "1 hora", "2 dias" */
export function textoDeHoras(h: number): string {
  if (h >= 24 && h % 24 === 0) return `${h / 24} dia${h / 24 > 1 ? "s" : ""}`;
  return `${h} hora${h === 1 ? "" : "s"}`;
}

export interface ResumoDoMes {
  dadas: number;
  faltas: number;
  canceladas: number;
  reposicoes: number;
}

/** Conta as aulas do mês até agora (aulas futuras não entram). */
export function resumoDoMes(
  aulas: { situacao: string; fim: string; origem: string }[],
  agora = new Date(),
): ResumoDoMes {
  const r = { dadas: 0, faltas: 0, canceladas: 0, reposicoes: 0 };
  for (const a of aulas) {
    const s = situacaoEfetiva(a.situacao, a.fim, agora);
    if (s === "realizada" || s === "cancelada_em_cima") r.dadas++;
    else if (s === "falta") r.faltas++;
    else if (s === "cancelada_com_aviso") r.canceladas++;
    if (a.origem === "reposicao" && s === "realizada") r.reposicoes++;
  }
  return r;
}
