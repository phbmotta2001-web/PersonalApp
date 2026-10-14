"use client";

import { useRouter } from "next/navigation";
import { Icone } from "./Icone";

/**
 * Volta para a tela anterior. Se a pessoa abriu o link direto (sem tela anterior
 * no app), vai para o endereço reserva.
 */
export function BotaoVoltar({ reserva, className = "" }: { reserva: string; className?: string }) {
  const router = useRouter();

  function voltar() {
    if (window.history.length > 1) router.back();
    else router.push(reserva);
  }

  return (
    <button
      type="button"
      onClick={voltar}
      aria-label="Voltar"
      className={`grid size-11 shrink-0 place-items-center rounded-full ${className}`}
    >
      <Icone nome="voltar" />
    </button>
  );
}
