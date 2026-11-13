"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { entrarNaTurma, sairDaFila, type FilaDoAluno } from "@/data/aluno-estudio";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { Aviso } from "../Formulario";

/**
 * Decisão 94: no Início do aluno, cada fila de espera aparece grande, com a posição e
 * "Sair da fila". Quando é a vez dele, "Entrar na turma" com o prazo de 24 h.
 */
export function FilaDeEspera({ lista }: { lista: FilaDoAluno[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const agir = (fazer: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      setErro(null);
      const r = await fazer();
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3" aria-label="Lista de espera">
      {lista.map((f) => {
        const vez = f.situacao === "oferecida";
        return (
          <div key={f.turmaId} className={`flex flex-col gap-3 rounded-[22px] border-2 p-4 ${vez ? "border-brand bg-brand-soft" : "border-info bg-info-soft"}`}>
            <div>
              <p className={`text-[13px] font-bold tracking-wide uppercase ${vez ? "text-brand" : "text-info"}`}>
                {vez ? "Abriu vaga para você" : "Lista de espera"}
              </p>
              <p className="font-display text-[22px] leading-tight font-extrabold">{f.turma}</p>
              <p className="text-[14.5px] text-ink-2">
                {f.estudio}
                {f.trocar && ` · no lugar da de ${f.trocar}`}
              </p>
              <p className="mt-1 text-[14.5px] font-semibold">
                {vez
                  ? f.expiraEm
                    ? `Entre até ${dataCurta(emBrasilia(f.expiraEm).data)} às ${emBrasilia(f.expiraEm).hora}. Depois, a vaga vai para o próximo.`
                    : "Entre na turma antes que a vaga vá para o próximo."
                  : `Você é o ${f.posicao}º da fila. Quando abrir vaga, você é avisado.`}
              </p>
            </div>
            <div className="flex gap-2">
              {vez && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => agir(() => entrarNaTurma(f.turmaId))}
                  className="min-h-[48px] flex-1 rounded-[13px] bg-brand px-4 font-bold text-brand-ink"
                >
                  Entrar na turma
                </button>
              )}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  if (confirm(`Sair da lista de espera de ${f.turma}?`)) agir(() => sairDaFila(f.turmaId));
                }}
                className="min-h-[48px] flex-1 rounded-[13px] border border-line bg-surface px-4 font-bold text-bad"
              >
                Sair da fila
              </button>
            </div>
            {!vez && (
              <Link href={`/aluno/estudio/${f.estudioId}`} className="text-[14px] font-bold text-info">
                Ver a agenda do estúdio ›
              </Link>
            )}
          </div>
        );
      })}
      <Aviso>{erro}</Aviso>
    </section>
  );
}
