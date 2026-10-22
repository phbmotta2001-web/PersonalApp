import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { lerPix, listarCobrancas, resumoDasCobrancas, type CobrancaComAluno } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import {
  COR_COBRANCA,
  descricaoDaCobranca,
  ROTULO_COBRANCA,
  situacaoDaCobranca,
  textoDoVencimento,
} from "@/lib/cobranca";
import { agoraEmBrasilia } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Cobranças",
};

export default function PaginaCobrancas() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Cobranças">
        <BotaoVoltar reserva="/agenda/financeiro" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/cobrancas");
  const hoje = agoraEmBrasilia().data;
  const [cobrancas, resumo, pix] = await Promise.all([listarCobrancas(), resumoDasCobrancas(hoje), lerPix()]);
  const com = cobrancas.map((c) => ({ ...c, s: situacaoDaCobranca(c, hoje) }));
  const avisadas = com.filter((c) => c.situacao === "aberta" && c.alunoAvisouEm);
  const atrasadas = com.filter((c) => c.s === "atrasada" && !c.alunoAvisouEm);
  const proximas = com.filter((c) => (c.s === "a_vencer" || c.s === "vence_hoje") && !c.alunoAvisouEm);
  const pagas = com.filter((c) => c.s === "paga").sort((a, b) => (b.pagoEm ?? "").localeCompare(a.pagoEm ?? ""));
  const nomeDoMes = new Date(`${hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <section className="grid grid-cols-3 gap-2" aria-label={`Resumo de ${nomeDoMes}`}>
        <Numero titulo="A receber" valor={resumo.aReceber} cor="text-ink" />
        <Numero titulo={`Recebido em ${nomeDoMes}`} valor={resumo.recebido} cor="text-ok" />
        <Numero titulo="Atrasado" valor={resumo.atrasado} cor={resumo.atrasado > 0 ? "text-bad" : "text-ink"} />
      </section>

      {!pix && (
        <Link
          href="/agenda/pix"
          className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-brand bg-brand-soft p-4 text-brand"
        >
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Cadastre sua chave Pix</span>
            <span className="block text-[13px]">
              Assim cada cobrança já vai com o Pix copia e cola e o QR Code, com o valor certo.
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <Link
        href="/agenda/cobrancas/nova"
        className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand px-3.5 py-2 text-[14px] font-bold text-brand-ink"
      >
        <Icone nome="mais" className="size-4" /> Cobrança avulsa
      </Link>

      <Lista titulo="O aluno avisou que pagou: confira e confirme" cobrancas={avisadas} hoje={hoje} destaque="gold" />
      <Lista titulo="Atrasadas" cobrancas={atrasadas} hoje={hoje} destaque="bad" />
      <Lista titulo="Próximas (vencem em até uma semana)" cobrancas={proximas} hoje={hoje} />
      <Lista titulo="Pagas recentemente" cobrancas={pagas.slice(0, 15)} hoje={hoje} />

      {com.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-[15px] text-ink-3">
          Nenhuma cobrança ainda. As mensalidades aparecem sozinhas uma semana antes do vencimento, a partir do valor e do
          vencimento de cada matrícula.
        </p>
      )}

      {pix && (
        <Link href="/agenda/pix" className="self-center text-[14px] font-semibold text-brand">
          Chave Pix: {pix.chave} · alterar
        </Link>
      )}
    </div>
  );
}

function Numero({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-2.5 py-2.5">
      <p className={`text-[16px] font-extrabold tabular-nums ${cor}`}>{centavosParaReais(valor)}</p>
      <p className="text-[12.5px] text-ink-3">{titulo}</p>
    </div>
  );
}

function Lista({
  titulo,
  cobrancas,
  hoje,
  destaque,
}: {
  titulo: string;
  cobrancas: (CobrancaComAluno & { s: ReturnType<typeof situacaoDaCobranca> })[];
  hoje: string;
  destaque?: "bad" | "gold";
}) {
  if (cobrancas.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`text-[16px] font-semibold ${destaque === "bad" ? "text-bad" : destaque === "gold" ? "text-gold" : ""}`}>
        {titulo} ({cobrancas.length})
      </h2>
      <ul className="flex flex-col gap-1.5">
        {cobrancas.map((c) => (
          <li key={c.id}>
            <Link
              href={`/agenda/cobrancas/${c.id}`}
              className={`flex items-center gap-3 rounded-[16px] border bg-surface px-3.5 py-3 ${
                c.s === "atrasada" ? "border-bad/50" : "border-line"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] font-bold ${c.s === "atrasada" ? "text-bad" : ""}`}>{c.nome}</span>
                <span className="block truncate text-[13px] text-ink-3">{descricaoDaCobranca(c)}</span>
                <span className="block text-[13px] text-ink-3">
                  {c.s === "paga" && c.pagoEm
                    ? `pago em ${c.pagoEm.slice(8, 10)}/${c.pagoEm.slice(5, 7)}`
                    : textoDoVencimento(c.vencimento, hoje)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-[15px] font-extrabold tabular-nums">
                  {centavosParaReais(c.s === "paga" ? (c.valorPagoCentavos ?? c.valorCentavos) : c.valorCentavos)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${COR_COBRANCA[c.s]}`}>
                  {c.alunoAvisouEm && c.situacao === "aberta" ? "Avisou que pagou" : ROTULO_COBRANCA[c.s]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
