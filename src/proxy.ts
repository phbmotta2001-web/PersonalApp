import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configSupabase } from "@/lib/supabase/config";

// Roda antes de cada página: renova o login do Supabase quando ele está perto de
// vencer e grava o cookie novo. Não decide quem pode ver o quê — isso é feito nas
// telas, nas ações do servidor e nas regras do próprio banco.
// Endereço antigo do site (antes do domínio próprio): leva para o mesmo caminho no novo.
const ENDERECO_ANTIGO = "personal-app-gray-chi.vercel.app";
const ENDERECO_NOVO = "https://pbell.com.br";

export async function proxy(request: NextRequest) {
  if (request.headers.get("host") === ENDERECO_ANTIGO)
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, ENDERECO_NOVO), 308);

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

  const { data } = await supabase.auth.getClaims();

  // O app instalado abre em /inicio. O encaminhamento acontece aqui, antes de qualquer
  // tela: feito na página, a abertura começava em /inicio e recomeçava na tela de destino.
  if (request.nextUrl.pathname === "/inicio") {
    const tipo = data?.claims?.user_metadata?.tipo_conta;
    const destino = request.nextUrl.clone();
    // Conta sem o tipo guardado é de aluno (a mesma regra do cadastro no banco).
    const empresa = data?.claims?.user_metadata?.conta === "empresa";
    destino.pathname = !data?.claims ? "/entrar" : empresa ? "/estudio" : tipo === "personal" ? "/agenda" : "/aluno";
    destino.search = "";
    const redirecionar = NextResponse.redirect(destino);
    for (const cookie of resposta.cookies.getAll()) redirecionar.cookies.set(cookie);
    return redirecionar;
  }
  return resposta;
}

export const config = {
  // Não precisa rodar para arquivos estáticos (imagens, ícones, código do Next.js).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|api/push|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
