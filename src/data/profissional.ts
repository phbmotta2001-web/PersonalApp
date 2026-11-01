"use server";

// Porta de entrada dos dados do PERSONAL logado (Fase 1). Roda só no servidor.
// O banco só deixa cada personal ler e mudar os próprios dados (regras de segurança
// por linha em supabase/migrations).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Personal, Situacao } from "@/lib/personal";
import { usuarioAtual } from "@/lib/supabase/servidor";

/** O personal logado, ou null se ninguém (ou um aluno) estiver logado. */
export async function lerPersonalAtual(): Promise<Personal | null> {
  const { supabase, id, email } = await usuarioAtual();
  if (!id) return null;

  const { data, error } = await supabase
    .from("personais")
    .select("nome_completo, whatsapp, cref, cref_uf, situacao, configurado_em")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    email,
    nomeCompleto: data.nome_completo,
    whatsapp: data.whatsapp,
    cref: data.cref,
    crefUf: data.cref_uf,
    situacao: data.situacao as Situacao,
    configurado: data.configurado_em != null,
  };
}

/**
 * Fim do primeiro acesso: o banco confere se os horários de trabalho já estão salvos. Daí
 * limpa a memória de navegação do aparelho (ela ainda levaria de volta ao passo a passo) e
 * abre a agenda.
 */
export async function concluirConfiguracao(): Promise<{ ok: false; erro: string }> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };
  const { error } = await supabase.rpc("concluir_configuracao");
  if (error)
    return {
      ok: false,
      erro: error.message.includes("horários") ? "Configure seus horários de trabalho antes de continuar." : "Não foi possível salvar. Tente de novo.",
    };
  revalidatePath("/agenda", "layout");
  redirect("/agenda");
}
