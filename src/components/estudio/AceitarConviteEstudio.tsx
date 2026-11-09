"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceitarConviteEstudio } from "@/data/estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

export function AceitarConviteEstudio({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await aceitarConviteEstudio(codigo);
            if (!r.ok) return setErro(r.erro);
            router.replace(`/agenda/estudio/${r.id}`);
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Entrando…" : "Entrar na equipe"}
      </button>
    </div>
  );
}
