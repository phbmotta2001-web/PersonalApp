import type { Metadata } from "next";
import { Suspense } from "react";
import { FormAlunoSemConta } from "@/components/agenda/FormAlunoSemConta";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { agoraEmBrasilia } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Aluno sem app",
};

export default function PaginaNovoAlunoSemConta() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Aluno sem app">
        <BotaoVoltar reserva="/agenda/alunos" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/alunos/novo");
  return <FormAlunoSemConta vinculoId={null} atual={null} hoje={agoraEmBrasilia().data} />;
}
