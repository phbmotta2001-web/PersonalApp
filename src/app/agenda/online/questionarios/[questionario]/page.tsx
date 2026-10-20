import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { EditorQuestionario } from "@/components/online/EditorQuestionario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerQuestionario } from "@/data/questionarios";

export const metadata: Metadata = {
  title: "Questionário",
};

export default function PaginaQuestionario({ params }: PageProps<"/agenda/online/questionarios/[questionario]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Questionário">
        <BotaoVoltar reserva="/agenda/online/questionarios" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/online/questionarios/[questionario]">["params"] }) {
  const { questionario: id } = await params;
  await exigirPersonal(`/agenda/online/questionarios/${id}`);
  if (id === "novo") return <EditorQuestionario id={null} nomeInicial="" perguntasIniciais={[]} />;
  const q = await lerQuestionario(id);
  if (!q)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
        <p>Questionário não encontrado.</p>
        <Link href="/agenda/online/questionarios" className="font-semibold text-brand">
          Ver questionários
        </Link>
      </div>
    );
  return <EditorQuestionario id={q.id} nomeInicial={q.nome} perguntasIniciais={q.perguntas} />;
}
