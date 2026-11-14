"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fazerChamada, type AlunoNaChamada } from "@/data/estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { RespostasDoAluno } from "./RespostasDoAluno";

/**
 * Chamada da turma: presença (✓) ou falta (✕) para cada aluno. Quem não for marcado recebe
 * presença. Falta avisada pelo aluno já vem marcada.
 */
export function ChamadaDaTurma({ aulaId, alunos, feita }: { aulaId: string; alunos: AlunoNaChamada[]; feita: boolean }) {
  const router = useRouter();
  const avisadas = new Set(alunos.filter((a) => a.situacao === "falta_avisada").map((a) => a.id));
  const [faltas, setFaltas] = useState<Set<string>>(() => new Set(alunos.filter((a) => a.situacao === "falta").map((a) => a.id)));
  const [confirmados, setConfirmados] = useState<Set<string>>(() => new Set(alunos.filter((a) => a.situacao === "presente").map((a) => a.id)));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  // Decisão 97: o professor vê o ParQ e a anamnese de quem vem fazer experimental.
  const [verFicha, setVerFicha] = useState<string | null>(null);
  const marcaveis = alunos.filter((a) => !avisadas.has(a.id));
  const presentes = marcaveis.filter((a) => !faltas.has(a.id)).length;

  const marcar = (id: string, situacao: "presente" | "falta") => {
    setSalvo(false);
    const tira = (s: Set<string>) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    };
    const poe = (s: Set<string>) => new Set(s).add(id);
    if (situacao === "falta") {
      setFaltas(faltas.has(id) ? tira(faltas) : poe(faltas));
      setConfirmados(tira(confirmados));
    } else {
      setConfirmados(confirmados.has(id) ? tira(confirmados) : poe(confirmados));
      setFaltas(tira(faltas));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-3">Quem você não marcar fica com presença.</p>
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {alunos.map((a) => {
          const faltou = faltas.has(a.id);
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[16px] font-semibold ${faltou ? "text-ink-3 line-through" : a.experimental ? "text-info" : ""}`}>{a.nome}</span>
                {avisadas.has(a.id) && <span className="block text-[13px] font-semibold text-gold">Avisou que ia faltar</span>}
                {a.reposicao && !avisadas.has(a.id) && <span className="block text-[13px] font-semibold text-estudio">Reposição</span>}
                {a.experimental && (
                  <button type="button" onClick={() => setVerFicha(verFicha === a.id ? null : a.id)} className="block text-left text-[13px] font-semibold text-info">
                    Aula experimental · {verFicha === a.id ? "fechar" : "ver ParQ e anamnese"}
                  </button>
                )}
              </span>
              {!avisadas.has(a.id) && (
                <button
                  type="button"
                  aria-pressed={confirmados.has(a.id)}
                  aria-label={`${a.nome}: presente`}
                  onClick={() => marcar(a.id, "presente")}
                  className={`flex h-11 items-center gap-1.5 rounded-[12px] border px-3 text-[15px] font-bold ${
                    confirmados.has(a.id) ? "border-transparent bg-ok/10 text-ok" : "border-line text-ink-3"
                  }`}
                >
                  <span className="text-[17px] font-extrabold" aria-hidden="true">
                    ✓
                  </span>
                  Presente
                </button>
              )}
              {!avisadas.has(a.id) && (
                <button
                  type="button"
                  aria-pressed={faltou}
                  aria-label={`${a.nome}: falta`}
                  onClick={() => marcar(a.id, "falta")}
                  className={`flex h-11 items-center gap-1.5 rounded-[12px] border px-3 text-[15px] font-bold ${
                    faltou ? "border-transparent bg-bad/10 text-bad" : "border-line text-ink-3"
                  }`}
                >
                  <span className="text-[17px] font-extrabold" aria-hidden="true">
                    ✕
                  </span>
                  Falta
                </button>
              )}
              {verFicha === a.id && (
                <div className="w-full">
                  <RespostasDoAluno alunoId={a.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Aviso tipo={salvo ? "ok" : "erro"}>{salvo ? "Chamada salva." : erro}</Aviso>
      <button
        type="button"
        disabled={ocupado || marcaveis.length === 0}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const lista = marcaveis.map((a) => ({ aluno: a.id, situacao: faltas.has(a.id) ? ("falta" as const) : ("presente" as const) }));
            const r = await fazerChamada(aulaId, lista);
            if (!r.ok) return setErro(r.erro);
            setSalvo(true);
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Salvando…" : feita ? "Salvar correção" : `Concluir chamada (${presentes} presente${presentes === 1 ? "" : "s"})`}
      </button>
    </div>
  );
}
