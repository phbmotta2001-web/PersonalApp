"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { encerrarTreino, escolherTreinoDaAula, iniciarTreino } from "@/data/treino";
import { nomeDoDia } from "@/lib/expediente";

// Decisão 117: o personal começa o treino antes da hora, encerra antes do fim e troca o treino da aula.

export function IniciarTreino({ aulaId }: { aulaId: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="col-span-2 flex flex-col gap-1">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await iniciarTreino(aulaId);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          })
        }
        className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-lime text-[15px] font-extrabold text-lime-ink disabled:opacity-60"
      >
        ▶ {pendente ? "Começando…" : "Iniciar treino agora"}
      </button>
      {erro && <p className="text-[14px] font-semibold text-on-deep">{erro}</p>}
    </div>
  );
}

export function EncerrarTreino({ aulaId }: { aulaId: string }) {
  const router = useRouter();
  const [pendente, encerrar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          if (!window.confirm("Encerrar o treino agora? O painel da aula sai do Início.")) return;
          encerrar(async () => {
            const r = await encerrarTreino(aulaId);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          });
        }}
        className="flex min-h-12 items-center justify-center rounded-[14px] border border-on-deep/30 text-[15px] font-bold disabled:opacity-60"
      >
        {pendente ? "Encerrando…" : "Encerrar treino"}
      </button>
      {erro && <p className="text-[14px] font-semibold">{erro}</p>}
    </div>
  );
}

/** Troca o treino da aula pelo de outro dia da semana. O padrão é o do dia da aula. */
export function TrocarTreino({ aulaId, dias, escolhido, padrao }: { aulaId: string; dias: { dia: number; foco: string | null }[]; escolhido: number; padrao: number }) {
  const router = useRouter();
  const [pendente, trocar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (dias.length < 2 && dias.some((d) => d.dia === escolhido)) return null;
  return (
    <label className="flex flex-col gap-1 text-[13.5px] font-semibold text-ink-3">
      Trocar o treino
      <select
        value={escolhido}
        disabled={pendente}
        onChange={(ev) => {
          const dia = Number(ev.target.value);
          trocar(async () => {
            const r = await escolherTreinoDaAula(aulaId, dia === padrao ? null : dia);
            if (!r.ok) return setErro(r.erro);
            setErro(null);
            router.refresh();
          });
        }}
        className="min-h-11 rounded-[12px] border border-line bg-surface px-3 text-[15px] font-semibold text-ink"
      >
        {!dias.some((d) => d.dia === escolhido) && <option value={escolhido}>{nomeDoDia(escolhido)}: sem treino</option>}
        {dias.map((d) => (
          <option key={d.dia} value={d.dia}>
            {nomeDoDia(d.dia)}
            {d.foco ? `: ${d.foco}` : ""}
            {d.dia === padrao ? " (o de hoje)" : ""}
          </option>
        ))}
      </select>
      {erro && <span className="text-bad">{erro}</span>}
    </label>
  );
}
