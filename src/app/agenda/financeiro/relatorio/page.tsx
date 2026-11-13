import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BaixarRelatorio } from "@/components/agenda/BaixarRelatorio";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { relatorioDeRecebimentos } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { FORMAS_PAGAMENTO } from "@/lib/cobranca";
import { agoraEmBrasilia, dataCurta } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Relatório do mês",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]} de ${mes.slice(0, 4)}`;
const somarMes = (mes: string, n: number) => {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const forma = (f: string | null) => FORMAS_PAGAMENTO.find((x) => x.valor === f)?.rotulo ?? "—";

// Relatório para o carnê-leão: o que o personal recebeu dos alunos no mês, para declarar ou
// mandar ao contador (planilha ou PDF pela impressão).
export default function PaginaRelatorio({ searchParams }: PageProps<"/agenda/financeiro/relatorio">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-3xl">
      <div className="print:hidden">
        <Cabecalho titulo="Relatório do mês">
          <BotaoVoltar reserva="/agenda/financeiro" className="hover:bg-surface-2" />
        </Cabecalho>
      </div>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/financeiro/relatorio">["searchParams"] }) {
  const { mes: pedido } = await searchParams;
  const personal = await exigirPersonal("/agenda/financeiro/relatorio");
  const atual = agoraEmBrasilia().data.slice(0, 7);
  const mes = typeof pedido === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) && pedido <= atual ? pedido : atual;
  const { recebimentos, ano } = await relatorioDeRecebimentos(mes);
  const total = recebimentos.reduce((s, r) => s + r.centavos, 0);
  const totalAno = ano.reduce((s, m) => s + m.centavos, 0);
  // Por quem pagou (o carnê-leão pede o total de cada pagador no mês).
  const porPagador = [...recebimentos.reduce((m, r) => m.set(r.pagador, (m.get(r.pagador) ?? 0) + r.centavos), new Map<string, number>())].sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR"),
  );
  const link = (m: string) => `/agenda/financeiro/relatorio${m === atual ? "" : `?mes=${m}`}`;

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-12 print:px-0">
      <nav className="flex items-center gap-2 print:hidden" aria-label="Mês">
        <Link href={link(somarMes(mes, -1))} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Mês anterior">
          ‹
        </Link>
        <h2 className="flex-1 text-center text-[17px] font-bold first-letter:uppercase">{nomeDoMes(mes)}</h2>
        {mes < atual ? (
          <Link href={link(somarMes(mes, 1))} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próximo mês">
            ›
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </nav>

      <header className="hidden print:block">
        <h1 className="text-[20px] font-extrabold">Recebimentos de {nomeDoMes(mes)}</h1>
        <p className="text-[14px]">{personal.nomeCompleto}</p>
      </header>

      <section className="flex flex-col gap-1 rounded-[20px] bg-brand p-4 text-brand-ink print:bg-transparent print:p-0 print:text-ink">
        <span className="text-[13px] opacity-85">Recebido dos alunos no mês</span>
        <span className="font-display text-[30px] leading-tight font-extrabold">{centavosParaReais(total)}</span>
        <span className="text-[13.5px] opacity-85">
          {recebimentos.length} {recebimentos.length === 1 ? "pagamento" : "pagamentos"} · pela data em que você marcou como pago
        </span>
      </section>

      {recebimentos.length > 0 && <BaixarRelatorio mes={mes} recebimentos={recebimentos} />}

      {porPagador.length > 0 && (
        <section className="flex flex-col rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Total por quem pagou">
          <h2 className="pb-1 text-[16px] font-semibold">Total por quem pagou</h2>
          <ul className="flex flex-col divide-y divide-line">
            {porPagador.map(([nome, centavos]) => (
              <li key={nome} className="flex gap-3 py-2 text-[15px]">
                <span className="min-w-0 flex-1">{nome}</span>
                <span className="font-semibold tabular-nums">{centavosParaReais(centavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Pagamentos">
        <h2 className="pb-1 text-[16px] font-semibold">Pagamentos</h2>
        {recebimentos.length === 0 ? (
          <p className="py-2 text-[14.5px] text-ink-3">Nenhum pagamento marcado como pago neste mês.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {recebimentos.map((r) => (
              <li key={r.id} className="flex gap-3 py-2 text-[14.5px]">
                <span className="w-12 shrink-0 font-semibold tabular-nums">{dataCurta(r.pagoEm)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.aluno}</span>
                  <span className="block text-[13px] text-ink-3">
                    {r.descricao} · {forma(r.forma)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{centavosParaReais(r.centavos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col rounded-[20px] border border-line bg-surface px-4 py-3 print:hidden" aria-label={`Ano de ${mes.slice(0, 4)}`}>
        <h2 className="flex pb-1 text-[16px] font-semibold">
          <span className="flex-1">Ano de {mes.slice(0, 4)}</span>
          <span className="tabular-nums">{centavosParaReais(totalAno)}</span>
        </h2>
        <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          {ano
            .filter((m) => m.mes <= atual)
            .map((m) => (
              <li key={m.mes}>
                <Link href={link(m.mes)} scroll={false} className={`flex gap-2 py-1.5 text-[14px] ${m.mes === mes ? "font-bold text-brand" : ""}`}>
                  <span className="flex-1 first-letter:uppercase">{MESES[Number(m.mes.slice(5)) - 1]}</span>
                  <span className="tabular-nums">{centavosParaReais(m.centavos)}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <p className="text-[13px] text-ink-3 print:hidden">
        Só entram os pagamentos de alunos marcados como pagos no P-Bell. O que você recebe de estúdios ou empresas não entra aqui. Na dúvida sobre o
        que declarar, mostre este relatório ao seu contador.
      </p>
    </div>
  );
}
