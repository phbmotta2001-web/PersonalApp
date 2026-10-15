import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

// Roda antes de cada página: renova o login do Supabase quando ele está perto de
// vencer e grava o cookie novo. Não decide quem pode ver o quê — isso é feito nas
// telas, nas ações do servidor e nas regras do próprio banco.
export async function proxy(request: NextRequest) {
  const { url, chave } = configSupabase();
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista, cabecalhos) {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
        for (const [nome, valor] of Object.entries(cabecalhos ?? {})) resposta.headers.set(nome, valor);
      },
    },
  });

  await supabase.auth.getClaims();
  return resposta;
}

export const config = {
  // Não precisa rodar para arquivos estáticos (imagens, ícones, código do Next.js).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
