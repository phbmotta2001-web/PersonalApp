"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceitarConvite } from "@/data/convites";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

/** Aviso do que o personal vai ver + botão "Aceitar convite". */
export function AceitarConvite({ codigo, personal }: { codigo: string; personal: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const primeiro = personal.split(" ")[0];

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
        Ao aceitar, {primeiro} poderá ver seu cadastro completo: objetivo, nível, restrições, peso,
        altura, medidas, endereço e WhatsApp. Nunca seu e-mail nem sua data de nascimento (só a idade).
        Você pode encerrar o vínculo quando quiser.
      </p>
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await aceitarConvite(codigo);
            if (!r.ok) return setErro(r.erro);
            router.replace("/aluno");
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Aceitando…" : `Aceitar convite de ${primeiro}`}
      </button>
    </div>
  );
}
