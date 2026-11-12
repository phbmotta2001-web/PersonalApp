"use client";

import { DIAS } from "@/lib/expediente";

/** Vários dias da semana de uma vez (seg a dom), para criar o mesmo horário em todos. */
export function EscolhaDeDias({
  valor,
  mudar,
  abertos,
}: {
  valor: number[];
  mudar: (dias: number[]) => void;
  /** Dias em que o estúdio abre (os outros ficam apagados); vazio: todos. */
  abertos?: number[];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Dias {valor.length > 1 && <span className="font-semibold text-ink-3">· {valor.length} dias</span>}</legend>
      <div className="flex flex-wrap gap-1.5">
        {DIAS.map((d) => {
          const marcado = valor.includes(d.valor);
          const fechado = abertos && abertos.length > 0 && !abertos.includes(d.valor);
          return (
            <button
              key={d.valor}
              type="button"
              aria-pressed={marcado}
              disabled={fechado && !marcado}
              onClick={() => mudar(marcado ? valor.filter((x) => x !== d.valor) : [...valor, d.valor])}
              className={`min-h-[40px] min-w-[48px] rounded-full border px-3 text-[14.5px] font-semibold disabled:opacity-35 ${
                marcado ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"
              }`}
            >
              {d.curto}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
