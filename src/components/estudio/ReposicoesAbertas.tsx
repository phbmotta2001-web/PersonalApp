"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assumirReposicao, type ReposicaoAberta } from "@/data/reposicao";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { Aviso } from "../Formulario";

/** Aulas sem professor por férias/falta: quem assumir primeiro fica com a aula. */
export function ReposicoesAbertas({ reposicoes, podeAssumir = true }: { reposicoes: ReposicaoAberta[]; podeAssumir?: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  if (reposicoes.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border-2 border-bad/40 bg-bad/5 p-4" aria-label="Reposições abertas">
      <h2 className="font-bold">
        {reposicoes.length} {reposicoes.length === 1 ? "aula precisa" : "aulas precisam"} de reposição
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {reposicoes.map((r) => (
          <li key={r.aulaId} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 text-[14px]">
              <b className="block truncate">
                {dataCurta(emBrasilia(r.inicio).data)} · {emBrasilia(r.inicio).hora}–{emBrasilia(r.fim).hora} · {r.tipo === "turno" ? "Turno" : "Turma"}{" "}
                {r.modalidade}
              </b>
              <span className="text-ink-3">
                No lugar de {r.ausente.split(" ")[0]} · {centavosParaReais(r.valor)}
              </span>
            </span>
            {podeAssumir && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    const x = await assumirReposicao(r.aulaId);
                    if (!x.ok) setErro(x.erro);
                    router.refresh();
                  })
                }
                className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-[14px] font-bold text-brand-ink"
              >
                Assumir
              </button>
            )}
          </li>
        ))}
      </ul>
      <Aviso>{erro}</Aviso>
    </section>
  );
}
