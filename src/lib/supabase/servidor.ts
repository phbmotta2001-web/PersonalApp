import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { configSupabase } from "./config";

/**
 * Conexão com o Supabase em nome de quem está usando o site (lê o login do cookie).
 * Use só no servidor: telas do servidor, ações ("use server") e rotas.
 * O banco aplica as regras de segurança por linha (RLS) para essa pessoa.
 */
export async function criarClienteSupabase() {
  const { url, chave } = configSupabase();
  const loja = await cookies();

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) loja.set(name, value, options);
        } catch {
          // Telas do servidor não podem gravar cookies; o proxy (src/proxy.ts) renova o login.
        }
      },
    },
  });
}

/** Endereço do site (ex.: http://localhost:3000), para os links dos e-mails de confirmação. */
export async function origemDoSite(): Promise<string> {
  const h = await headers();
  const origem = h.get("origin");
  if (origem) return origem;
  const protocolo = h.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${h.get("host") ?? "localhost:3000"}`;
}

/** Quem está logado agora (ou nenhum id, se ninguém). */
export async function usuarioAtual() {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return {
    supabase,
    id: typeof claims?.sub === "string" ? claims.sub : null,
    email: typeof claims?.email === "string" ? claims.email : "",
  };
}
