"use client";

import { useEffect, useRef, useState } from "react";
import { registrarExercicio, registrosDaAula } from "@/data/treino";
import { lerNumero, resumoDoExercicio, type Exercicio, type RegistroDoExercicio } from "@/lib/treino";

// Decisão 114: durante a aula, o treino completo com um check por exercício e a carga e as
// repetições feitas de verdade. Personal e aluno marcam no mesmo treino: cada um vê o que o
// outro marcou em alguns segundos.

interface Estado {
  feito: boolean;
  carga: string;
  reps: string;
}

const numeroDasRepeticoes = (r: string | null) => {
  const m = (r ?? "").match(/\d+/);
  return m ? m[0] : "";
};
// Guarda quando a linha mudou aqui (fora do render, para o lint do React).
const marcarMudanca = (m: Map<string, number>, id: string) => m.set(id, Date.now());
const textoDaCarga = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

function estadoInicial(exercicios: Exercicio[], registros: RegistroDoExercicio[]): Record<string, Estado> {
  return Object.fromEntries(
    exercicios.map((e) => {
      const r = registros.find((x) => x.exercicioId === e.id);
      return [
        e.id!,
        {
          feito: r?.feito ?? false,
          carga: textoDaCarga(r ? r.cargaKg : e.cargaKg),
          reps: r?.repeticoes != null ? String(r.repeticoes) : numeroDasRepeticoes(e.repeticoes),
        },
      ];
    }),
  );
}

export function TreinoAoVivo({ aulaId, exercicios, registros }: { aulaId: string; exercicios: Exercicio[]; registros: RegistroDoExercicio[] }) {
  const lista = exercicios.filter((e) => e.id);
  const [estado, setEstado] = useState(() => estadoInicial(lista, registros));
  const [erro, setErro] = useState<string | null>(null);
  // Linha sendo editada: não é sobrescrita pela atualização automática.
  const editando = useRef<string | null>(null);
  // Linhas mudadas aqui há pouco: a atualização automática pode trazer o valor de antes de salvar.
  const mudouEm = useRef(new Map<string, number>());
  const feitos = lista.filter((e) => estado[e.id!]?.feito).length;

  // A cada 8 s, traz o que a outra pessoa marcou.
  useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const novos = await registrosDaAula(aulaId);
      setEstado((atual) => {
        const prox = { ...atual };
        for (const r of novos) {
          if (r.exercicioId === editando.current || !prox[r.exercicioId]) continue;
          if (Date.now() - (mudouEm.current.get(r.exercicioId) ?? 0) < 10_000) continue;
          prox[r.exercicioId] = {
            feito: r.feito,
            carga: textoDaCarga(r.cargaKg),
            reps: r.repeticoes != null ? String(r.repeticoes) : prox[r.exercicioId].reps,
          };
        }
        return prox;
      });
    }, 8_000);
    return () => window.clearInterval(t);
  }, [aulaId]);

  const salvar = async (id: string, s: Estado) => {
    const carga = lerNumero(s.carga);
    const reps = lerNumero(s.reps);
    if ((carga != null && Number.isNaN(carga)) || (reps != null && (Number.isNaN(reps) || !Number.isInteger(reps)))) {
      return setErro("Use só números na carga e nas repetições (como 40 ou 12,5).");
    }
    marcarMudanca(mudouEm.current, id);
    const r = await registrarExercicio(aulaId, id, s.feito, carga, reps);
    marcarMudanca(mudouEm.current, id);
    setErro(r.ok ? null : r.erro);
  };

  const mudar = (id: string, parte: Partial<Estado>, gravar = false) => {
    const s = { ...estado[id], ...parte };
    marcarMudanca(mudouEm.current, id);
    setEstado((atual) => ({ ...atual, [id]: s }));
    if (gravar) void salvar(id, s);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13.5px] font-semibold text-ink-3">
        {feitos} de {lista.length} feitos
      </p>
      <ol className="flex flex-col divide-y divide-line">
        {lista.map((e) => {
          const id = e.id!;
          const s = estado[id];
          return (
            <li key={id} className="flex items-start gap-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={s.feito}
                aria-label={`${e.nome}: ${s.feito ? "feito" : "a fazer"}`}
                onClick={() => mudar(id, { feito: !s.feito }, true)}
                className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px] border-2 text-[18px] font-extrabold ${
                  s.feito ? "border-ok bg-ok text-surface" : "border-line bg-surface text-transparent"
                }`}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-[17px] leading-snug font-bold ${s.feito ? "text-ink-3 line-through" : ""}`}>{e.nome}</p>
                {resumoDoExercicio(e) && <p className="text-[14px] text-ink-3">{resumoDoExercicio(e)}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                    Carga feita (kg)
                    <input
                      inputMode="decimal"
                      value={s.carga}
                      onFocus={() => (editando.current = id)}
                      onChange={(ev) => mudar(id, { carga: ev.target.value })}
                      onBlur={() => {
                        editando.current = null;
                        void salvar(id, estado[id]);
                      }}
                      className="min-h-11 rounded-[10px] border border-line bg-surface px-2.5 text-[16px] text-ink tabular-nums outline-none focus:border-brand"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                    Repetições feitas
                    <input
                      inputMode="numeric"
                      value={s.reps}
                      onFocus={() => (editando.current = id)}
                      onChange={(ev) => mudar(id, { reps: ev.target.value })}
                      onBlur={() => {
                        editando.current = null;
                        void salvar(id, estado[id]);
                      }}
                      className="min-h-11 rounded-[10px] border border-line bg-surface px-2.5 text-[16px] text-ink tabular-nums outline-none focus:border-brand"
                    />
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </div>
  );
}
