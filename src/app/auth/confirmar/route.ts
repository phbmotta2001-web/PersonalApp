import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/destino";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

// Para onde leva o link do e-mail de confirmação (cadastro ou troca de e-mail).
// Aceita os dois formatos do Supabase:
// - ?code=...                → link padrão; precisa ser aberto no MESMO navegador do cadastro
// - ?token_hash=...&type=... → funciona em qualquer navegador (exige mudar o modelo do e-mail)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const destino = destinoSeguro(url.searchParams.get("voltar"));

  const supabase = await criarClienteSupabase();
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && tipo) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;

  // Com ?code=, o Supabase já confirmou o e-mail antes de mandar a pessoa para cá: se a troca
  // falhou, quase sempre é porque o link abriu em outro navegador. Basta entrar com a senha.
  const motivo = ok ? "" : code ? "aviso=confirmado" : "erro=link";
  const retorno = ok ? destino : `/entrar?${motivo}&voltar=${encodeURIComponent(destino)}`;
  return NextResponse.redirect(new URL(retorno, url.origin));
}
