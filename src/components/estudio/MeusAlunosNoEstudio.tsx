"use client";

import { useState } from "react";
import { FichaDoAlunoEstudio } from "./FichaDoAlunoEstudio";

/**
 * "Seus alunos no estúdio" do professor: em ordem alfabética, com quantas aulas por semana o aluno
 * faz e quantas são com o professor ("3x" se todas; "3/4x" se 3 de 4). Toque no nome abre a ficha.
 */
export function MeusAlunosNoEstudio({ alunos }: { alunos: { id: string; nome: string; comigo: number; total: number }[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Seus alunos no estúdio">
      <h2 className="pb-1 text-[16px] font-semibold">Seus alunos no estúdio</h2>
      {alunos.length === 0 ? (
        <p className="text-[14.5px] text-ink-3">Sem alunos ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {alunos.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-2">
              <button
                type="button"
                aria-expanded={aberto === a.id}
                onClick={() => setAberto(aberto === a.id ? null : a.id)}
                className="flex min-h-9 items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold">{a.nome}</span>
                <span className="text-[14px] font-bold text-estudio tabular-nums">
                  {a.comigo === a.total ? `${a.total}x` : `${a.comigo}/${a.total}x`}
                </span>
                <span className="text-ink-3" aria-hidden="true">
                  {aberto === a.id ? "▴" : "▾"}
                </span>
              </button>
              {aberto === a.id && <FichaDoAlunoEstudio alunoId={a.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
