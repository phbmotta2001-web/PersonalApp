import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { MarcarRelatorioVisto } from "@/components/aluno/MarcarRelatorioVisto";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { RelatorioDoMesNaTela } from "@/components/RelatorioDoMes";
import { avaliacoesDoVinculo } from "@/data/avaliacoes";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { evolucaoDoTreino, meusRelatorios } from "@/data/treino";
import { montarRelatorio, nomeDoMes } from "@/lib/relatorio";

export const metadata: Metadata = {
  title: "Relatório do mês",
};

// Decisão 117: o relatório do mês que o personal enviou ao aluno.
export default function PaginaRelatorioDoAluno({ params }: PageProps<"/aluno/personal/[vinculo]/relatorio/[mes]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-28">
      <Cabecalho titulo="Relatório do mês">
        <BotaoVoltar reserva="/aluno" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
      <BarraDoAluno />
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/personal/[vinculo]/relatorio/[mes]">["params"] }) {
  const { vinculo, mes } = await params;
  await exigirAluno(`/aluno/personal/${vinculo}/relatorio/${mes}`);
  const [relatorios, personais] = await Promise.all([meusRelatorios(), listarMeusPersonais()]);
  // Só o relatório que o personal enviou.
  if (!relatorios.some((r) => r.vinculoId === vinculo && r.mes === mes))
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-2 text-[15px] text-ink-2">
        <p>Este relatório não está disponível.</p>
        <Link href="/aluno" className="font-semibold text-brand">
          Voltar ao início
        </Link>
      </div>
    );
  const [pontos, avaliacoes] = await Promise.all([evolucaoDoTreino(vinculo), avaliacoesDoVinculo(vinculo)]);
  const r = montarRelatorio(pontos, avaliacoes, mes);
  const personal = personais.find((p) => p.vinculoId === vinculo)?.nome.split(" ")[0];

  return (
    <div className="flex flex-col gap-4 px-[18px] pb-6">
      <MarcarRelatorioVisto vinculoId={vinculo} mes={mes} />
      <div>
        <p className="text-[22px] font-extrabold first-letter:uppercase">{nomeDoMes(mes)}</p>
        {personal && <p className="text-[14px] text-ink-3">Enviado por {personal}</p>}
      </div>
      <RelatorioDoMesNaTela r={r} />
    </div>
  );
}
