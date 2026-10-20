"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirSuspensaoAutomatica } from "@/data/matriculas";
import { Aviso } from "../Formulario";

/** Liga ou desliga, para um aluno, a suspensão da matrícula quando a mensalidade vence sem pagamento. */
export function SuspensaoAutomatica({ vinculoId, ligada }: { vinculoId: string; ligada: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(ligada);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const novo = !valor;
            try {
              const r = await definirSuspensaoAutomatica(vinculoId, novo);
              if (!r.ok) return setErro(r.erro);
              setValor(novo);
              router.refresh();
            } catch {
              setErro("Não foi possível mudar agora. Confira sua internet.");
            }
          })
        }
        className="flex items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold">Suspender se não pagar</span>
          <span className="block text-xs text-ink-3">
            No dia seguinte ao vencimento, a matrícula fica suspensa até você marcar como paga.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${valor ? "bg-brand" : "bg-line"}`}
        >
          <span className={`size-5 rounded-full bg-surface shadow transition-transform ${valor ? "translate-x-4" : ""}`} />
        </span>
      </button>
      <Aviso>{erro}</Aviso>
    </div>
  );
}
