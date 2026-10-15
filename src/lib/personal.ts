// Conta de personal (Fase 1): o que o cadastro pede e quais valores são aceitos.
// O banco (supabase/migrations/20261015100000_conta_personal.sql) repete estas regras.

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/**
 * Fase 1: toda conta nasce "aprovado" (sem conferência do CREF, porque não há
 * captação de alunos). "em_analise" fica para a Fase 2 (marketplace).
 */
export type Situacao = "em_analise" | "aprovado" | "suspenso";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  em_analise: "Em análise",
  aprovado: "Aprovada",
  suspenso: "Suspensa",
};

export interface DadosCadastroPersonal {
  email: string;
  senha: string;
  nomeCompleto: string;
  /** Com DDD, só números ou com máscara: "(21) 99999-0000". */
  whatsapp: string;
  /** Número do CREF, ex.: "012345-G". */
  cref: string;
  crefUf: string;
  aceitouTermo: boolean;
}

export interface Personal {
  email: string;
  nomeCompleto: string;
  whatsapp: string;
  cref: string;
  crefUf: string;
  situacao: Situacao;
}

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** "21999990000" → "(21) 99999-0000" */
export function formatarWhatsapp(digitos: string): string {
  const d = soDigitos(digitos);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function problemasDoCadastroPersonal(d: Partial<DadosCadastroPersonal> | null | undefined): string[] {
  const problemas: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nome = texto(d?.nomeCompleto);
  const whatsapp = soDigitos(texto(d?.whatsapp));
  const cref = texto(d?.cref).toUpperCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(d?.email))) problemas.push("informe um e-mail válido");
  if (typeof d?.senha !== "string" || d.senha.length < 8) problemas.push("crie uma senha com pelo menos 8 caracteres");
  else if (d.senha.length > 72) problemas.push("use uma senha com até 72 caracteres");
  if (nome.length < 2 || nome.length > 120 || !nome.includes(" ")) problemas.push("escreva seu nome completo");
  if (whatsapp.length < 10 || whatsapp.length > 11) problemas.push("informe o WhatsApp com DDD");
  if (!/^[0-9]{3,6}-?[A-Z]?$/.test(cref)) problemas.push("confira o número do CREF (ex.: 012345-G)");
  if (!UFS.includes(texto(d?.crefUf).toUpperCase() as (typeof UFS)[number])) problemas.push("escolha o estado do CREF");
  if (d?.aceitouTermo !== true) problemas.push("aceite o termo de confidencialidade");
  return problemas;
}
