import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { TabelaDoTreino } from "@/components/TabelaDoTreino";
import { exigirAluno } from "@/data/exigir-aluno";
import { treinoCompleto } from "@/data/treino";
import { DIAS } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Treino",
};

// Decisão 114: o aluno vê o treino de um dia, montado pelo personal.
export default function PaginaTreinoDoAluno({ params }: PageProps<"/aluno/personal/[vinculo]/treino/[dia]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/personal/[vinculo]/treino/[dia]">["params"] }) {
  const { vinculo, dia: diaTexto } = await params;
  await exigirAluno(`/aluno/personal/${vinculo}/treino/${diaTexto}`);
  const dia = Number(diaTexto);
  const treino = await treinoCompleto(vinculo);
  const voltar = `/aluno/personal/${vinculo}`;
  const nomeDoDia = DIAS.find((d) => d.valor === dia)?.nome;
  const foco = treino.focos[dia];
  const exercicios = treino.exercicios[dia] ?? [];

  return (
    <>
      <Cabecalho titulo={nomeDoDia ? `Treino de ${nomeDoDia.toLowerCase()}` : "Treino"}>
        <BotaoVoltar reserva={voltar} className="hover:bg-surface-2" />
      </Cabecalho>
      <div className="flex flex-col gap-4 px-[18px] pb-10">
        {!foco && exercicios.length === 0 ? (
          <p className="text-[15px] text-ink-2">
            Ainda não há treino para este dia.{" "}
            <Link href={voltar} className="font-semibold text-brand">
              Voltar
            </Link>
          </p>
        ) : (
          <>
            {foco && <p className="font-display text-[26px] leading-tight font-extrabold">{foco}</p>}
            {exercicios.length > 0 && <TabelaDoTreino exercicios={exercicios} />}
          </>
        )}
      </div>
    </>
  );
}
