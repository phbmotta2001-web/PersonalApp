"use client";

import type { Recebimento } from "@/data/cobrancas";
import { FORMAS_PAGAMENTO } from "@/lib/cobranca";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const reais = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const celula = (s: string) => `"${s.replaceAll('"', '""')}"`;

/** Planilha (abre no Excel e no Google Planilhas) e PDF, pela impressão do navegador. */
export function BaixarRelatorio({ mes, recebimentos }: { mes: string; recebimentos: Recebimento[] }) {
  const baixar = () => {
    const linhas = [
      ["Data", "Aluno", "Quem pagou", "Descrição", "Forma", "Valor (R$)"],
      ...recebimentos.map((r) => [
        dataBr(r.pagoEm),
        r.aluno,
        r.pagador,
        r.descricao,
        FORMAS_PAGAMENTO.find((f) => f.valor === r.forma)?.rotulo ?? "",
        reais(r.centavos),
      ]),
      ["", "", "", "", "Total", reais(recebimentos.reduce((s, r) => s + r.centavos, 0))],
    ];
    // Ponto e vírgula e BOM: o Excel em português abre com as colunas e os acentos certos.
    const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `recebimentos-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" onClick={baixar} className="min-h-[46px] flex-1 rounded-[14px] border border-line bg-surface px-3 font-bold text-brand">
        Baixar planilha
      </button>
      <button type="button" onClick={() => window.print()} className="min-h-[46px] flex-1 rounded-[14px] border border-line bg-surface px-3 font-bold text-brand">
        Salvar em PDF
      </button>
    </div>
  );
}
