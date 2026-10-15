import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormPerfilAluno } from "@/components/aluno/FormPerfilAluno";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerContaAtual } from "@/data/alunos";
import { tipoDaConta } from "@/data/conta";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default function PaginaPerfilAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Meu perfil">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      {/* O perfil depende de quem está logado, então é lido a cada visita. */}
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const conta = await lerContaAtual();
  if (!conta) {
    // Personal logado vai para a área dele; ninguém logado vai para Entrar.
    if ((await tipoDaConta()) === "personal") redirect("/agenda");
    redirect("/entrar?voltar=/perfil");
  }
  return <FormPerfilAluno conta={conta} />;
}
