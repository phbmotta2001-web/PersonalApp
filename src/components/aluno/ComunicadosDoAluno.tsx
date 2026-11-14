"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarComunicadoLido, type ComunicadoDoAluno } from "@/data/comunicados";
import { dataCurta, emBrasilia } from "@/lib/expediente";

/** Decisão 102: recados da coordenação no Início do aluno, até ele tocar em "Ok, entendi". */
export function ComunicadosDoAluno({ lista }: { lista: ComunicadoDoAluno[] }) {
  const router = useRouter();
  const [lidos, setLidos] = useState<Set<string>>(new Set());
  const [, iniciar] = useTransition();
  const visiveis = lista.filter((c) => !lidos.has(c.id));
  if (visiveis.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {visiveis.map((c) => (
        <section key={c.id} className="flex flex-col gap-2 rounded-[20px] border border-estudio/40 bg-estudio-soft/50 p-4" aria-label={`Recado do ${c.estudio}`}>
          <p className="text-[13px] font-bold text-estudio">
            Recado do {c.estudio} · {dataCurta(emBrasilia(c.criadoEm).data)}
          </p>
          <p className="text-[15px] whitespace-pre-line">{c.texto}</p>
          <button
            type="button"
            onClick={() => {
              setLidos(new Set([...lidos, c.id]));
              iniciar(async () => {
                await marcarComunicadoLido(c.id);
                router.refresh();
              });
            }}
            className="self-start text-[14px] font-bold text-estudio"
          >
            Ok, entendi
          </button>
        </section>
      ))}
    </div>
  );
}
