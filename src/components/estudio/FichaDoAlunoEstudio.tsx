"use client";

import { useEffect, useState, useTransition } from "react";
import { fichaDoAlunoEstudio, salvarTreinoDoAluno, type FichaDoAlunoEstudio as Ficha } from "@/data/estudio";
import { DIAS } from "@/lib/expediente";
import { Aviso } from "../Formulario";

const NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" } as const;
const CAIXA = "flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3";
const TITULO = "text-[12.5px] font-extrabold tracking-[0.05em] text-ink-3 uppercase";

/**
 * Ficha do aluno do estúdio (decisão 73): limitações e objetivos (preenchidos pelo próprio aluno
 * no perfil do P-Bell) e, opcional, o treino de cada dia da semana, escrito pelo professor.
 */
export function FichaDoAlunoEstudio({ alunoId }: { alunoId: string }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fichaDoAlunoEstudio(alunoId).then((r) => {
      if (!vivo) return;
      if (r.ok) setFicha(r.ficha);
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!ficha) return <p className="text-[14px] text-ink-3">Abrindo a ficha…</p>;

  const semApp = "O aluno preenche quando entrar pelo link do estúdio.";
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <section className={CAIXA} aria-label="Limitações">
        <h3 className={TITULO}>Limitações</h3>
        <p className={`text-[14.5px] whitespace-pre-line ${ficha.restricoes ? "text-ink" : "text-ink-3"}`}>
          {ficha.restricoes ?? (ficha.semRestricoes ? "Declarou que não tem limitações." : ficha.comApp ? "O aluno ainda não preencheu." : semApp)}
        </p>
      </section>
      <section className={CAIXA} aria-label="Objetivos">
        <h3 className={TITULO}>Objetivos</h3>
        <p className={`text-[14.5px] whitespace-pre-line ${ficha.objetivo ? "text-ink" : "text-ink-3"}`}>
          {ficha.objetivo ?? (ficha.comApp ? "O aluno ainda não preencheu." : semApp)}
        </p>
        {ficha.nivel && <p className="text-[13px] text-ink-2">Nível: {NIVEL[ficha.nivel]}</p>}
      </section>
      <TreinoDaSemana alunoId={alunoId} ficha={ficha} />
    </div>
  );
}

function TreinoDaSemana({ alunoId, ficha }: { alunoId: string; ficha: Ficha }) {
  // Os dias em que ele tem turma e os que já têm treino escrito, de segunda a domingo.
  const dias = DIAS.filter((d) => ficha.dias.includes(d.valor) || ficha.treino[d.valor]);
  const [textos, setTextos] = useState<Record<number, string>>(ficha.treino);
  const [salvos, setSalvos] = useState<Record<number, string>>(ficha.treino);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const mudados = dias.filter((d) => (textos[d.valor] ?? "") !== (salvos[d.valor] ?? ""));

  return (
    <section className={CAIXA + " sm:col-span-2"} aria-label="Treino de cada dia">
      <h3 className={TITULO}>
        Treino de cada dia <span className="font-semibold tracking-normal normal-case">(opcional, o aluno vê no app)</span>
      </h3>
      {dias.length === 0 ? (
        <p className="text-[14px] text-ink-3">Coloque o aluno numa turma para escrever o treino de cada dia.</p>
      ) : (
        dias.map((d) => (
          <label key={d.valor} className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
            {d.nome}
            <textarea
              rows={2}
              maxLength={300}
              value={textos[d.valor] ?? ""}
              onChange={(e) => {
                setAviso(null);
                setTextos({ ...textos, [d.valor]: e.target.value });
              }}
              placeholder="Ex.: peito e tríceps"
              className="rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none focus:border-brand"
            />
          </label>
        ))
      )}
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      {mudados.length > 0 && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              for (const d of mudados) {
                const r = await salvarTreinoDoAluno(alunoId, d.valor, textos[d.valor] ?? "");
                if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              }
              setSalvos({ ...textos });
              setAviso({ tipo: "ok", texto: "Treino salvo." });
            })
          }
          className="min-h-[44px] self-start rounded-[12px] bg-brand px-4 font-bold text-brand-ink"
        >
          {ocupado ? "Salvando…" : "Salvar treino"}
        </button>
      )}
    </section>
  );
}
