"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { criarBloqueio } from "@/data/expediente";
import { minParaHora } from "@/lib/expediente";

// Decisão 118: deixar um horário livre indisponível direto na Agenda (os alunos não conseguem marcar nele).
export function BloquearHorario({ dia, min, duracao }: { dia: string; min: number; duracao: number }) {
  const router = useRouter();
  const [pendente, bloquear] = useTransition();
  const fim = Math.min(min + duracao, 1440);
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm(`Deixar ${minParaHora(min)}–${minParaHora(fim)} indisponível? Os alunos não conseguem marcar nesse horário.`)) return;
        bloquear(async () => {
          const r = await criarBloqueio({ diaInteiro: false, dataInicio: dia, dataFim: dia, inicioMin: min, fimMin: fim, motivo: "" });
          if (!r.ok) window.alert(r.erro);
          router.refresh();
        });
      }}
      className="min-h-9 shrink-0 rounded-full px-2.5 text-[13.5px] font-semibold text-ink-3 disabled:opacity-50"
    >
      {pendente ? "…" : "bloquear"}
    </button>
  );
}
