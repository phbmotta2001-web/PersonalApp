import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { relatoriosDoMes } from "@/data/treino";
import { agoraEmBrasilia } from "@/lib/expediente";
import { mesAnterior, mesPadraoDoRelatorio, mesSeguinte, nomeDoMes } from "@/lib/relatorio";

export const metadata: Metadata = {
  title: "Relatórios do mês",
};

// Decisão 117: no fim do mês, o personal vê o relatório de cada aluno e escolhe se envia.
export default function PaginaRelatorios({ searchParams }: PageProps<"/agenda/relatorios">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/relatorios">["searchParams"] }) {
  const { mes: pedido } = await searchParams;
  await exigirPersonal("/agenda/relatorios");
  const atual = agoraEmBrasilia().data.slice(0, 7);
  const mes = typeof pedido === "string" && /^\d{4}-\d{2}$/.test(pedido) && pedido <= atual ? pedido : mesPadraoDoRelatorio(agoraEmBrasilia().data);
  const [lista, alunos] = await Promise.all([relatoriosDoMes(mes), listarMeusAlunos()]);
  const nome = (v: string) => alunos.find((a) => a.vinculoId === v)?.nome || "Aluno";
  const comTreino = lista.filter((r) => r.aulas > 0).sort((a, b) => nome(a.vinculoId).localeCompare(nome(b.vinculoId)));
  const semTreino = lista.filter((r) => r.aulas === 0);

  return (
    <>
      <Cabecalho titulo="Relatórios do mês">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <div className="flex flex-col gap-4 px-[18px] pb-10">
        <div className="flex items-center gap-2">
          <Link href={`?mes=${mesAnterior(mes)}`} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-[18px]">
            ‹
          </Link>
          <p className="flex-1 text-center text-[18px] font-extrabold first-letter:uppercase">{nomeDoMes(mes)}</p>
          {mes < atual ? (
            <Link href={`?mes=${mesSeguinte(mes)}`} aria-label="Mês seguinte" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-[18px]">
              ›
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>

        {comTreino.length === 0 ? (
          <p className="rounded-[18px] border border-line bg-surface p-4 text-[15px] text-ink-3">
            Nenhum aluno com treino registrado em {nomeDoMes(mes, true)}. O relatório sai dos exercícios marcados no treino em andamento.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
            {comTreino.map((r) => (
              <li key={r.vinculoId}>
                <Link href={`/agenda/alunos/${r.vinculoId}/relatorio?mes=${mes}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{nome(r.vinculoId)}</span>
                    <span className="block text-[13.5px] text-ink-3">
                      {r.aulas} {r.aulas === 1 ? "aula" : "aulas"} com treino
                    </span>
                  </span>
                  {r.enviadoEm ? (
                    <span className="flex items-center gap-1 text-[13.5px] font-semibold text-ok">
                      <Icone nome="certo" className="size-4" /> Enviado
                    </span>
                  ) : (
                    <span className="text-[13.5px] font-semibold text-brand">Ver e enviar</span>
                  )}
                  <span className="text-ink-3" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {semTreino.length > 0 && (
          <p className="text-[13.5px] text-ink-3">
            Sem treino registrado no mês: {semTreino.map((r) => nome(r.vinculoId).split(" ")[0]).join(", ")}.
          </p>
        )}
      </div>
    </>
  );
}

