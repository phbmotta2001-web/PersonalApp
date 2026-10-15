import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TelaBusca } from "@/components/busca/TelaBusca";
import { Carregando } from "@/components/Formulario";
import { lerContaAtual } from "@/data/alunos";
import { listarPersonais } from "@/data/personais";
import { personalAtendeAluno } from "@/lib/filtros";
import { MARKETPLACE_ATIVO } from "@/lib/recursos";

// Marketplace (Fase 2) desligado: a página responde "não encontrada", então o
// pré-teste de navegação instantânea do Next.js não se aplica a ela.
export const instant = false;

export const metadata: Metadata = {
  title: "Buscar personais",
};

export default function PaginaBusca() {
  // Marketplace (Fase 2): desligado na Fase 1. Ver src/lib/recursos.ts.
  if (!MARKETPLACE_ATIVO) notFound();

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
