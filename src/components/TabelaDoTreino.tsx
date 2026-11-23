import { rotuloDescanso, textoDaCarga, type Exercicio } from "@/lib/treino";

/** Decisão 114: os exercícios de um dia, só para ler (séries, repetições, carga e descanso). */
export function TabelaDoTreino({ exercicios }: { exercicios: Exercicio[] }) {
  return (
    <ol className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
      {exercicios.map((e, i) => (
        <li key={e.id ?? i} className="flex items-start gap-3 py-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-2">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">{e.nome}</span>
            <span className="mt-1 grid grid-cols-3 gap-1.5 text-[13px]">
              <Dado rotulo={e.medida === "segundos" ? "Séries × seg." : "Séries × rep."}>
                {e.series && e.repeticoes ? `${e.series} × ${e.repeticoes}` : e.series ? `${e.series}` : e.repeticoes || "—"}
              </Dado>
              <Dado rotulo="Carga">{textoDaCarga(e.cargaKg, e.unidade) || "—"}</Dado>
              <Dado rotulo="Descanso">{rotuloDescanso(e.descansoSeg) || "—"}</Dado>
            </span>
            {e.obs && <span className="mt-1.5 block text-[13.5px] text-ink-2">{e.obs}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col rounded-[10px] bg-surface-2 px-2 py-1.5">
      <span className="text-ink-3">{rotulo}</span>
      <b className="text-[14.5px] tabular-nums">{children}</b>
    </span>
  );
}
