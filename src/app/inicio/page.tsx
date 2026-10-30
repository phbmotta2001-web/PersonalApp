import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/components/Formulario";
import { tipoDaConta } from "@/data/conta";

export const metadata: Metadata = {
  title: { absolute: "Kout" },
};

// Onde o app instalado abre: cada um vai para a sua área.
export default function PaginaInicio() {
  return (
    <Suspense fallback={<Carregando />}>
      <Encaminhar />
    </Suspense>
  );
}

async function Encaminhar(): Promise<null> {
  const tipo = await tipoDaConta();
  redirect(tipo === "personal" ? "/agenda" : tipo === "aluno" ? "/aluno" : "/entrar");
}
