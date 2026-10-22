"use client";

import { useRouter } from "next/navigation";
import { marcarCheckinEnviado } from "@/data/questionarios";
import { Icone } from "../Icone";

/** Abre o WhatsApp com o link do questionário e marca como enviado. */
export function LinkWhatsappQuestionario({ checkinId, href, enviado }: { checkinId: string; href: string; enviado: boolean }) {
  const router = useRouter();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void marcarCheckinEnviado(checkinId).then(() => router.refresh());
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[11px] px-3 py-2 text-[14px] font-bold ${
        enviado ? "border border-line text-ink-2" : "bg-brand text-brand-ink"
      }`}
    >
      <Icone nome="conversa" className="size-4" /> {enviado ? "Reenviar" : "Enviar no WhatsApp"}
    </a>
  );
}
