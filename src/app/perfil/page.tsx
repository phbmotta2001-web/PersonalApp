import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPerfilAluno } from "@/components/aluno/FormPerfilAluno";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { Carregando } from "@/components/Formulario";
import { souDaEquipe } from "@/data/equipe";
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

  const equipe = await souDaEquipe();
  return (
    <>
      {equipe && (
        <Link href="/equipe" className="mx-[18px] mt-2 rounded-[14px] border border-line bg-surface px-4 py-3 text-[14.5px] font-bold text-brand">
          ← Voltar ao painel da equipe
        </Link>
      )}
      <FormPerfilAluno conta={conta} voltar={voltar.startsWith("/convite/") || voltar.startsWith("/estudio/aluno/") ? voltar : undefined} />
    </>
  );
}
