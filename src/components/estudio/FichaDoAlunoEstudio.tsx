"use client";

import { useEffect, useState, useTransition } from "react";
import { fichaDoAlunoEstudio, salvarAnotacoesDoAluno, salvarTreinoDoAluno, type FichaDoAlunoEstudio as Ficha } from "@/data/estudio";
import { EditorDeTreino } from "../EditorDeTreino";
import { RespostasDoAluno } from "./RespostasDoAluno";
import { Aviso } from "../Formulario";

const NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" } as const;
const CAIXA = "flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-3";
const TITULO = "text-[12.5px] font-extrabold tracking-[0.05em] text-ink-3 uppercase";

/**
 * Ficha do aluno do estúdio (decisões 73 e 74): limitações e objetivos (os do perfil do aluno no
 * P-Bell e as anotações da equipe) e, opcional, o treino de cada dia da semana, escrito pelo professor.
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

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <Caixa
        alunoId={alunoId}
        campo="limitacoes"
        titulo="Limitações"
        doAluno={ficha.restricoes ?? (ficha.semRestricoes ? "Declarou que não tem limitações." : null)}
        comApp={ficha.comApp}
        inicial={ficha.limitacoesEstudio}
        exemplo="Ex.: relatou dor no ombro direito em 12/11"
      />
      <Caixa
        alunoId={alunoId}
        campo="objetivos"
        titulo="Objetivos"
        doAluno={ficha.objetivo ? `${ficha.objetivo}${ficha.nivel ? ` · nível ${NIVEL[ficha.nivel].toLowerCase()}` : ""}` : null}
        comApp={ficha.comApp}
        inicial={ficha.objetivosEstudio}
        exemplo="Ex.: quer correr uma meia maratona em abril"
      />
      <TreinoDaSemana alunoId={alunoId} ficha={ficha} />
      <RespostasDoAluno alunoId={alunoId} />
    </div>
  );
}

/**
 * Limitações ou objetivos (decisão 74): o que o aluno escreveu no perfil (só leitura) e as anotações
 * da equipe do estúdio, que ficam só no estúdio.
 */
function Caixa({
  alunoId,
  campo,
  titulo,
  doAluno,
  comApp,
  inicial,
  exemplo,
}: {
  alunoId: string;
  campo: "limitacoes" | "objetivos";
  titulo: string;
  doAluno: string | null;
  comApp: boolean;
  inicial: string;
  exemplo: string;
}) {
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className={CAIXA} aria-label={titulo}>
      <h3 className={TITULO}>{titulo}</h3>
      {doAluno ? (
        <p className="text-[14.5px] whitespace-pre-line">
          <span className="block text-[12.5px] font-semibold text-ink-3">Do perfil do aluno</span>
          {doAluno}
        </p>
      ) : (
        <p className="text-[13px] text-ink-3">{comApp ? "O aluno ainda não preencheu no perfil." : "Sem app: anote aqui o que o aluno contar."}</p>
      )}
      <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-ink-3">
        Anotações do estúdio
        <textarea
          rows={2}
          maxLength={500}
          value={texto}
          onChange={(e) => {
            setAviso(null);
            setTexto(e.target.value);
          }}
          placeholder={exemplo}
          className="rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none focus:border-brand"
        />
      </label>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      {texto !== salvo && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarAnotacoesDoAluno(alunoId, campo, texto);
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              setSalvo(texto.trim());
              setTexto(texto.trim());
              setAviso({ tipo: "ok", texto: "Salvo. O perfil do aluno não muda." });
            })
          }
          className="min-h-[40px] self-start rounded-[12px] bg-brand px-4 text-[14.5px] font-bold text-brand-ink"
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
      )}
    </section>
  );
}

function TreinoDaSemana({ alunoId, ficha }: { alunoId: string; ficha: Ficha }) {
  return (
    <section className={CAIXA + " sm:col-span-2"} aria-label="Treino de cada dia">
      <h3 className={TITULO}>
        Treino de cada dia <span className="font-semibold tracking-normal normal-case">(opcional, o aluno vê no app)</span>
      </h3>
      <EditorDeTreino
        dias={ficha.dias}
        inicial={ficha.treino}
        salvar={(dia, texto) => salvarTreinoDoAluno(alunoId, dia, texto)}
        maximo={300}
        semDias="Coloque o aluno numa turma para escrever o treino de cada dia."
      />
    </section>
  );
}
