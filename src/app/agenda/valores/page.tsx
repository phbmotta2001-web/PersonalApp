import type { Metadata } from "next";
import { Suspense } from "react";
import { FormValores } from "@/components/agenda/FormValores";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerTabelaDeValores } from "@/data/precos";

export const metadata: Metadata = {
  title: "Valores",
};

export default function PaginaValores() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Valores das aulas">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/valores");
  return <FormValores inicial={await lerTabelaDeValores()} />;
}
