// Convites e vínculos personal ↔ aluno (Fase 1, etapa 2).
// Decisões de 15/10/2026: link individual por aluno, válido por 14 dias. (O link único
// do personal, para divulgar em redes sociais, fica para a Fase 2.)

export const VALIDADE_CONVITE_DIAS = 14;

export type SituacaoConvite = "valido" | "expirado" | "usado" | "cancelado" | "encerrado" | "inexistente";

export interface Convite {
  situacao: SituacaoConvite;
  nomeConvite: string;
  personalNome: string;
  personalCref: string;
  jaAceitoPorMim: boolean;
}

export type SituacaoVinculo = "convidado" | "expirado" | "ativo" | "encerrado" | "cancelado";

/** Uma linha da lista de alunos do personal. */
export interface AlunoDaLista {
  vinculoId: string;
  situacao: SituacaoVinculo;
  nome: string;
  whatsapp: string | null;
  /** Só enquanto o convite está aberto. */
  codigo: string | null;
  criadoEm: string;
  expiraEm: string;
  aceitoEm: string | null;
  encerradoPor: "aluno" | "personal" | "exclusao" | null;
}

/** Problemas no formulário "Convidar aluno". */
export function problemasDoConvite(nome: unknown, whatsapp: unknown): string[] {
  const problemas: string[] = [];
  const n = typeof nome === "string" ? nome.trim() : "";
  if (n.length < 2 || n.length > 80) problemas.push("escreva o nome do aluno");
  const w = typeof whatsapp === "string" ? whatsapp.replace(/\D/g, "") : "";
  if (w !== "" && (w.length < 10 || w.length > 13)) problemas.push("confira o WhatsApp (com DDD)");
  return problemas;
}

export const linkDoConvite = (origem: string, codigo: string) => `${origem}/convite/${codigo}`;

/** Mensagem pronta para o personal mandar pelo WhatsApp dele. */
export function mensagemDoConvite(nomeAluno: string, link: string): string {
  const primeiro = nomeAluno.trim().split(/\s+/)[0];
  return (
    `Oi, ${primeiro}! Agora organizo meus treinos pelo Pienel. ` +
    `Crie sua conta por este link para ver seus horários e receber os avisos: ${link}`
  );
}

/**
 * Link que abre o WhatsApp do personal com a mensagem pronta. Com número brasileiro
 * (10 ou 11 dígitos), já abre a conversa com o aluno; sem número, o personal escolhe.
 */
export function linkWhatsapp(whatsapp: string | null, mensagem: string): string {
  const d = (whatsapp ?? "").replace(/\D/g, "");
  const numero = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** "em 3 dias", "amanhã", "hoje" — quanto falta para o convite vencer. */
export function prazoDoConvite(expiraEm: string, agora = new Date()): string {
  const dias = Math.ceil((Date.parse(expiraEm) - agora.getTime()) / 86_400_000);
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}
