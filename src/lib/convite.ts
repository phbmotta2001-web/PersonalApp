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
  /** Aluno cadastrado pelo personal, sem conta no Pienel (etapa 5b). */
  semConta: boolean;
  /** Sem conta e menor de 18 anos: o WhatsApp acima é o do responsável. */
  menor: boolean;
  responsavelNome: string | null;
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

// ─── Aluno sem conta (etapa 5b, decisões de 21/10/2026) ─────────────────────
// Qualquer aluno que não queira usar o app. Menor de 18 anos: nome e WhatsApp do
// responsável e a confirmação de que ele autorizou o cadastro (LGPD, art. 14).

export interface DadosAlunoSemConta {
  nome: string;
  /** "AAAA-MM-DD" */
  dataNascimento: string;
  whatsapp: string;
  responsavelNome: string;
  responsavelWhatsapp: string;
  responsavelAutorizou: boolean;
  observacoes: string;
}

export interface FichaSemConta {
  vinculoId: string;
  aceitoEm: string;
  nome: string;
  whatsapp: string | null;
  dataNascimento: string;
  idade: number;
  menor: boolean;
  responsavelNome: string | null;
  responsavelWhatsapp: string | null;
  observacoes: string | null;
  consentimentoEm: string | null;
  /** Convite para ter conta, enquanto vale. */
  conviteCodigo: string | null;
  conviteExpiraEm: string | null;
}

/** Menor de 18 anos na data `hoje` ("AAAA-MM-DD"). */
export function ehMenor(nascimento: string, hoje: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return false;
  const [a, m, d] = hoje.split("-").map(Number);
  const limite = `${a - 18}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return nascimento > limite;
}

const digitos = (s: string) => s.replace(/\D/g, "");
const whatsappValido = (s: string) => /^\d{10,13}$/.test(digitos(s));

/** Problemas no formulário do aluno sem conta. */
export function problemasDoAlunoSemConta(d: DadosAlunoSemConta, hoje: string): string[] {
  const p: string[] = [];
  if (d.nome.trim().length < 2 || d.nome.trim().length > 80) p.push("escreva o nome do aluno");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataNascimento) || d.dataNascimento > hoje || d.dataNascimento < "1900-01-01")
    p.push("confira a data de nascimento");
  if (d.whatsapp.trim() !== "" && !whatsappValido(d.whatsapp)) p.push("confira o WhatsApp do aluno (com DDD)");
  if (d.observacoes.length > 1000) p.push("as observações passam de 1000 letras");
  if (ehMenor(d.dataNascimento, hoje)) {
    if (d.responsavelNome.trim().length < 2) p.push("escreva o nome do responsável");
    if (!whatsappValido(d.responsavelWhatsapp)) p.push("confira o WhatsApp do responsável (com DDD)");
    if (!d.responsavelAutorizou) p.push("confirme que o responsável autorizou o cadastro");
  }
  return p;
}
