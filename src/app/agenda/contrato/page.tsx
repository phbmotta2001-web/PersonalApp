import type { Metadata } from "next";
import { Suspense } from "react";
import { FormContrato } from "@/components/agenda/FormContrato";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerContrato } from "@/data/contrato";

export const metadata: Metadata = {
  title: "Contrato",
};

export default function PaginaContrato() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-2xl">
      <Cabecalho titulo="Contrato">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/contrato");
  return <FormContrato inicial={await lerContrato()} />;
}
