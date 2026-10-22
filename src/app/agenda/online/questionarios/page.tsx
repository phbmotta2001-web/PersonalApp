import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarQuestionarios } from "@/data/questionarios";

export const metadata: Metadata = {
  title: "Questionários",
};

export default function PaginaQuestionarios() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Questionários">
        <BotaoVoltar reserva="/agenda/online" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/online/questionarios");
  const questionarios = await listarQuestionarios();
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <p className="text-[14px] text-ink-2">
        Seus modelos de questionário. Depois, na página de cada aluno online, você escolhe qual enviar e quando (toda semana,
        a cada 15 dias ou todo mês).
      </p>
      <ul className="flex flex-col gap-2">
        {questionarios.map((q) => (
          <li key={q.id}>
            <Link
              href={`/agenda/online/questionarios/${q.id}`}
              className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 hover:border-brand"
            >
              <span className="grid size-9 place-items-center rounded-full bg-info-soft text-info">
                <Icone nome="conversa" className="size-[18px]" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-bold">{q.nome}</span>
                <span className="block text-[13px] text-ink-3">
                  {q.perguntas.length} pergunta{q.perguntas.length === 1 ? "" : "s"} · toque para editar
                </span>
              </span>
              <span className="text-ink-3" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/agenda/online/questionarios/novo"
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-brand text-[15px] font-bold text-brand"
      >
        <Icone nome="mais" className="size-4" /> Novo questionário
      </Link>
    </div>
  );
}
