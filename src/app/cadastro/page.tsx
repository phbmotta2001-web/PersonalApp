import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormCadastro } from "@/components/conta/FormCadastro";
import { Cabecalho, Carregando } from "@/components/Formulario";

export const metadata: Metadata = {
  title: "Criar conta",
};

export default function PaginaCadastro() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Criar conta">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <FormCadastro />
      </Suspense>
    </div>
  );
}
