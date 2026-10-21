import type { Metadata } from "next";
import { Suspense } from "react";
import { FormHorarios } from "@/components/agenda/FormHorarios";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente } from "@/data/expediente";
import { DURACAO_PADRAO } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Horários de trabalho",
};

export default function PaginaHorarios() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Horários de trabalho">
        <BotaoVoltar reserva="/agenda/calendario" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/horarios");
  const expediente = await lerExpediente();
  return <FormHorarios inicial={expediente ?? { duracao: DURACAO_PADRAO, faixas: [] }} />;
}
