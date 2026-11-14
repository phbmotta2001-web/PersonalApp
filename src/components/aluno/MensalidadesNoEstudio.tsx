"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { avisarPagamentoNoEstudio, type MensalidadeNoEstudio } from "@/data/mensalidade-estudio";
import { textoDoVencimento } from "@/lib/cobranca";
import { dataCurta } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { CopiarPix } from "../agenda/CopiarPix";
import { Aviso } from "../Formulario";

/** Decisão 102: mensalidades do aluno no estúdio, com o Pix e "Já paguei". */
export function MensalidadesNoEstudio({ lista, estudio, hoje }: { lista: MensalidadeNoEstudio[]; estudio: string; hoje: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  if (lista.length === 0) return null;
  const abertas = lista.filter((c) => c.situacao === "aberta").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = lista.filter((c) => c.situacao === "paga").slice(0, 3);
  const nome = (c: MensalidadeNoEstudio) => (c.tipo === "taxa" ? "Taxa de matrícula" : "Mensalidade");

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Mensalidade">
      <h2 className="font-bold">Mensalidade</h2>
      {abertas.length === 0 && <p className="text-[14px] text-ink-3">Nada em aberto. Tudo em dia!</p>}
      {abertas.map((c) => {
        const atrasada = c.vencimento < hoje;
        return (
          <div key={c.id} className={`flex flex-col gap-2 rounded-[16px] border p-3 ${atrasada && !c.avisou ? "border-bad bg-bad/5" : "border-line"}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] font-bold ${atrasada && !c.avisou ? "text-bad" : ""}`}>{nome(c)}</p>
                <p className={`text-[13px] ${atrasada && !c.avisou ? "font-semibold text-bad" : "text-ink-3"}`}>{textoDoVencimento(c.vencimento, hoje)}</p>
              </div>
              <span className="text-[17px] font-extrabold tabular-nums">{centavosParaReais(c.valorCentavos)}</span>
            </div>
            {c.avisou ? (
              <p className="text-[13px] text-ink-3">Você avisou que pagou. A coordenação do {estudio} confere e confirma por aqui.</p>
            ) : (
              <>
                {c.pix ? (
                  <CopiarPix codigo={c.pix.codigo} qrSvg={c.pix.qrSvg} />
                ) : (
                  <p className="text-[13px] text-ink-3">Combine a forma de pagamento com a coordenação do {estudio}.</p>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    iniciar(async () => {
                      setErro(null);
                      const r = await avisarPagamentoNoEstudio(c.id);
                      if (!r.ok) return setErro(r.erro);
                      router.refresh();
                    })
                  }
                  className="rounded-[12px] border border-brand px-3 py-2.5 text-[14px] font-bold text-brand"
                >
                  {ocupado ? "Avisando…" : "Já paguei"}
                </button>
              </>
            )}
          </div>
        );
      })}
      <Aviso>{erro}</Aviso>
      {pagas.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px] text-ink-3">
          {pagas.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="flex-1">
                {nome(c)} · {dataCurta(c.vencimento)}
              </span>
              <span className="tabular-nums">{centavosParaReais(c.valorCentavos)}</span>
              <span className="font-bold text-ok">Paga</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
