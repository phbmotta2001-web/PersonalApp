"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { marcarPresenca, type AulaParaChamada } from "@/data/estudio";
import { emBrasilia } from "@/lib/expediente";
import { Aviso } from "../Formulario";

type Marca = "presente" | "falta";

/**
 * Decisão 87: durante a aula, no Início do professor, uma caixa grande com os alunos da turma e
 * os botões de presença e falta. Cada toque já grava; quem ficar sem marca recebe presença no fim.
 */
export function AulaEmAndamento({ aula }: { aula: AulaParaChamada }) {
  const [marcas, setMarcas] = useState<Record<string, Marca | undefined>>(() =>
    Object.fromEntries(aula.alunos.map((a) => [a.id, a.situacao === "presente" || a.situacao === "falta" ? a.situacao : undefined])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const marcar = (alunoId: string, situacao: Marca) => {
    const antes = marcas[alunoId];
    setErro(null);
    setMarcas((m) => ({ ...m, [alunoId]: situacao }));
    iniciar(async () => {
      const r = await marcarPresenca(aula.id, alunoId, situacao);
      if (!r.ok) {
        setErro(r.erro);
        setMarcas((m) => ({ ...m, [alunoId]: antes }));
      }
    });
  };

  const presentes = Object.values(marcas).filter((m) => m === "presente").length;
  return (
    <section className="flex flex-col gap-3 rounded-[24px] bg-estudio p-5 text-white" aria-label="Aula em andamento">
      <div className="flex items-center gap-2">
        <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
        <span className="text-[15px] font-extrabold tracking-[0.06em] uppercase">Aula em andamento</span>
      </div>
      <p className="font-display text-[22px] leading-tight font-extrabold">
        {aula.modalidade} · {emBrasilia(aula.inicio).hora} às {emBrasilia(aula.fim).hora}
      </p>
      <p className="-mt-2 text-[14px] opacity-85">
        {aula.estudioNome} · {presentes} de {aula.alunos.length} presente{aula.alunos.length === 1 ? "" : "s"}
      </p>

      {aula.alunos.length === 0 ? (
        <p className="rounded-[18px] bg-white p-3.5 text-ink-2">Nenhum aluno nesta turma.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[18px] bg-white px-3.5 text-ink">
          {aula.alunos.map((a) => {
            const m = marcas[a.id];
            return (
              <li key={a.id} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[16px] font-semibold ${m === "falta" ? "text-ink-3 line-through" : a.experimental ? "text-info" : ""}`}>{a.nome}</span>
                  {a.situacao === "falta_avisada" && m === undefined && <span className="block text-[13px] font-semibold text-gold">Avisou que ia faltar</span>}
                  {a.reposicao && <span className="block text-[13px] font-semibold text-estudio">Reposição</span>}
                  {a.experimental && <span className="block text-[13px] font-semibold text-info">Aula experimental</span>}
                </span>
                <button
                  type="button"
                  aria-pressed={m === "presente"}
                  aria-label={`${a.nome}: presente`}
                  onClick={() => marcar(a.id, "presente")}
                  className={`flex h-11 items-center gap-1 rounded-[12px] border px-2.5 text-[14px] font-bold ${
                    m === "presente" ? "border-transparent bg-ok text-white" : "border-line text-ink-2"
                  }`}
                >
                  <span aria-hidden="true">✓</span> Presente
                </button>
                <button
                  type="button"
                  aria-pressed={m === "falta"}
                  aria-label={`${a.nome}: falta`}
                  onClick={() => marcar(a.id, "falta")}
                  className={`flex h-11 items-center gap-1 rounded-[12px] border px-2.5 text-[14px] font-bold ${
                    m === "falta" ? "border-transparent bg-bad text-white" : "border-line text-ink-2"
                  }`}
                >
                  <span aria-hidden="true">✕</span> Falta
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {erro && (
        <div className="rounded-[14px] bg-white p-2">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <p className="text-[13px] opacity-85">
        Cada toque já fica salvo. Quem ficar sem marca recebe presença no fim da aula.{" "}
        <Link href={`/agenda/turma/${aula.id}`} className="font-bold underline">
          Abrir a chamada
        </Link>
      </p>
    </section>
  );
}
