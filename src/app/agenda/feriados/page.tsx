import type { Metadata } from "next";
import { Suspense } from "react";
import { FormFeriados } from "@/components/agenda/FormFeriados";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerRegraDeFeriados } from "@/data/feriados";
import { agoraEmBrasilia, somarDias } from "@/lib/expediente";
import { feriadosEntre } from "@/lib/feriados";

export const metadata: Metadata = {
  title: "Feriados",
};

export default function PaginaFeriados() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Feriados">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/feriados");
  const hoje = agoraEmBrasilia().data;
  return <FormFeriados inicial={await lerRegraDeFeriados()} feriados={feriadosEntre(hoje, somarDias(hoje, 365))} />;
}
