// Conta empresarial (estúdio ou academia de rede): quem coordena o estúdio, sem a agenda
// particular de personal. No banco ela é um personal (a equipe do estúdio aponta para
// personais) marcado com conta: "empresa" nos dados da conta.

import { problemasDoFuncionamento, type Funcionamento } from "./funcionamento";
import { soDigitos } from "./personal";

export interface DadosCadastroEmpresa {
  email: string;
  senha: string;
  /** Nome de quem responde pelo estúdio. */
  nomeCompleto: string;
  whatsapp: string;
  nomeEstudio: string;
  tipo: "estudio" | "academia";
  /** Dias e horários de funcionamento. */
  funcionamento: Funcionamento;
  /** Decisão 96: alunos mudam de turma sem confirmação. */
  transitoLivre: boolean;
  aceitouTermo: boolean;
}

export function problemasDoCadastroEmpresa(d: Partial<DadosCadastroEmpresa> | null | undefined): string[] {
  const problemas: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nome = texto(d?.nomeCompleto);
  const estudio = texto(d?.nomeEstudio);
  const whatsapp = soDigitos(texto(d?.whatsapp));
  if (estudio.length < 2 || estudio.length > 80) problemas.push("informe o nome do estúdio ou da academia");
  if (d?.tipo !== "estudio" && d?.tipo !== "academia") problemas.push("escolha estúdio ou academia");
  problemas.push(...problemasDoFuncionamento(d?.funcionamento ?? {}));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto(d?.email))) problemas.push("informe um e-mail válido");
  if (typeof d?.senha !== "string" || d.senha.length < 8) problemas.push("crie uma senha com pelo menos 8 caracteres");
  else if (d.senha.length > 72) problemas.push("use uma senha com até 72 caracteres");
  if (nome.length < 2 || nome.length > 120 || !nome.includes(" ")) problemas.push("escreva o nome completo do responsável");
  if (whatsapp.length < 10 || whatsapp.length > 11) problemas.push("informe o WhatsApp com DDD");
  if (d?.aceitouTermo !== true) problemas.push("aceite o termo de confidencialidade");
  return problemas;
}
