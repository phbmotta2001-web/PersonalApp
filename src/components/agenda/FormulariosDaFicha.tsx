"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarParqEAnamnese } from "@/data/formularios-personal";
import type { RespostaDeFormulario } from "@/data/formularios-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { RespostasDoFormulario } from "../estudio/RespostasDoAluno";
import { Aviso } from "../Formulario";

/**
 * Decisão 105: ParQ e anamnese na ficha do aluno do personal. Respondidos: toque para ver ("sim"
 * no ParQ em vermelho). Sem nada para responder: "Enviar ParQ e anamnese" (aviso no app e WhatsApp).
 */
export function FormulariosDaFicha({
  vinculoId,
  nome,
  whatsapp,
  lista,
}: {
  vinculoId: string;
  nome: string;
  whatsapp: string | null;
  lista: RespostaDeFormulario[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const pendentes = lista.filter((f) => !f.respondidoEm).length;
  const simNoParq = (f: RespostaDeFormulario) =>
    f.tipo === "parq" && f.perguntas.some((q) => q.tipo === "sim_nao" && q.id !== "declaracao" && f.respostas?.[q.id] === true);
  const mensagem = () =>
    `Olá, ${nome.split(" ")[0]}! Mandei o ParQ e a anamnese no app. Responda antes do treino, leva poucos minutos: ${window.location.origin}/aluno`;

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="ParQ e anamnese">
      <h3 className="text-[16px] font-bold">ParQ e anamnese</h3>
      {lista.length === 0 && <p className="text-[14px] text-ink-3">Ainda não enviados para este aluno.</p>}
      {lista.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {lista.map((f) => (
            <li key={f.id} className="py-2">
              <button
                type="button"
                disabled={!f.respondidoEm}
                onClick={() => setAberto(aberto === f.id ? null : f.id)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1 font-bold">{f.titulo}</span>
                <span className={`text-[13px] font-semibold ${!f.respondidoEm ? "text-gold" : simNoParq(f) ? "text-bad" : "text-ink-3"}`}>
                  {!f.respondidoEm
                    ? "Não respondeu"
                    : simNoParq(f)
                      ? `"Sim" no ParQ · ${dataCurta(emBrasilia(f.respondidoEm).data)}`
                      : dataCurta(emBrasilia(f.respondidoEm).data)}
                </span>
                {f.respondidoEm && <span className="text-ink-3">{aberto === f.id ? "▴" : "▾"}</span>}
              </button>
              {aberto === f.id && (
                <div className="pt-2">
                  <RespostasDoFormulario perguntas={f.perguntas} respostas={f.respostas} parq={f.tipo === "parq"} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Aviso>{erro}</Aviso>
      {enviado ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ok">
          Enviado. {nome.split(" ")[0]} foi avisado no app.
          {whatsapp && (
            <a href={linkWhatsapp(whatsapp, mensagem())} target="_blank" rel="noreferrer" className="font-bold text-brand">
              Mandar no WhatsApp
            </a>
          )}
        </p>
      ) : (
        pendentes === 0 && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                const r = await enviarParqEAnamnese(vinculoId);
                if (!r.ok) return setErro(r.erro);
                setEnviado(true);
                router.refresh();
              })
            }
            className="self-start text-[14.5px] font-bold text-brand"
          >
            {ocupado ? "Enviando…" : lista.length ? "Pedir para preencher de novo" : "Enviar ParQ e anamnese"}
          </button>
        )
      )}
    </section>
  );
}
