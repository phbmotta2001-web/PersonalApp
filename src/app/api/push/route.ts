import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { configSupabase } from "@/lib/supabase/config";

// Envio das notificações (etapa 4b). Quem chama é o próprio banco, a cada minuto,
// com a senha PUSH_SEGREDO (a mesma guardada em public.push_config). O site busca a
// fila com essa senha, envia pelo serviço de push de cada celular e devolve o resultado.
// A chave privada do push (VAPID_PRIVATE_KEY) fica só aqui, nas configurações do site.

type Pendente = {
  notificacao_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  titulo: string;
  corpo: string;
  url: string;
};

const mesmaSenha = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(request: Request) {
  const segredo = process.env.PUSH_SEGREDO;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!segredo || !publica || !privada) return new Response("Notificações não configuradas.", { status: 503 });
  if (!mesmaSenha(request.headers.get("x-pienel-segredo") ?? "", segredo))
    return new Response("Acesso negado.", { status: 401 });

  const { url, chave } = configSupabase();
  const supabase = createClient(url, chave, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("push_pendentes", { p_segredo: segredo, p_limite: 200 });
  if (error) return new Response("Não foi possível ler a fila.", { status: 500 });

  webpush.setVapidDetails(new URL(request.url).origin, publica, privada);
  const pendentes = (data ?? []) as Pendente[];
  const mortos: string[] = [];
  await Promise.all(
    pendentes.map(async (p) => {
      try {
        await webpush.sendNotification(
          { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
          JSON.stringify({ titulo: p.titulo, corpo: p.corpo, url: p.url }),
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
      } catch (e) {
        // 404/410: o aparelho cancelou a inscrição (app removido, permissão retirada).
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) mortos.push(p.endpoint);
      }
    }),
  );

  await supabase.rpc("push_resultado", {
    p_segredo: segredo,
    p_enviadas: [...new Set(pendentes.map((p) => p.notificacao_id))],
    p_aparelhos_mortos: mortos,
  });
  return Response.json({ enviadas: pendentes.length, aparelhos_removidos: mortos.length });
}
