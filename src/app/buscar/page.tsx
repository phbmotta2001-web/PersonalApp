import type { Metadata } from "next";
import { Suspense } from "react";
import { TelaBusca } from "@/components/busca/TelaBusca";
import { Carregando } from "@/components/Formulario";
import { lerContaAtual } from "@/data/alunos";
import { listarPersonais } from "@/data/personais";
import { personalAtendeAluno } from "@/lib/filtros";

export const metadata: Metadata = {
  title: "Buscar personais",
};

export default function PaginaBusca() {
  // A lista depende do gênero de quem está logado, então é montada a cada visita.
  return (
    <Suspense fallback={<Carregando />}>
      <Busca />
    </Suspense>
  );
}

async function Busca() {
  const [personais, conta] = await Promise.all([listarPersonais(), lerContaAtual()]);
  const genero = conta?.perfil.genero ?? null;
  return <TelaBusca personais={personais.filter((p) => personalAtendeAluno(p.publico, genero))} />;
}
