"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { encerrarVinculo } from "@/data/convites";
import { Aviso } from "../Formulario";

/** Encerrar o vínculo (personal ou aluno), com confirmação na própria tela. */
export function EncerrarVinculo({
  vinculoId,
  aviso,
  depois,
}: {
  vinculoId: string;
  /** O que acontece ao encerrar, explicado para quem está encerrando. */
  aviso: string;
  /** Para onde ir depois de encerrar. */
  depois: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (!confirmando)
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="self-start text-[13px] font-semibold text-bad">
        Encerrar vínculo
      </button>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bad/40 bg-surface p-3.5">
      <p className="text-[13px] text-ink-2">{aviso}</p>
      <Aviso>{erro}</Aviso>
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirmando(false)} className="flex-1 rounded-[13px] border border-line px-3 py-2.5 text-[13px] font-bold">
          Manter
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await encerrarVinculo(vinculoId);
              if (!r.ok) return setErro(r.erro);
              router.replace(depois);
              router.refresh();
            })
          }
          className="flex-1 rounded-[13px] bg-bad px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {ocupado ? "Encerrando…" : "Encerrar"}
        </button>
      </div>
    </div>
  );
}
