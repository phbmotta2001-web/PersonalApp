"use client";

import { useEffect, useState } from "react";
import { formulariosDoAluno, type RespostaDeFormulario } from "@/data/formularios-estudio";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { textoDaResposta, type Pergunta, type Respostas } from "@/lib/questionario";

/** Perguntas e respostas de um formulário. No ParQ, "Sim" fica em vermelho. */
export function RespostasDoFormulario({ perguntas, respostas, parq }: { perguntas: Pergunta[]; respostas: Respostas | null; parq: boolean }) {
  return (
    <dl className="flex flex-col gap-2">
      {perguntas.map((q) => {
        const v = respostas?.[q.id];
        const alerta = parq && q.tipo === "sim_nao" && q.id !== "declaracao" && v === true;
        return (
          <div key={q.id}>
            <dt className="text-[13px] text-ink-3">{q.texto}</dt>
            <dd className={`text-[15px] font-semibold whitespace-pre-line ${alerta ? "text-bad" : ""}`}>{textoDaResposta(q, v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Decisão 97: os formulários do aluno (ParQ, anamnese, pesquisas), na ficha e na chamada da
 * experimental. Quem não pode ver (professor que não dá aula para o aluno) não vê nada.
 */
export function RespostasDoAluno({ alunoId }: { alunoId: string }) {
  const [lista, setLista] = useState<RespostaDeFormulario[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    formulariosDoAluno(alunoId).then((r) => {
      if (vivo) setLista(r.ok ? r.lista : []);
    });
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  if (!lista || lista.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3 sm:col-span-2">
      <p className="text-[12.5px] font-extrabold tracking-[0.05em] text-ink-3 uppercase">Formulários</p>
      <ul className="flex flex-col divide-y divide-line">
        {lista.map((f) => {
          const simNoParq =
            f.tipo === "parq" && f.perguntas.some((q) => q.tipo === "sim_nao" && q.id !== "declaracao" && f.respostas?.[q.id] === true);
          return (
            <li key={f.id} className="py-2">
              <button
                type="button"
                disabled={!f.respondidoEm}
                onClick={() => setAberto(aberto === f.id ? null : f.id)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1 font-bold">{f.titulo}</span>
                <span className={`text-[13px] font-semibold ${!f.respondidoEm ? "text-gold" : simNoParq ? "text-bad" : "text-ink-3"}`}>
                  {!f.respondidoEm ? "Não respondeu" : simNoParq ? `"Sim" no ParQ · ${dataCurta(emBrasilia(f.respondidoEm).data)}` : dataCurta(emBrasilia(f.respondidoEm).data)}
                </span>
                {f.respondidoEm && <span className="text-ink-3">{aberto === f.id ? "▴" : "▾"}</span>}
              </button>
              {aberto === f.id && (
                <div className="pt-2">
                  <RespostasDoFormulario perguntas={f.perguntas} respostas={f.respostas} parq={f.tipo === "parq"} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
