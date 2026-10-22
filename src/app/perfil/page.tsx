import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPerfilAluno } from "@/components/aluno/FormPerfilAluno";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { Carregando } from "@/components/Formulario";
import { exigirAluno } from "@/data/exigir-aluno";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Meu perfil",
};

// Aba "Perfil" da área do aluno. `?voltar=/convite/…` quando o aluno veio de um
// convite: depois de completar o perfil, aparece "voltar ao convite".
export default function PaginaPerfilAluno({ searchParams }: PageProps<"/perfil">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* O perfil depende de quem está logado, então é lido a cada visita. */}
      <h1 className="px-[18px] pt-5 text-[24px] font-extrabold">Perfil</h1>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
      <div className="h-28" aria-hidden="true" />
      <BarraDoAluno />
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/perfil">["searchParams"] }) {
  const conta = await exigirAluno("/perfil");
  const parametros = await searchParams;
  const voltar = typeof parametros.voltar === "string" ? destinoSeguro(parametros.voltar, "") : "";

  return (
    <FormPerfilAluno conta={conta} voltar={voltar.startsWith("/convite/") ? voltar : undefined} />
  );
}
