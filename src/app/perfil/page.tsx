import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPerfilAluno } from "@/components/aluno/FormPerfilAluno";
import { AbasAluno } from "@/components/aluno/AbasAluno";
import { Carregando } from "@/components/Formulario";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Meu perfil",
};

// Aba "Meu perfil" da área do aluno. `?voltar=/convite/…` quando o aluno veio de um
// convite: depois de completar o perfil, aparece "voltar ao convite".
export default function PaginaPerfilAluno({ searchParams }: PageProps<"/perfil">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* O perfil depende de quem está logado, então é lido a cada visita. */}
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/perfil">["searchParams"] }) {
  const conta = await exigirAluno("/perfil");
  const [personais, parametros] = await Promise.all([listarMeusPersonais(), searchParams]);
  const voltar = typeof parametros.voltar === "string" ? destinoSeguro(parametros.voltar, "") : "";

  return (
    <>
      <AbasAluno personais={personais} ativa="perfil" />
      <FormPerfilAluno conta={conta} voltar={voltar.startsWith("/convite/") ? voltar : undefined} />
    </>
  );
}
