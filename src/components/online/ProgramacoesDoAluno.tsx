"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  enviarQuestionarioAgora,
  excluirProgramacao,
  salvarProgramacao,
  type NovaProgramacao,
  type Questionario,
} from "@/data/questionarios";
import { DIAS, minParaHora, opcoesDeHora } from "@/lib/expediente";
import { FREQUENCIAS, textoDaProgramacao, type Programacao } from "@/lib/questionario";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

const estiloSelect = "min-h-11 w-full rounded-[11px] border border-line bg-surface px-2 text-[15px]";

/** Programações de questionário de um aluno: quando cada um é enviado. */
export function ProgramacoesDoAluno({
  vinculoId,
  programacoes,
  questionarios,
  hoje,
  diaSemanaHoje,
}: {
  vinculoId: string;
  programacoes: Programacao[];
  questionarios: Questionario[];
  hoje: string;
  diaSemanaHoje: number;
}) {
  const router = useRouter();
  const vazia = (): NovaProgramacao => ({
    id: null,
    questionarioId: questionarios[0]?.id ?? "",
    frequencia: "semanal",
    diaSemana: diaSemanaHoje,
    diaMes: Number(hoje.slice(8, 10)) > 28 ? 28 : Number(hoje.slice(8, 10)),
    horaMin: 480,
    inicio: hoje,
    ativa: true,
  });
  const [editando, setEditando] = useState<NovaProgramacao | null>(null);
  const [agora, setAgora] = useState(questionarios[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const executar = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, sucesso: string) =>
    iniciar(async () => {
      setErro(null);
      setFeito(null);
      try {
        const r = await fn();
        if (!r.ok) return setErro(r.erro);
        setEditando(null);
        setFeito(sucesso);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });

  return (
    <section className="flex flex-col gap-3" aria-label="Programação de questionários">
      <h2 className="text-[16px] font-semibold">Quando enviar</h2>
      {programacoes.length === 0 && !editando && (
        <p className="text-[14px] text-ink-3">Nenhum questionário programado para este aluno.</p>
      )}
      <ul className="flex flex-col gap-2">
        {programacoes.map((p) => (
          <li key={p.id} className={`flex items-start gap-3 rounded-[16px] border border-line bg-surface p-3 ${p.ativa ? "" : "opacity-60"}`}>
            <Icone nome="relogio" className="mt-0.5 size-4 shrink-0 text-info" />
            <span className="min-w-0 flex-1 text-[15px]">
              <span className="block font-bold">{p.nomeQuestionario}</span>
              <span className="block text-[13px] text-ink-3">
                {textoDaProgramacao(p)}
                {!p.ativa && " · pausado"}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1 text-[13px] font-semibold">
              <button
                type="button"
                onClick={() =>
                  setEditando({
                    id: p.id,
                    questionarioId: p.questionarioId,
                    frequencia: p.frequencia,
                    diaSemana: p.diaSemana ?? diaSemanaHoje,
                    diaMes: p.diaMes ?? 1,
                    horaMin: p.horaMin,
                    inicio: p.inicio,
                    ativa: p.ativa,
                  })
                }
                className="text-brand"
              >
                Alterar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  executar(
                    () =>
                      salvarProgramacao(vinculoId, {
                        id: p.id,
                        questionarioId: p.questionarioId,
                        frequencia: p.frequencia,
                        diaSemana: p.diaSemana ?? 1,
                        diaMes: p.diaMes ?? 1,
                        horaMin: p.horaMin,
                        inicio: p.inicio,
                        ativa: !p.ativa,
                      }),
                    p.ativa ? "Envio pausado." : "Envio retomado.",
                  )
                }
                className="text-ink-3"
              >
                {p.ativa ? "Pausar" : "Retomar"}
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => executar(() => excluirProgramacao(p.id), "Programação apagada.")}
                className="text-bad"
              >
                Apagar
              </button>
            </span>
          </li>
        ))}
      </ul>

      {editando ? (
        <div className="flex flex-col gap-3 rounded-[18px] border border-brand bg-surface p-3.5">
          <p className="text-[14px] font-bold">{editando.id ? "Alterar programação" : "Programar questionário"}</p>
          <label className="flex flex-col gap-1 text-[14px] font-semibold text-ink-2">
            Questionário
            <select
              value={editando.questionarioId}
              onChange={(e) => setEditando({ ...editando, questionarioId: e.target.value })}
              className={estiloSelect}
            >
              {questionarios.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Frequência">
            {FREQUENCIAS.map((f) => (
              <Chip key={f.valor} ativo={editando.frequencia === f.valor} onClick={() => setEditando({ ...editando, frequencia: f.valor })}>
                {f.rotulo}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {editando.frequencia === "mensal" ? (
              <label className="flex flex-col gap-1 text-[14px] font-semibold text-ink-2">
                Dia do mês
                <select
                  value={editando.diaMes}
                  onChange={(e) => setEditando({ ...editando, diaMes: Number(e.target.value) })}
                  className={estiloSelect}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Dia {d}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-[14px] font-semibold text-ink-2">
                Dia da semana
                <select
                  value={editando.diaSemana}
                  onChange={(e) => setEditando({ ...editando, diaSemana: Number(e.target.value) })}
                  className={estiloSelect}
                >
                  {DIAS.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-[14px] font-semibold text-ink-2">
              Hora
              <select
                value={editando.horaMin}
                onChange={(e) => setEditando({ ...editando, horaMin: Number(e.target.value) })}
                className={estiloSelect}
              >
                {opcoesDeHora(0, 1410).map((m) => (
                  <option key={m} value={m}>
                    {minParaHora(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[14px] font-semibold text-ink-2">
            Começa em
            <input
              type="date"
              value={editando.inicio}
              onChange={(e) => setEditando({ ...editando, inicio: e.target.value || hoje })}
              className={ESTILO_CAIXA}
            />
          </label>
          <p className="text-[13px] text-ink-3">
            Na data, o questionário fica pendente para o aluno e aparece aqui para você mandar o link pelo WhatsApp. O envio
            automático chega com o WhatsApp automático.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditando(null)} className="flex-1 rounded-[13px] border border-line py-2.5 text-[15px] font-bold">
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || !editando.questionarioId}
              onClick={() => executar(() => salvarProgramacao(vinculoId, editando), "Programação salva.")}
              className="flex-1 rounded-[13px] bg-brand py-2.5 text-[15px] font-bold text-brand-ink disabled:opacity-60"
            >
              {ocupado ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(vazia())} className={ESTILO_BOTAO_PRINCIPAL} disabled={questionarios.length === 0}>
          <Icone nome="mais" className="size-4" /> Programar questionário
        </button>
      )}

      <div className="flex items-center gap-2 rounded-[16px] border border-line bg-surface p-3">
        <label htmlFor="enviar-agora" className="sr-only">
          Questionário para enviar agora
        </label>
        <select id="enviar-agora" value={agora} onChange={(e) => setAgora(e.target.value)} className={`${estiloSelect} flex-1`}>
          {questionarios.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={ocupado || !agora}
          onClick={() => executar(() => enviarQuestionarioAgora(agora, vinculoId), "Questionário criado: mande o link abaixo.")}
          className="shrink-0 rounded-[11px] border border-brand px-3 py-2.5 text-[14px] font-bold text-brand"
        >
          Enviar agora
        </button>
      </div>

      <Aviso tipo="ok">{feito}</Aviso>
      <Aviso>{erro}</Aviso>
    </section>
  );
}
