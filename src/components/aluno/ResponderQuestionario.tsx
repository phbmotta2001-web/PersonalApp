"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { responderCheckin } from "@/data/questionarios";
import { faltaResponder, type Pergunta, type Respostas } from "@/lib/questionario";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** O aluno responde um questionário do personal. */
export function ResponderQuestionario({
  checkinId,
  perguntas,
  voltar,
}: {
  checkinId: string;
  perguntas: Pergunta[];
  /** Para onde ir depois de enviar. */
  voltar: string;
}) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<Respostas>({});
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const falta = faltaResponder(perguntas, respostas);
  const responder = (id: string, valor: number | boolean | string | undefined) => {
    setErro(null);
    // Atualiza a partir do estado mais recente (dois toques seguidos não se atropelam).
    setRespostas((atual) => {
      const nova = { ...atual };
      if (valor === undefined || valor === "") delete nova[id];
      else nova[id] = valor;
      return nova;
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTentou(true);
        if (falta.length > 0) return;
        iniciar(async () => {
          try {
            const r = await responderCheckin(checkinId, respostas);
            if (!r.ok) return setErro(r.erro);
            router.replace(voltar);
            router.refresh();
          } catch {
            setErro("Não foi possível enviar agora. Confira sua internet.");
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      <ol className="flex flex-col gap-3">
        {perguntas.map((q, i) => {
          const v = respostas[q.id];
          const semResposta = tentou && falta.includes(q.texto);
          return (
            <li
              key={q.id}
              className={`flex flex-col gap-2.5 rounded-[18px] border bg-surface p-3.5 ${semResposta ? "border-bad" : "border-line"}`}
            >
              <p className="text-sm font-bold">
                {i + 1}. {q.texto}
                {!q.obrigatoria && <span className="font-normal text-ink-3"> (opcional)</span>}
              </p>

              {q.tipo === "nota" && (
                <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={q.texto}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={v === n}
                      onClick={() => responder(q.id, n)}
                      className={`min-h-10 rounded-[9px] text-sm font-bold tabular-nums ${
                        v === n ? "bg-ink text-app" : "border border-line bg-surface"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {q.tipo === "numero" && (
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input
                    inputMode="decimal"
                    aria-label={q.texto}
                    value={typeof v === "number" ? String(v).replace(".", ",") : ""}
                    onChange={(e) => {
                      const t = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                      responder(q.id, t === "" ? undefined : Number(t));
                    }}
                    className={`${ESTILO_CAIXA} w-28 tabular-nums`}
                  />
                  {q.unidade}
                </label>
              )}

              {q.tipo === "sim_nao" && (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={q.texto}>
                  {[
                    [true, "Sim"],
                    [false, "Não"],
                  ].map(([valor, rotulo]) => (
                    <button
                      key={String(valor)}
                      type="button"
                      role="radio"
                      aria-checked={v === valor}
                      onClick={() => responder(q.id, valor as boolean)}
                      className={`min-h-11 rounded-[12px] text-sm font-bold ${
                        v === valor ? "bg-ink text-app" : "border border-line bg-surface"
                      }`}
                    >
                      {rotulo as string}
                    </button>
                  ))}
                </div>
              )}

              {q.tipo === "escolha" && (
                <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={q.texto}>
                  {(q.opcoes ?? []).map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={v === o}
                      onClick={() => responder(q.id, o)}
                      className={`min-h-11 rounded-[12px] px-3 text-left text-sm font-semibold ${
                        v === o ? "bg-ink text-app" : "border border-line bg-surface"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {q.tipo === "texto" && (
                <textarea
                  aria-label={q.texto}
                  rows={3}
                  maxLength={1000}
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => responder(q.id, e.target.value)}
                  className={`${ESTILO_CAIXA} py-2.5`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <Aviso>{erro ?? (tentou && falta.length > 0 ? `Falta responder ${falta.length} pergunta${falta.length > 1 ? "s" : ""}.` : null)}</Aviso>
      <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Enviando…" : "Enviar respostas"}
      </button>
    </form>
  );
}
