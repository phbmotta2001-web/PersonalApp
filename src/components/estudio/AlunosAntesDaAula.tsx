"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { avisarFaltaNoEstudio, desfazerFaltaNoEstudio } from "@/data/aluno-estudio";
import type { AlunoNaChamada } from "@/data/estudio";
import { Aviso } from "../Formulario";

/** Antes da chamada: a lista da aula, e o professor pode avisar a falta de um aluno por ele. */
export function AlunosAntesDaAula({ aulaId, alunos }: { aulaId: string; alunos: AlunoNaChamada[] }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {alunos.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.nome}</span>
              {(a.reposicao || a.situacao === "falta_avisada") && (
                <span className={`block text-[13px] font-semibold ${a.situacao === "falta_avisada" ? "text-gold" : "text-estudio"}`}>
                  {a.situacao === "falta_avisada" ? "Vai faltar" : "Reposição"}
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  if (a.situacao === "falta_avisada") {
                    const r = await desfazerFaltaNoEstudio(aulaId, a.id);
                    setAviso(r.ok ? { tipo: "ok", texto: `${a.nome.split(" ")[0]} volta para a aula.` } : { tipo: "erro", texto: r.erro });
                  } else {
                    if (!confirm(`Avisar que ${a.nome.split(" ")[0]} vai faltar?`)) return;
                    const r = await avisarFaltaNoEstudio(aulaId, a.id);
                    setAviso(
                      r.ok
                        ? { tipo: "ok", texto: r.credito ? `Falta avisada: ${a.nome.split(" ")[0]} ganhou uma reposição.` : "Falta avisada (fora do prazo: sem reposição)." }
                        : { tipo: "erro", texto: r.erro },
                    );
                  }
                  router.refresh();
                })
              }
              className={`shrink-0 text-[14px] font-semibold ${a.situacao === "falta_avisada" ? "text-brand" : "text-ink-3"}`}
            >
              {a.situacao === "falta_avisada" ? "Desfazer" : "Avisou falta"}
            </button>
          </li>
        ))}
      </ul>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
    </div>
  );
}
