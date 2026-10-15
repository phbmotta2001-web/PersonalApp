"use server";

// Porta de entrada dos dados do PERSONAL logado (Fase 1). Roda só no servidor.
// O banco só deixa cada personal ler e mudar os próprios dados (regras de segurança
// por linha em supabase/migrations).

import type { Personal, Situacao } from "@/lib/personal";
import { usuarioAtual } from "@/lib/supabase/servidor";

/** O personal logado, ou null se ninguém (ou um aluno) estiver logado. */
export async function lerPersonalAtual(): Promise<Personal | null> {
  const { supabase, id, email } = await usuarioAtual();
  if (!id) return null;

  const { data, error } = await supabase
    .from("personais")
    .select("nome_completo, whatsapp, cref, cref_uf, situacao")
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
  };
}
