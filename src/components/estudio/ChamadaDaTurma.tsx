"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fazerChamada, type AlunoNaChamada } from "@/data/estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

type Marca = "presente" | "falta";

/** Chamada da turma: presente (✓) ou falta (✕) para cada aluno. Falta avisada já vem marcada. */
export function ChamadaDaTurma({ aulaId, alunos, feita }: { aulaId: string; alunos: AlunoNaChamada[]; feita: boolean }) {
  const router = useRouter();
  const [marcas, setMarcas] = useState<Record<string, Marca | undefined>>(() =>
    Object.fromEntries(alunos.filter((a) => a.situacao === "presente" || a.situacao === "falta").map((a) => [a.id, a.situacao as Marca])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const avisadas = new Set(alunos.filter((a) => a.situacao === "falta_avisada").map((a) => a.id));
  const faltam = alunos.filter((a) => !avisadas.has(a.id) && !marcas[a.id]).length;

  const marcar = (id: string, m: Marca) => {
    setSalvo(false);
    setMarcas((atual) => ({ ...atual, [id]: atual[id] === m ? undefined : m }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setSalvo(false);
            setMarcas(Object.fromEntries(alunos.filter((a) => !avisadas.has(a.id)).map((a) => [a.id, "presente" as Marca])));
          }}
          className="rounded-[12px] border border-line bg-surface px-3 py-2 text-[14px] font-bold"
        >
          Todos presentes
        </button>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {alunos.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{a.nome}</span>
              {avisadas.has(a.id) && <span className="block text-[13px] font-semibold text-gold">Avisou que ia faltar</span>}
            </span>
            {!avisadas.has(a.id) && (
              <span className="flex gap-1.5">
                {(["presente", "falta"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={marcas[a.id] === m}
                    aria-label={`${a.nome}: ${m}`}
                    onClick={() => marcar(a.id, m)}
                    className={`grid size-11 place-items-center rounded-[12px] border text-[18px] font-extrabold ${
                      marcas[a.id] === m
                        ? m === "presente"
                          ? "border-transparent bg-ok-soft text-ok"
                          : "border-transparent bg-bad/10 text-bad"
                        : "border-line text-ink-3"
                    }`}
                  >
                    {m === "presente" ? "✓" : "✕"}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      <Aviso tipo={salvo ? "ok" : "erro"}>{salvo ? "Chamada salva." : erro}</Aviso>
      <button
        type="button"
        disabled={ocupado || alunos.length === 0}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const lista = Object.entries(marcas)
              .filter((par): par is [string, Marca] => par[1] !== undefined)
              .map(([aluno, situacao]) => ({ aluno, situacao }));
            const r = await fazerChamada(aulaId, lista);
            if (!r.ok) return setErro(r.erro);
            setSalvo(true);
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Salvando…" : feita ? "Salvar correção" : faltam > 0 ? `Concluir chamada (${faltam} sem marcar)` : "Concluir chamada"}
      </button>
    </div>
  );
}
