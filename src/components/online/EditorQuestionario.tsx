"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { arquivarQuestionario, salvarQuestionario } from "@/data/questionarios";
import { frase } from "@/lib/formato";
import {
  LIMITE_PERGUNTAS,
  novoIdPergunta,
  problemasDoQuestionario,
  TIPOS_PERGUNTA,
  type Pergunta,
  type TipoPergunta,
} from "@/lib/questionario";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

const estiloSelect = "min-h-10 rounded-[11px] border border-line bg-surface px-2 text-sm";

/** Criar ou editar um modelo de questionário. */
export function EditorQuestionario({
  id,
  nomeInicial,
  perguntasIniciais,
}: {
  id: string | null;
  nomeInicial: string;
  perguntasIniciais: Pergunta[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(perguntasIniciais);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const problemas = problemasDoQuestionario(nome, perguntas);

  const mudar = (i: number, parte: Partial<Pergunta>) => {
    setErro(null);
    setPerguntas(perguntas.map((q, j) => (j === i ? { ...q, ...parte } : q)));
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= perguntas.length) return;
    const nova = [...perguntas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setPerguntas(nova);
  };
  const adicionar = () =>
    setPerguntas([...perguntas, { id: novoIdPergunta(), tipo: "nota", texto: "", obrigatoria: true }]);

  function salvar() {
    setTentou(true);
    if (problemas.length > 0) return;
    iniciar(async () => {
      try {
        const r = await salvarQuestionario(id, nome, perguntas);
        if (!r.ok) return setErro(r.erro);
        router.replace("/agenda/online/questionarios");
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
        <Campo id="q-nome" rotulo="Nome do questionário" ajuda="Ex.: Check-in semanal, Avaliação mensal.">
          <input id="q-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} className={ESTILO_CAIXA} />
        </Campo>

        <ol className="flex flex-col gap-3">
          {perguntas.map((q, i) => (
            <li key={q.id} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <label htmlFor={`q-tipo-${q.id}`} className="sr-only">
                  Tipo da pergunta
                </label>
                <select
                  id={`q-tipo-${q.id}`}
                  value={q.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as TipoPergunta;
                    mudar(i, { tipo, opcoes: tipo === "escolha" ? (q.opcoes?.length ? q.opcoes : ["", ""]) : undefined });
                  }}
                  className={`${estiloSelect} flex-1`}
                >
                  {TIPOS_PERGUNTA.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="grid size-9 place-items-center rounded-full text-ink-3 disabled:opacity-30">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === perguntas.length - 1}
                  aria-label="Descer"
                  className="grid size-9 place-items-center rounded-full text-ink-3 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))}
                  aria-label="Remover pergunta"
                  className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                >
                  <Icone nome="fechar" className="size-4" />
                </button>
              </div>
              <label htmlFor={`q-texto-${q.id}`} className="sr-only">
                Texto da pergunta
              </label>
              <input
                id={`q-texto-${q.id}`}
                value={q.texto}
                maxLength={140}
                placeholder={TIPOS_PERGUNTA.find((t) => t.valor === q.tipo)?.exemplo}
                onChange={(e) => mudar(i, { texto: e.target.value })}
                className={`${ESTILO_CAIXA} min-h-11`}
              />
              {q.tipo === "escolha" && (
                <div className="flex flex-col gap-1.5">
                  {(q.opcoes ?? []).map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input
                        value={o}
                        maxLength={60}
                        placeholder={`Opção ${k + 1}`}
                        aria-label={`Opção ${k + 1}`}
                        onChange={(e) => mudar(i, { opcoes: (q.opcoes ?? []).map((x, y) => (y === k ? e.target.value : x)) })}
                        className={`${ESTILO_CAIXA} min-h-10 flex-1 text-sm`}
                      />
                      {(q.opcoes ?? []).length > 2 && (
                        <button
                          type="button"
                          aria-label="Remover opção"
                          onClick={() => mudar(i, { opcoes: (q.opcoes ?? []).filter((_, y) => y !== k) })}
                          className="grid size-8 place-items-center text-ink-3"
                        >
                          <Icone nome="fechar" className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {(q.opcoes ?? []).length < 8 && (
                    <button
                      type="button"
                      onClick={() => mudar(i, { opcoes: [...(q.opcoes ?? []), ""] })}
                      className="self-start text-[13px] font-semibold text-brand"
                    >
                      + opção
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                {q.tipo === "numero" && (
                  <label className="flex items-center gap-1.5 text-ink-2">
                    Unidade
                    <input
                      value={q.unidade ?? ""}
                      maxLength={12}
                      placeholder="kg, h…"
                      onChange={(e) => mudar(i, { unidade: e.target.value })}
                      className="min-h-9 w-20 rounded-[10px] border border-line bg-surface px-2 text-sm"
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 text-ink-2">
                  <input
                    type="checkbox"
                    checked={q.obrigatoria}
                    onChange={(e) => mudar(i, { obrigatoria: e.target.checked })}
                    className="size-4 accent-[var(--brand)]"
                  />
                  Obrigatória
                </label>
              </div>
            </li>
          ))}
        </ol>

        {perguntas.length < LIMITE_PERGUNTAS && (
          <button
            type="button"
            onClick={adicionar}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-brand text-sm font-bold text-brand"
          >
            <Icone nome="mais" className="size-4" /> Adicionar pergunta
          </button>
        )}

        {id &&
          (apagando ? (
            <div className="flex flex-col gap-2 rounded-[14px] border border-bad/40 p-3 text-[13px] text-ink-2">
              Apagar este questionário? As programações dele param de enviar. As respostas que já chegaram continuam
              guardadas.
              <div className="flex gap-2">
                <button type="button" onClick={() => setApagando(false)} className="flex-1 rounded-[12px] border border-line py-2 font-bold">
                  Manter
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await arquivarQuestionario(id);
                      if (!r.ok) return setErro(r.erro);
                      router.replace("/agenda/online/questionarios");
                      router.refresh();
                    })
                  }
                  className="flex-1 rounded-[12px] bg-bad py-2 font-bold text-white"
                >
                  Apagar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setApagando(true)} className="self-start text-[13px] font-semibold text-bad">
              Apagar questionário
            </button>
          ))}
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
        <button type="button" onClick={salvar} disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
          {ocupado ? "Salvando…" : "Salvar questionário"}
        </button>
      </div>
    </div>
  );
}
