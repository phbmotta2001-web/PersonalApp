"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarCobrancaPaga } from "@/data/cobrancas";
import { soltarConfete } from "@/lib/confete";
import { centavosParaCampo } from "@/lib/matricula";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

/**
 * "Confirmar recebimento" direto na lista do Financeiro: valor cheio, hoje, por Pix
 * (o aluno avisou que pagou pelo app). Outra forma ou outro valor: na tela da cobrança.
 */
export function ConfirmarRecebimento({ cobrancaId, valorCentavos, hoje }: { cobrancaId: string; valorCentavos: number; hoje: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        onClick={(e) => {
          const botao = e.currentTarget;
          iniciar(async () => {
            setErro(null);
            try {
              const r = await marcarCobrancaPaga(cobrancaId, hoje, "pix", centavosParaCampo(valorCentavos));
              if (!r.ok) return setErro(r.erro);
              soltarConfete(botao);
              router.refresh();
            } catch {
              setErro("Não foi possível confirmar agora. Confira sua internet.");
            }
          });
        }}
        className={`${ESTILO_BOTAO_PRINCIPAL} min-h-11 text-[14px]`}
      >
        {ocupado ? "Confirmando…" : "Confirmar recebimento"}
      </button>
      <Aviso>{erro}</Aviso>
    </>
  );
}
