"use server";

// Inscrição do celular para receber notificações (etapa 4b). Roda só no servidor.

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

export interface InscricaoPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function salvarInscricaoPush(inscricao: InscricaoPush): Promise<Resposta> {
  const { endpoint, keys } = inscricao;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys?.auth)
    return { ok: false, erro: "Este aparelho não aceita notificações." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_inscricao_push", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  return error ? { ok: false, erro: "Não foi possível ligar as notificações agora." } : { ok: true };
}

export async function removerInscricaoPush(endpoint: string): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.rpc("remover_inscricao_push", { p_endpoint: endpoint });
}
