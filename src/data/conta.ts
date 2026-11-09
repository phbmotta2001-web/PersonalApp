"use server";

// Cadastro, entrar, sair e troca de e-mail. Roda só no servidor.
// A senha nunca é guardada pelo P-Bell: o Supabase guarda só uma versão
// embaralhada (hash) que não pode ser revertida.

import { redirect } from "next/navigation";
import { problemasDoCadastro, type DadosCadastro } from "@/lib/aluno";
import {
  VERSAO_CONSENTIMENTO_SAUDE,
  VERSAO_CONSENTIMENTO_WHATSAPP,
  VERSAO_TERMO_CONFIDENCIALIDADE,
} from "@/lib/consentimento";
import { destinoSeguro } from "@/lib/destino";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";
import { VERSAO_TERMOS } from "@/lib/textos-legais";
import { frase } from "@/lib/formato";
import { problemasDoCadastroEmpresa, type DadosCadastroEmpresa } from "@/lib/empresa";
import { problemasDoCadastroPersonal, soDigitos, type DadosCadastroPersonal } from "@/lib/personal";
import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";

export type Resposta = { ok: true } | { ok: false; erro: string };
/** logado: a conta já entrou (sem confirmação de e-mail); se não, o link foi enviado por e-mail. */
export type RespostaCadastro = { ok: true; logado: boolean } | { ok: false; erro: string };

/** Mensagens do Supabase (em inglês) → português simples. */
function traduzirErro(mensagem: string | undefined): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Procure a mensagem do P-Bell na sua caixa de entrada (e no spam).";
  if (m.includes("password")) return "Essa senha não foi aceita. Use pelo menos 8 caracteres, misturando letras e números.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.";
  if (m.includes("database error saving new user"))
    return "Não foi possível criar a conta. Confira a data de nascimento: o cadastro é só para maiores de 18 anos.";
  if (m.includes("already") && m.includes("registered")) return "Este e-mail já tem conta. Use a opção Entrar.";
  if (m.includes("sending") || m.includes("not authorized") || m.includes("smtp"))
    return "Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos ou fale com a equipe do P-Bell.";
  // Fica registrado nos logs do servidor (sem senha), para descobrir o motivo.
  console.error("Supabase recusou a conta:", mensagem);
  return "Algo deu errado. Tente de novo em instantes.";
}

export async function cadastrar(dados: DadosCadastro, voltar?: string): Promise<RespostaCadastro> {
  const problemas = problemasDoCadastro(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const supabase = await criarClienteSupabase();
  const destino = destinoSeguro(voltar);
  const { data, error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=${encodeURIComponent(destino)}`,
      // O banco cria o perfil do aluno com estes dados (função criar_aluno_no_cadastro).
      data: {
        tipo_conta: "aluno",
        // Versão dos Termos e da Política aceita ao criar a conta (só depois de publicados).
        termos_versao: TERMOS_PUBLICADOS ? VERSAO_TERMOS : undefined,
        nome_completo: dados.nomeCompleto.trim(),
        data_nascimento: dados.dataNascimento,
        genero: dados.genero ?? "",
        consentimento_saude_versao: dados.consentimentoSaude ? VERSAO_CONSENTIMENTO_SAUDE : "",
        whatsapp: soDigitos(dados.whatsapp ?? ""),
        consentimento_whatsapp_versao: dados.avisosWhatsapp ? VERSAO_CONSENTIMENTO_WHATSAPP : "",
      },
    },
  });

  // Por segurança, o Supabase não conta se o e-mail já tinha conta: a resposta é a mesma.
  // Sem confirmação de e-mail ligada, a sessão já vem pronta: a conta entra direto.
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true, logado: data.session != null };
}

/** Cadastro de PERSONAL (Fase 1). O banco cria a linha em "personais" (situação: em análise). */
export async function cadastrarPersonal(dados: DadosCadastroPersonal): Promise<RespostaCadastro> {
  const problemas = problemasDoCadastroPersonal(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/agenda`,
      data: {
        tipo_conta: "personal",
        termos_versao: TERMOS_PUBLICADOS ? VERSAO_TERMOS : undefined,
        nome_completo: dados.nomeCompleto.trim(),
        whatsapp: soDigitos(dados.whatsapp),
        // Sem CREF, as duas informações ficam fora (o banco guarda vazio).
        cref: dados.cref.trim().toUpperCase() || undefined,
        cref_uf: (dados.cref.trim() && dados.crefUf.trim().toUpperCase()) || undefined,
        termo_confidencialidade: VERSAO_TERMO_CONFIDENCIALIDADE,
      },
    },
  });

  // Por segurança, o Supabase não conta se o e-mail já tinha conta: a resposta é a mesma.
  // Sem confirmação de e-mail ligada, a sessão já vem pronta: a conta entra direto.
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true, logado: data.session != null };
}

/**
 * Cadastro da conta EMPRESARIAL (estúdio ou academia de rede). No banco é um personal (a
 * equipe do estúdio aponta para personais), marcado com conta: "empresa"; abre direto na
 * coordenação do estúdio, sem agenda particular nem primeiro acesso.
 */
export async function cadastrarEmpresa(dados: DadosCadastroEmpresa): Promise<RespostaCadastro & { estudio?: string }> {
  const problemas = problemasDoCadastroEmpresa(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/estudio`,
      data: {
        tipo_conta: "personal",
        conta: "empresa",
        // Se a conta precisar confirmar o e-mail, o estúdio é criado depois, com estes dados.
        estudio_nome: dados.nomeEstudio.trim(),
        estudio_tipo: dados.tipo,
        termos_versao: TERMOS_PUBLICADOS ? VERSAO_TERMOS : undefined,
        nome_completo: dados.nomeCompleto.trim(),
        whatsapp: soDigitos(dados.whatsapp),
        termo_confidencialidade: VERSAO_TERMO_CONFIDENCIALIDADE,
      },
    },
  });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  if (!data.session) return { ok: true, logado: false };

  // Já entrou: cria o estúdio agora (quem cria fica na coordenação).
  const { data: estudio } = await supabase.rpc("criar_estudio", { p_nome: dados.nomeEstudio.trim() });
  if (estudio && dados.tipo === "academia") {
    await supabase.rpc("salvar_config_estudio", { p_estudio: estudio, p: { tipo: "academia", pagamento_modelo: "hora" } });
  }
  return { ok: true, logado: true, estudio: (estudio as string | null) ?? undefined };
}

/** A conta logada é empresarial (estúdio ou academia)? */
export async function souContaEmpresa(): Promise<boolean> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.user_metadata?.conta === "empresa";
}

/** Nome e tipo informados no cadastro empresarial (para criar o estúdio depois de confirmar o e-mail). */
export async function estudioDoCadastro(): Promise<{ nome: string; tipo: "estudio" | "academia" } | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getClaims();
  const m = data?.claims?.user_metadata;
  if (m?.conta !== "empresa" || typeof m.estudio_nome !== "string") return null;
  return { nome: m.estudio_nome, tipo: m.estudio_tipo === "academia" ? "academia" : "estudio" };
}

export type TipoConta = "personal" | "aluno";

/** Que tipo de conta está logada (ou null). Usado para levar cada um para a sua área. */
export async function tipoDaConta(): Promise<TipoConta | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data } = await supabase.rpc("tipo_da_conta");
  return data === "personal" || data === "aluno" ? data : null;
}

export async function entrar(
  email: string,
  senha: string,
): Promise<{ ok: true; tipo: TipoConta | null; destino: string } | { ok: false; erro: string }> {
  if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha)
    return { ok: false, erro: "Preencha e-mail e senha." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  const [{ data }, { data: equipe }, { data: claims }] = await Promise.all([
    supabase.rpc("tipo_da_conta"),
    supabase.rpc("sou_da_equipe"),
    supabase.auth.getClaims(),
  ]);
  const tipo = data === "personal" || data === "aluno" ? data : null;
  // Para onde cada conta vai depois de entrar: a da equipe abre no painel da beta e a
  // empresarial, na coordenação do estúdio.
  const empresa = claims?.claims?.user_metadata?.conta === "empresa";
  const destino = equipe === true ? "/equipe" : empresa ? "/estudio" : tipo === "personal" ? "/agenda" : "/aluno";
  return { ok: true, tipo, destino };
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Esqueci minha senha: envia o link para criar uma nova. Por segurança, a resposta é a mesma
 * com ou sem conta nesse e-mail. O modelo do e-mail no Supabase usa token_hash, para o link
 * abrir em qualquer navegador (no iPhone, o app instalado e o Safari não dividem a sessão).
 */
export async function pedirNovaSenha(email: string): Promise<Resposta> {
  const endereco = typeof email === "string" ? email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(endereco)) return { ok: false, erro: "Informe um e-mail válido." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(endereco, {
    redirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/nova-senha`,
  });
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true };
}

/** Grava a senha nova de quem abriu o link do e-mail. */
export async function definirNovaSenha(senha: string): Promise<Resposta> {
  if (typeof senha !== "string" || senha.length < 8) return { ok: false, erro: "Use pelo menos 8 caracteres." };
  if (senha.length > 72) return { ok: false, erro: "Use uma senha com até 72 caracteres." };
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Este link venceu. Peça outro em Esqueci minha senha." };
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error?.message.toLowerCase().includes("different"))
    return { ok: false, erro: "A senha nova precisa ser diferente da anterior." };
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true };
}

/** Troca de e-mail: só vale depois de confirmar pelo link enviado ("Secure email change"). */
export async function trocarEmail(novoEmail: string): Promise<Resposta> {
  const { supabase, id, email } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };
  const novo = typeof novoEmail === "string" ? novoEmail.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) return { ok: false, erro: "Informe um e-mail válido." };
  if (novo.toLowerCase() === email.toLowerCase()) return { ok: false, erro: "Esse já é o seu e-mail." };

  const { error } = await supabase.auth.updateUser(
    { email: novo },
    { emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/perfil` },
  );
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true };
}

/**
 * Exclui a conta de quem está logado (aluno ou personal), depois de conferir a senha
 * de novo, para ninguém apagar a conta de outra pessoa com o celular dela aberto.
 * O banco apaga em cascata tudo o que é da conta (função excluir_minha_conta).
 */
export async function excluirConta(senha: string): Promise<Resposta> {
  const { supabase, id, email } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };
  if (typeof senha !== "string" || !senha) return { ok: false, erro: "Digite sua senha para confirmar." };

  const conferencia = await supabase.auth.signInWithPassword({ email, password: senha });
  if (conferencia.error) return { ok: false, erro: "Senha incorreta." };

  const { error } = await supabase.rpc("excluir_minha_conta");
  if (error) return { ok: false, erro: "Não foi possível excluir a conta agora. Tente de novo." };

  // Confere no servidor de login que a conta sumiu mesmo antes de dizer que deu certo.
  const depois = await supabase.auth.getUser();
  if (depois.data.user?.id === id) return { ok: false, erro: "Não foi possível excluir a conta agora. Tente de novo." };

  await supabase.auth.signOut();
  return { ok: true };
}
