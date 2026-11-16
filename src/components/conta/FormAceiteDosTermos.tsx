"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceitarTermos } from "@/data/termos";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { AceiteDosTermos } from "./AceiteDosTermos";

/** Decisão 109: quem já tinha conta marca a caixa dos termos antes de seguir. */
export function FormAceiteDosTermos({ profissional, voltar }: { profissional: boolean; voltar: string }) {
  const router = useRouter();
  const [aceite, setAceite] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <AceiteDosTermos marcado={aceite} mudar={setAceite} profissional={profissional} faltou={tentou && !aceite} />
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => {
          setTentou(true);
          if (!aceite) return;
          iniciar(async () => {
            const r = await aceitarTermos();
            if (!r.ok) return setErro(r.erro);
            router.replace(voltar);
            router.refresh();
          });
        }}
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Salvando…" : "Continuar"}
      </button>
    </div>
  );
}
