"use client";

import { useEffect, useState, useTransition } from "react";
import { reenviarConfirmacao } from "@/data/conta";

// Decisão 119: o e-mail de confirmação às vezes não chega (o Hotmail costuma segurar). Botão para
// mandar de novo, com espera de 1 minuto entre os pedidos (limite do Supabase).
export function ReenviarEmail({ email, voltar }: { email: string; voltar?: string }) {
  const [pendente, enviar] = useTransition();
  const [espera, setEspera] = useState(0);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pendente || espera > 0 || !email}
        onClick={() =>
          enviar(async () => {
            const r = await reenviarConfirmacao(email, voltar);
            setAviso(r.ok ? { ok: true, texto: "Enviamos de novo. Pode levar alguns minutos para chegar." } : { ok: false, texto: r.erro });
            setEspera(60);
          })
        }
        className="botao-macio-claro flex min-h-12 w-full items-center justify-center rounded-[14px] border border-line bg-surface px-4 text-[15px] font-bold disabled:opacity-60"
      >
        {pendente ? "Enviando…" : espera > 0 ? `Reenviar e-mail (${espera} s)` : "Reenviar e-mail"}
      </button>
      {aviso && <p className={`text-[14px] font-semibold ${aviso.ok ? "text-ok" : "text-bad"}`}>{aviso.texto}</p>}
    </div>
  );
}
