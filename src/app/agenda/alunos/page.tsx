import type { Metadata } from "next";
import { Suspense } from "react";
import { Alunos } from "@/components/agenda/Alunos";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { origemDoSite } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Alunos",
};

export default function PaginaAlunos() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Alunos">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/alunos");
  const [alunos, origem] = await Promise.all([listarMeusAlunos(), origemDoSite()]);
  return <Alunos alunos={alunos} origem={origem} />;
}
