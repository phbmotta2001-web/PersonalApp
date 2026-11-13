"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { desistenciaExperimental, type ExperimentalConcluida } from "@/data/estudio";
import { linkWhatsapp } from "@/lib/convite";
import { curtoDoDia, dataCurta, diaDaSemana, emBrasilia } from "@/lib/expediente";
import { Aviso } from "../Formulario";

/**
 * Decisão 93: no Início da coordenação, cada aula experimental que já aconteceu aparece grande,
 * com "Cadastrar aluno", "Descartar" e "Entrar em contato".
 */
export function ExperimentaisConcluidas({ lista }: { lista: ExperimentalConcluida[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const descartar = (x: ExperimentalConcluida) => {
    if (!confirm(`Descartar ${x.nome}? Conta como desistência e o nome sai da lista.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await desistenciaExperimental(x.alunoId);
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Aulas experimentais concluídas">
      {lista.map((x) => {
        const b = emBrasilia(x.inicio);
        const primeiro = x.nome.split(" ")[0];
        const mensagem = `Olá, ${primeiro}! Aqui é do ${x.estudio}. ${
          x.faltou ? "Sentimos sua falta na aula experimental. Quer marcar outro dia?" : "Como foi sua aula experimental? Quer garantir sua vaga na turma?"
        }`;
        return (
          <div key={x.alunoId} className="flex flex-col gap-3 rounded-[22px] border-2 border-info bg-info-soft p-4">
            <div>
              <p className="text-[13px] font-bold tracking-wide text-info uppercase">Aula experimental concluída</p>
              <p className="font-display text-[24px] leading-tight font-extrabold">{x.nome}</p>
              <p className="text-[14.5px] text-ink-2">
                {x.faltou ? "Faltou à aula de " : "Fez a aula de "}
                {curtoDoDia(diaDaSemana(b.data))}, {dataCurta(b.data)} às {b.hora} · {x.estudio}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/estudio/${x.estudioId}?aba=alunos&cadastrar=${x.alunoId}`}
                className="grid min-h-[50px] place-items-center rounded-[13px] bg-brand px-4 font-bold text-brand-ink"
              >
                Cadastrar aluno
              </Link>
              <div className="flex gap-2">
                {x.whatsapp ? (
                  <a
                    href={linkWhatsapp(x.whatsapp, mensagem)}
                    target="_blank"
                    rel="noreferrer"
                    className="grid min-h-[46px] flex-1 place-items-center rounded-[13px] border border-line bg-surface px-3 font-bold text-brand"
                  >
                    Entrar em contato
                  </a>
                ) : (
                  <span className="grid min-h-[46px] flex-1 place-items-center rounded-[13px] border border-line bg-surface px-3 text-center text-[13.5px] text-ink-3">
                    Sem WhatsApp
                  </span>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => descartar(x)}
                  className="min-h-[46px] flex-1 rounded-[13px] border border-line bg-surface px-3 font-bold text-bad"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <Aviso>{erro}</Aviso>
    </section>
  );
}
