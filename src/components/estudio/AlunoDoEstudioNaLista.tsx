"use client";

import { useState } from "react";
import { FichaDoAlunoEstudio } from "./FichaDoAlunoEstudio";

/** Aluno do estúdio na lista do professor: toque no nome para abrir a ficha (decisão 73). */
export function AlunoDoEstudioNaLista({ id, nome, turmas }: { id: string; nome: string; turmas: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <li className={`flex flex-col gap-2 ${aberto ? "my-1.5 rounded-[16px] border-2 border-estudio bg-surface-2 p-3" : "py-2.5"}`}>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex items-center gap-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-estudio text-[14px] font-extrabold text-white">
          {nome.trim()[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{nome}</span>
          <span className="block truncate text-[14px] text-estudio">Turma {turmas}</span>
        </span>
        <span className="text-ink-3" aria-hidden="true">
          {aberto ? "▴" : "▾"}
        </span>
      </button>
      {aberto && (
        <>
          <FichaDoAlunoEstudio alunoId={id} />
          <button type="button" onClick={() => setAberto(false)} className="self-center pt-1 text-[14px] font-bold text-estudio">
            Fechar a ficha de {nome.split(" ")[0]} ▴
          </button>
        </>
      )}
    </li>
  );
}
