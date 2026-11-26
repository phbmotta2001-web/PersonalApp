"use client";

import { useState } from "react";
import { ConvidarParaOPBellNoEstudio } from "../ConvidarParaOPBell";
import { FichaDoAlunoEstudio } from "./FichaDoAlunoEstudio";

/**
 * Decisão 120: o professor vê também todos os alunos do estúdio (com busca) e abre a ficha de qualquer um.
 * "Seus alunos no estúdio" do professor: em ordem alfabética, com quantas aulas por semana o aluno
 * faz e quantas são com o professor ("3x" se todas; "3/4x" se 3 de 4). Toque no nome abre a ficha.
 */
export function MeusAlunosNoEstudio({
  alunos,
  estudio,
}: {
  alunos: { id: string; nome: string; comigo: number; total: number; whatsapp: string | null; comApp: boolean; jaUsaOApp: boolean }[];
  estudio: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const meus = alunos.filter((a) => a.comigo > 0);
  const [verTodos, setVerTodos] = useState(meus.length === 0);
  const [busca, setBusca] = useState("");
  const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const lista = (verTodos ? alunos : meus).filter((a) => !busca.trim() || semAcento(a.nome).includes(semAcento(busca.trim())));
  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1.5 text-[14px] font-semibold ${ativo ? "border-estudio bg-estudio text-white" : "border-line bg-surface text-ink-2"}`;
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Alunos do estúdio">
      <h2 className="text-[16px] font-semibold">Alunos do estúdio</h2>
      <div className="flex gap-1.5" role="group" aria-label="Quais alunos">
        <button type="button" aria-pressed={!verTodos} onClick={() => setVerTodos(false)} className={chip(!verTodos)}>
          Meus ({meus.length})
        </button>
        <button type="button" aria-pressed={verTodos} onClick={() => setVerTodos(true)} className={chip(verTodos)}>
          Todos ({alunos.length})
        </button>
      </div>
      {verTodos && alunos.length > 8 && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar aluno pelo nome"
          className="min-h-11 rounded-[12px] border border-line bg-surface px-3 text-[16px]"
        />
      )}
      {lista.length === 0 ? (
        <p className="text-[14.5px] text-ink-3">{busca.trim() ? "Nenhum aluno com esse nome." : verTodos ? "Sem alunos ainda." : "Nenhum aluno nas suas turmas ainda."}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lista.map((a) => (
            <li
              key={a.id}
              className={`flex flex-col gap-2 rounded-[16px] ${aberto === a.id ? "my-1.5 border-2 border-estudio bg-surface-2 p-3" : "border-b border-line px-1 py-2 last:border-b-0"}`}
            >
              <div className="flex items-center gap-2">
              <button
                type="button"
                aria-expanded={aberto === a.id}
                onClick={() => setAberto(aberto === a.id ? null : a.id)}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className={`min-w-0 flex-1 truncate font-semibold ${aberto === a.id ? "text-[17px] font-extrabold text-estudio" : "text-[15.5px]"}`}>{a.nome}</span>
                <span className="text-[14px] font-bold text-estudio tabular-nums">
                  {a.comigo === 0 ? (a.total ? `${a.total}x` : "") : a.comigo === a.total ? `${a.total}x` : `${a.comigo}/${a.total}x`}
                </span>
                <span className="text-ink-3" aria-hidden="true">
                  {aberto === a.id ? "▴" : "▾"}
                </span>
              </button>
              {!a.comApp && <ConvidarParaOPBellNoEstudio alunoId={a.id} nome={a.nome} whatsapp={a.whatsapp} estudio={estudio} jaUsa={a.jaUsaOApp} />}
              </div>
              {aberto === a.id && (
                <>
                  <FichaDoAlunoEstudio alunoId={a.id} />
                  <button type="button" onClick={() => setAberto(null)} className="self-center pt-1 text-[14px] font-bold text-estudio">
                    Fechar a ficha de {a.nome.split(" ")[0]} ▴
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
