"use server";

// Cadastro, entrar, sair e troca de e-mail. Roda só no servidor.
// A senha nunca é guardada pelo Pienel: o Supabase guarda só uma versão
// embaralhada (hash) que não pode ser revertida.

import { redirect } from "next/navigation";
import { problemasDoCadastro, type DadosCadastro } from "@/lib/aluno";
import {
  VERSAO_CONSENTIMENTO_SAUDE,
  VERSAO_CONSENTIMENTO_WHATSAPP,
  VERSAO_TERMO_CONFIDENCIALIDADE,
} from "@/lib/consentimento";
import { destinoSeguro } from "@/lib/destino";
import { frase } from "@/lib/formato";
import { problemasDoCadastroPersonal, soDigitos, type DadosCadastroPersonal } from "@/lib/personal";
import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";

export type Resposta = { ok: true } | { ok: false; erro: string };

/** Mensagens do Supabase (em inglês) → português simples. */
function traduzirErro(mensagem: string | undefined): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Procure a mensagem do Pienel na sua caixa de entrada (e no spam).";
  if (m.includes("password")) return "Essa senha não foi aceita. Use pelo menos 8 caracteres, misturando letras e números.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.";
  if (m.includes("database error saving new user"))
    return "Não foi possível criar a conta. Confira a data de nascimento: o cadastro é só para maiores de 18 anos.";
  if (m.includes("already") && m.includes("registered")) return "Este e-mail já tem conta. Use a opção Entrar.";
  return "Algo deu errado. Tente de novo em instantes.";
}

export async function cadastrar(dados: DadosCadastro, voltar?: string): Promise<Resposta> {
  const problemas = problemasDoCadastro(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const supabase = await criarClienteSupabase();
  const destino = destinoSeguro(voltar);
  const { error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=${encodeURIComponent(destino)}`,
      // O banco cria o perfil do aluno com estes dados (função criar_aluno_no_cadastro).
      data: {
        tipo_conta: "aluno",
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
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true };
}

/** Cadastro de PERSONAL (Fase 1). O banco cria a linha em "personais" (situação: em análise). */
export async function cadastrarPersonal(dados: DadosCadastroPersonal): Promise<Resposta> {
  const problemas = problemasDoCadastroPersonal(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/agenda`,
      data: {
        tipo_conta: "personal",
        nome_completo: dados.nomeCompleto.trim(),
        whatsapp: soDigitos(dados.whatsapp),
        cref: dados.cref.trim().toUpperCase(),
        cref_uf: dados.crefUf.trim().toUpperCase(),
        termo_confidencialidade: VERSAO_TERMO_CONFIDENCIALIDADE,
      },
    },
  });

  // Por segurança, o Supabase não conta se o e-mail já tinha conta: a resposta é a mesma.
  return error ? { ok: false, erro: traduzirErro(error.message) } : { ok: true };
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
): Promise<{ ok: true; tipo: TipoConta | null } | { ok: false; erro: string }> {
  if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha)
    return { ok: false, erro: "Preencha e-mail e senha." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  const { data } = await supabase.rpc("tipo_da_conta");
  return { ok: true, tipo: data === "personal" || data === "aluno" ? data : null };
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect("/");
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

  await supabase.auth.signOut();
  return { ok: true };
}
