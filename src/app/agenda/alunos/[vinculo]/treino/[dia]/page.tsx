import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditorDoTreinoDoDia } from "@/components/agenda/EditorDoTreinoDoDia";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerFichaDoAluno } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerMatricula } from "@/data/matriculas";
import { treinoCompleto } from "@/data/treino";
import { DIAS } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Treino",
};

// Decisão 114: o treino de um dia do aluno (o que será trabalhado e os exercícios).
export default function PaginaTreinoDoDia({ params }: PageProps<"/agenda/alunos/[vinculo]/treino/[dia]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/alunos/[vinculo]/treino/[dia]">["params"] }) {
  const { vinculo, dia: diaTexto } = await params;
  await exigirPersonal(`/agenda/alunos/${vinculo}/treino/${diaTexto}`);
  const dia = Number(diaTexto);
  const [aluno, matricula, treino] = await Promise.all([lerFichaDoAluno(vinculo), lerMatricula(vinculo), treinoCompleto(vinculo)]);
  const ficha = `/agenda/alunos/${vinculo}`;
  // Só os dias de aula do aluno (ou um dia que ainda tem treino, para poder apagar).
  const diaDeAula = matricula?.horarios.some((h) => h.dia === dia) ?? false;
  const temTreino = dia in treino.focos || dia in treino.exercicios;
  const nomeDoDia = DIAS.find((d) => d.valor === dia)?.nome;

  if (!aluno || !nomeDoDia || (!diaDeAula && !temTreino))
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-6 text-[15px] text-ink-2">
        <p>{aluno ? "Este dia não é dia de aula do aluno." : "Este aluno não está mais ligado a você, ou o endereço está errado."}</p>
        <Link href={aluno ? ficha : "/agenda/alunos"} className="font-semibold text-brand">
          {aluno ? "Voltar para a ficha" : "Ver meus alunos"}
        </Link>
      </div>
    );

  return (
    <>
      <Cabecalho titulo={`Treino de ${nomeDoDia.toLowerCase()}`}>
        <BotaoVoltar reserva={ficha} className="hover:bg-surface-2" />
      </Cabecalho>
      <div className="flex flex-col gap-4 px-[18px] pb-10">
        <p className="text-[14px] text-ink-3">
          {aluno.nomeCompleto}
          {!diaDeAula && " · este dia não é mais dia de aula"}
        </p>
        <EditorDoTreinoDoDia
          vinculoId={vinculo}
          dia={dia}
          focoInicial={treino.focos[dia] ?? ""}
          exerciciosIniciais={treino.exercicios[dia] ?? []}
          voltar={ficha}
        />
      </div>
    </>
  );
}
