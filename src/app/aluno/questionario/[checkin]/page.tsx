import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResponderQuestionario } from "@/components/aluno/ResponderQuestionario";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirAluno } from "@/data/exigir-aluno";
import { lerCheckinDoAluno } from "@/data/questionarios";

export const metadata: Metadata = {
  title: "Questionário",
};

export default function PaginaResponder({ params }: PageProps<"/aluno/questionario/[checkin]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Questionário">
        <BotaoVoltar reserva="/aluno" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/questionario/[checkin]">["params"] }) {
  const { checkin: id } = await params;
  await exigirAluno(`/aluno/questionario/${id}`);
  const c = await lerCheckinDoAluno(id);
  const voltar = c ? `/aluno/personal/${c.vinculoId}` : "/aluno";
  if (!c)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
        <p>Questionário não encontrado. Confira se entrou com a sua conta de aluno.</p>
        <Link href="/aluno" className="font-semibold text-brand">
          Ir para a minha área
        </Link>
      </div>
    );
  if (c.respondidoEm)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
        <p className="rounded-[14px] bg-ok-soft p-3 text-ok">Você já respondeu este questionário. Obrigado!</p>
        <Link href={voltar} className="font-semibold text-brand">
          Voltar
        </Link>
      </div>
    );
  return (
    <>
      <p className="px-[18px] pb-1 text-[17px] font-extrabold">{c.titulo}</p>
      <p className="px-[18px] pb-2 text-xs text-ink-3">Suas respostas vão para o seu personal. Leva uns 2 minutos.</p>
      <ResponderQuestionario checkinId={c.id} perguntas={c.perguntas} voltar={voltar} />
    </>
  );
}
