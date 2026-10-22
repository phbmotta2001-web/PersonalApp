import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { FormPix } from "@/components/agenda/FormPix";
import { lerPix } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";

export const metadata: Metadata = {
  title: "Chave Pix",
};

export default function PaginaPix() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Chave Pix">
        <BotaoVoltar reserva="/agenda/financeiro" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const personal = await exigirPersonal("/agenda/pix");
  return <FormPix inicial={await lerPix()} nomeSugerido={personal.nomeCompleto} />;
}
