"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { alunoAvisarPagamento } from "@/data/cobrancas";
import {
  COR_COBRANCA,
  descricaoDaCobranca,
  ROTULO_COBRANCA,
  situacaoDaCobranca,
  textoDoVencimento,
  type Cobranca,
} from "@/lib/cobranca";
import { centavosParaReais } from "@/lib/matricula";
import { CopiarPix } from "../agenda/CopiarPix";
import { Aviso } from "../Formulario";

/** Mensalidades do aluno com um personal: pagar por Pix e avisar "Já paguei". */
export function CobrancasDoAluno({
  cobrancas,
  pix,
  nomePersonal,
  hoje,
}: {
  cobrancas: Cobranca[];
  /** Pix copia e cola e QR Code de cada cobrança em aberto, por id (vazio se o personal não cadastrou a chave). */
  pix: Record<string, { codigo: string; qrSvg: string }>;
  nomePersonal: string;
  hoje: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const primeiro = nomePersonal.split(" ")[0];
  const abertas = cobrancas.filter((c) => c.situacao === "aberta").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const pagas = cobrancas.filter((c) => c.situacao === "paga").slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-ink-3">Matrícula e pagamentos</p>
      {abertas.length === 0 && <p className="text-[13px] text-ink-3">Nada em aberto. Tudo em dia!</p>}
      {abertas.map((c) => {
        const s = situacaoDaCobranca(c, hoje);
        return (
          <div
            key={c.id}
            className={`flex flex-col gap-2 rounded-[16px] border p-3 ${s === "atrasada" ? "border-bad bg-bad/5" : "border-line"}`}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${s === "atrasada" ? "text-bad" : ""}`}>{descricaoDaCobranca(c, true)}</p>
                <p className={`text-xs ${s === "atrasada" ? "font-semibold text-bad" : "text-ink-3"}`}>
                  {textoDoVencimento(c.vencimento, hoje)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[17px] font-extrabold tabular-nums">{centavosParaReais(c.valorCentavos)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_COBRANCA[s]}`}>
                  {c.alunoAvisouEm ? "Aguardando confirmação" : ROTULO_COBRANCA[s]}
                </span>
              </div>
            </div>
            {c.alunoAvisouEm ? (
              <p className="text-xs text-ink-3">
                Você avisou que pagou. {primeiro} confere no banco e confirma por aqui.
              </p>
            ) : (
              <>
                {pix[c.id] ? (
                  <CopiarPix codigo={pix[c.id].codigo} qrSvg={pix[c.id].qrSvg} />
                ) : (
                  <p className="text-xs text-ink-3">Combine a forma de pagamento com {primeiro}.</p>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    iniciar(async () => {
                      setErro(null);
                      try {
                        const r = await alunoAvisarPagamento(c.id);
                        if (!r.ok) return setErro(r.erro);
                        router.refresh();
                      } catch {
                        setErro("Não foi possível avisar agora. Confira sua internet.");
                      }
                    })
                  }
                  className="rounded-[12px] border border-brand px-3 py-2.5 text-[13px] font-bold text-brand"
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
        <ul className="flex flex-col gap-1 text-xs text-ink-3">
          {pagas.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="flex-1">{descricaoDaCobranca(c, true)}</span>
              <span className="tabular-nums">{centavosParaReais(c.valorPagoCentavos ?? c.valorCentavos)}</span>
              <span className="font-bold text-ok">Paga</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
