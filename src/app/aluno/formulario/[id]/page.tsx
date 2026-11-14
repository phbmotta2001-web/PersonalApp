import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResponderQuestionario } from "@/components/aluno/ResponderQuestionario";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirAluno } from "@/data/exigir-aluno";
import { lerFormularioParaResponder, responderFormularioDoEstudio } from "@/data/formularios-estudio";

export const metadata: Metadata = {
  title: "Formulário",
};

const AJUDA = {
  parq: "Perguntas rápidas sobre sua saúde antes de treinar. Responda com sinceridade.",
  anamnese: "Conte um pouco sobre você: o professor lê antes da sua primeira aula.",
  pesquisa: "Suas respostas vão para a coordenação do estúdio.",
} as const;

// Decisão 97: o aluno responde um formulário do estúdio (ParQ, anamnese ou pesquisa).
export default function PaginaFormulario({ params }: PageProps<"/aluno/formulario/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Formulário">
        <BotaoVoltar reserva="/aluno" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/formulario/[id]">["params"] }) {
  const { id } = await params;
  await exigirAluno(`/aluno/formulario/${id}`);
  const f = await lerFormularioParaResponder(id);
  if (!f)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-[15px] text-ink-2">
        <p>Formulário não encontrado. Confira se entrou com a sua conta de aluno.</p>
        <Link href="/aluno" className="font-semibold text-brand">
          Ir para a minha área
        </Link>
      </div>
    );
  const voltar = `/aluno/estudio/${f.estudioId}`;
  if (f.respondidoEm)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-[15px] text-ink-2">
        <p className="rounded-[14px] bg-ok-soft p-3 text-ok">Você já respondeu este formulário. Obrigado!</p>
        <Link href={voltar} className="font-semibold text-brand">
          Voltar
        </Link>
      </div>
    );
  return (
    <>
      <p className="px-[18px] pb-1 text-[17px] font-extrabold">{f.titulo}</p>
      <p className="px-[18px] pb-2 text-[13px] text-ink-3">{AJUDA[f.tipo]}</p>
      <ResponderQuestionario checkinId={f.id} perguntas={f.perguntas} voltar={voltar} enviar={responderFormularioDoEstudio.bind(null, f.id)} />
    </>
  );
}
