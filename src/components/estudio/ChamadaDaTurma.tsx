"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fazerChamada, type AlunoNaChamada } from "@/data/estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

/**
 * Chamada da turma: o professor só marca a falta (✕). Quem não for marcado recebe presença.
 * Falta avisada pelo aluno já vem marcada.
 */
export function ChamadaDaTurma({ aulaId, alunos, feita }: { aulaId: string; alunos: AlunoNaChamada[]; feita: boolean }) {
  const router = useRouter();
  const avisadas = new Set(alunos.filter((a) => a.situacao === "falta_avisada").map((a) => a.id));
  const [faltas, setFaltas] = useState<Set<string>>(() => new Set(alunos.filter((a) => a.situacao === "falta").map((a) => a.id)));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const marcaveis = alunos.filter((a) => !avisadas.has(a.id));
  const presentes = marcaveis.filter((a) => !faltas.has(a.id)).length;

  const alternar = (id: string) => {
    setSalvo(false);
    setFaltas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-3">Marque só quem faltou. Os outros ficam com presença.</p>
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {alunos.map((a) => {
          const faltou = faltas.has(a.id);
          return (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[16px] font-semibold ${faltou ? "text-ink-3 line-through" : ""}`}>{a.nome}</span>
                {avisadas.has(a.id) && <span className="block text-[13px] font-semibold text-gold">Avisou que ia faltar</span>}
              </span>
              {!avisadas.has(a.id) && (
                <button
                  type="button"
                  aria-pressed={faltou}
                  aria-label={`${a.nome}: falta`}
                  onClick={() => alternar(a.id)}
                  className={`flex h-11 items-center gap-1.5 rounded-[12px] border px-3 text-[15px] font-bold ${
                    faltou ? "border-transparent bg-bad/10 text-bad" : "border-line text-ink-3"
                  }`}
                >
                  <span className="text-[17px] font-extrabold" aria-hidden="true">
                    ✕
                  </span>
                  Falta
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Aviso tipo={salvo ? "ok" : "erro"}>{salvo ? "Chamada salva." : erro}</Aviso>
      <button
        type="button"
        disabled={ocupado || marcaveis.length === 0}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const lista = marcaveis.map((a) => ({ aluno: a.id, situacao: faltas.has(a.id) ? ("falta" as const) : ("presente" as const) }));
            const r = await fazerChamada(aulaId, lista);
            if (!r.ok) return setErro(r.erro);
            setSalvo(true);
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Salvando…" : feita ? "Salvar correção" : `Concluir chamada (${presentes} presente${presentes === 1 ? "" : "s"})`}
      </button>
    </div>
  );
}
