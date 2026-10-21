import type { Metadata } from "next";
import { Suspense } from "react";
import { FormRegras } from "@/components/agenda/FormRegras";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerRegras } from "@/data/aulas";

export const metadata: Metadata = {
  title: "Regras",
};

export default function PaginaRegras() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Regras">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/regras");
  return <FormRegras inicial={await lerRegras()} />;
}
