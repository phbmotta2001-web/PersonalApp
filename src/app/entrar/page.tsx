import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormEntrar } from "@/components/conta/FormEntrar";
import { Cabecalho, Carregando } from "@/components/Formulario";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function PaginaEntrar() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Entrar">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <FormEntrar />
      </Suspense>
    </div>
  );
}
