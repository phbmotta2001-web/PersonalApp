"use server";

// Decisão 109: aceite dos Termos de Uso e da Política de Privacidade por quem já tinha conta.
// A versão aceita e a data ficam na própria conta (os mesmos dados que o cadastro grava).

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { VERSAO_TERMOS } from "@/lib/versao-termos";
import type { Resposta } from "./conta";

export async function aceitarTermos(): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.updateUser({
    data: { termos_versao: VERSAO_TERMOS, termos_aceitos_em: new Date().toISOString() },
  });
  if (error) return { ok: false, erro: "Não foi possível registrar o aceite. Tente de novo." };
  // Renova o login para a versão aceita valer já na próxima tela.
  await supabase.auth.refreshSession();
  return { ok: true };
}
