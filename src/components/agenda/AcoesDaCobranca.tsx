"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  alterarValorCobranca,
  cancelarCobranca,
  desfazerCobranca,
  marcarCobrancaPaga,
  type CobrancaComAluno,
} from "@/data/cobrancas";
import { FORMAS_PAGAMENTO, situacaoDaCobranca, type FormaPagamento } from "@/lib/cobranca";
import { centavosParaCampo, centavosParaReais } from "@/lib/matricula";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";
import { soltarConfete } from "@/lib/confete";
import { CopiarPix } from "./CopiarPix";

/** Ações de uma cobrança: receber, cobrar no WhatsApp, mudar valor, cancelar e desfazer. */
export function AcoesDaCobranca({
  cobranca: c,
  hoje,
  pix,
  linkWhatsapp,
}: {
  cobranca: CobrancaComAluno;
  hoje: string;
  pix: { codigo: string; qrSvg: string } | null;
  /** Conversa com o aluno já com a mensagem de cobrança (null se a cobrança não está em aberto). */
  linkWhatsapp: string | null;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<null | "receber" | "valor" | "cancelar">(c.alunoAvisouEm ? "receber" : null);
  const [pagoEm, setPagoEm] = useState(hoje);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [valor, setValor] = useState(centavosParaCampo(c.valorCentavos));
  const [novoValor, setNovoValor] = useState(centavosParaCampo(c.valorCentavos));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const s = situacaoDaCobranca(c, hoje);
  const primeiro = c.nome.split(" ")[0];

  const executar = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, comemorarEm?: Element | null) =>
    iniciar(async () => {
      setErro(null);
      try {
        const r = await fn();
        if (!r.ok) return setErro(r.erro);
        // Pagamento recebido: comemora com o personal.
        if (comemorarEm !== undefined) soltarConfete(comemorarEm);
        setModo(null);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });

  if (c.situacao !== "aberta")
    return (
      <div className="flex flex-col gap-3">
        {c.situacao === "paga" && c.pagoEm && (
          <p className="rounded-[14px] bg-ok-soft p-3 text-[14px] text-ok">
            Recebido em {c.pagoEm.slice(8, 10)}/{c.pagoEm.slice(5, 7)}/{c.pagoEm.slice(0, 4)}
            {c.formaPagamento && ` por ${FORMAS_PAGAMENTO.find((f) => f.valor === c.formaPagamento)?.rotulo.toLowerCase()}`}
            {c.valorPagoCentavos != null && `: ${centavosParaReais(c.valorPagoCentavos)}`}.
          </p>
        )}
        <Aviso>{erro}</Aviso>
        <button type="button" disabled={ocupado} onClick={() => executar(() => desfazerCobranca(c.id))} className={ESTILO_BOTAO_SECUNDARIO}>
          {c.situacao === "paga" ? "Desfazer recebimento" : "Reabrir cobrança"}
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {c.alunoAvisouEm && (
        <p className="rounded-[14px] bg-gold-soft p-3 text-[14px] text-gold">
          <strong>{primeiro} avisou que pagou</strong> em {new Date(c.alunoAvisouEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.
          Confira no seu banco e confirme abaixo.
        </p>
      )}
      <Aviso>{erro}</Aviso>

      {modo === "receber" ? (
        <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
          <p className="text-[16px] font-bold">Marcar como recebido</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="rec-data" rotulo="Data">
              <input id="rec-data" type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} className={ESTILO_CAIXA} />
            </Campo>
            <Campo id="rec-valor" rotulo="Valor recebido">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-3">R$</span>
                <input
                  id="rec-valor"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className={`${ESTILO_CAIXA} pl-9 tabular-nums`}
                />
              </div>
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Forma de pagamento">
            {FORMAS_PAGAMENTO.map((f) => (
              <Chip key={f.valor} ativo={forma === f.valor} onClick={() => setForma(f.valor)}>
                {f.rotulo}
              </Chip>
            ))}
          </div>
          <button
            type="button"
            disabled={ocupado}
            onClick={(e) => executar(() => marcarCobrancaPaga(c.id, pagoEm, forma, valor), e.currentTarget)}
            className={ESTILO_BOTAO_PRINCIPAL}
          >
            <Icone nome="certo" className="size-4" /> {ocupado ? "Salvando…" : "Confirmar recebimento"}
          </button>
        </section>
      ) : (
        <button type="button" onClick={() => setModo("receber")} className={ESTILO_BOTAO_PRINCIPAL}>
          <Icone nome="certo" className="size-4" /> Marcar como recebido
        </button>
      )}

      {linkWhatsapp && (
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={`${ESTILO_BOTAO_SECUNDARIO} ${s === "atrasada" ? "border-bad text-bad" : ""}`}
        >
          <Icone nome="conversa" className="size-4" /> Cobrar no WhatsApp
        </a>
      )}

      {pix && <CopiarPix codigo={pix.codigo} qrSvg={pix.qrSvg} />}

      <div className="flex flex-wrap gap-4 pt-1 text-[14px] font-semibold">
        <button type="button" onClick={() => setModo(modo === "valor" ? null : "valor")} className="text-brand">
          Mudar valor
        </button>
        <button type="button" onClick={() => setModo(modo === "cancelar" ? null : "cancelar")} className="text-bad">
          Cancelar cobrança
        </button>
      </div>

      {modo === "valor" && (
        <section className="flex flex-col gap-2 rounded-[16px] border border-line bg-surface p-3">
          <label htmlFor="novo-valor" className="text-[14px] font-bold text-ink-2">
            Novo valor (ex.: com desconto)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-3">R$</span>
            <input
              id="novo-valor"
              inputMode="decimal"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              className={`${ESTILO_CAIXA} pl-9 tabular-nums`}
            />
          </div>
          <button type="button" disabled={ocupado} onClick={() => executar(() => alterarValorCobranca(c.id, novoValor))} className={ESTILO_BOTAO_SECUNDARIO}>
            Salvar valor
          </button>
        </section>
      )}
      {modo === "cancelar" && (
        <section className="flex flex-col gap-2 rounded-[16px] border border-bad/40 bg-surface p-3">
          <p className="text-[14px] text-ink-2">
            A cobrança sai da lista de {primeiro} (ex.: mês de férias). Dá para reabrir depois.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => executar(() => cancelarCobranca(c.id))}
            className="flex min-h-11 items-center justify-center rounded-[13px] bg-bad px-3 text-[14px] font-bold text-white disabled:opacity-60"
          >
            Cancelar cobrança
          </button>
        </section>
      )}
    </div>
  );
}
