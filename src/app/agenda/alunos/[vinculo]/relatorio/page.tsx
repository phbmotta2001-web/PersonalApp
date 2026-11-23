import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EnvioDoRelatorio } from "@/components/agenda/EnvioDoRelatorio";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { RelatorioDoMesNaTela } from "@/components/RelatorioDoMes";
import { avaliacoesDoVinculo } from "@/data/avaliacoes";
import { lerFichaDoAluno } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { evolucaoDoTreino, relatoriosDoMes } from "@/data/treino";
import { agoraEmBrasilia } from "@/lib/expediente";
import { mesAnterior, mesPadraoDoRelatorio, mesSeguinte, montarRelatorio, nomeDoMes, textoDoWhatsapp } from "@/lib/relatorio";

export const metadata: Metadata = {
  title: "Relatório do mês",
};

// Decisão 117: o relatório do mês de um aluno, para o personal ver e escolher se envia.
export default function PaginaRelatorioDoAluno({ params, searchParams }: PageProps<"/agenda/alunos/[vinculo]/relatorio">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({
  params,
  searchParams,
}: {
  params: PageProps<"/agenda/alunos/[vinculo]/relatorio">["params"];
  searchParams: PageProps<"/agenda/alunos/[vinculo]/relatorio">["searchParams"];
}) {
  const [{ vinculo }, { mes: pedido }] = await Promise.all([params, searchParams]);
  await exigirPersonal(`/agenda/alunos/${vinculo}/relatorio`);
  const atual = agoraEmBrasilia().data.slice(0, 7);
  const mes = typeof pedido === "string" && /^\d{4}-\d{2}$/.test(pedido) && pedido <= atual ? pedido : mesPadraoDoRelatorio(agoraEmBrasilia().data);
  const [aluno, pontos, avaliacoes, envios] = await Promise.all([
    lerFichaDoAluno(vinculo),
    evolucaoDoTreino(vinculo),
    avaliacoesDoVinculo(vinculo),
    relatoriosDoMes(mes),
  ]);
  const ficha = `/agenda/alunos/${vinculo}`;
  if (!aluno)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-6 text-[15px] text-ink-2">
        <p>Este aluno não está mais ligado a você, ou o endereço está errado.</p>
        <Link href="/agenda/alunos" className="font-semibold text-brand">
          Ver meus alunos
        </Link>
      </div>
    );
  const r = montarRelatorio(pontos, avaliacoes, mes);
  const enviadoEm = envios.find((e) => e.vinculoId === vinculo)?.enviadoEm ?? null;
  const semConta = !!aluno.semConta;

  return (
    <>
      <Cabecalho titulo="Relatório do mês">
        <BotaoVoltar reserva={ficha} className="hover:bg-surface-2" />
      </Cabecalho>
      <div className="flex flex-col gap-4 px-[18px] pb-10">
        <div className="flex items-center gap-2">
          <Link href={`?mes=${mesAnterior(mes)}`} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-[18px]">
            ‹
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[18px] font-extrabold first-letter:uppercase">{nomeDoMes(mes)}</p>
            <p className="truncate text-[14px] text-ink-3">{aluno.nomeCompleto}</p>
          </div>
          {mes < atual ? (
            <Link href={`?mes=${mesSeguinte(mes)}`} aria-label="Mês seguinte" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-[18px]">
              ›
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>
        {mes === atual && <p className="-mt-2 text-center text-[13.5px] text-ink-3">O mês ainda não acabou: o relatório vai crescendo até o fim do mês.</p>}

        <RelatorioDoMesNaTela r={r} />

        <EnvioDoRelatorio
          vinculoId={vinculo}
          mes={mes}
          enviadoEm={enviadoEm}
          semConta={semConta}
          whatsapp={aluno.whatsapp}
          texto={[textoDoWhatsapp(aluno.nomeCompleto, r, false), textoDoWhatsapp(aluno.nomeCompleto, r, true)]}
        />
      </div>
    </>
  );
}
