import type { Metadata } from "next";
import { Suspense } from "react";
import { Bloqueios } from "@/components/agenda/Bloqueios";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarBloqueios } from "@/data/expediente";

export const metadata: Metadata = {
  title: "Bloqueios",
};

export default function PaginaBloqueios() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Bloqueios">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/bloqueios");
  return <Bloqueios bloqueios={await listarBloqueios(true)} />;
}
