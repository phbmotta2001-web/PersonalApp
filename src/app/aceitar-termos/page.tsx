import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormAceiteDosTermos } from "@/components/conta/FormAceiteDosTermos";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { tipoDaConta } from "@/data/conta";
import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

/** Decisão 109: quem já tinha conta aceita os Termos e a Política antes de seguir no app. */
export default function PaginaAceitarTermos({ searchParams }: PageProps<"/aceitar-termos">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Termos de Uso" />
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/aceitar-termos">["searchParams"] }) {
  const tipo = await tipoDaConta();
  if (!tipo) redirect("/entrar");
  const { voltar } = await searchParams;
  const destino = destinoSeguro(voltar, tipo === "personal" ? "/agenda" : "/aluno");
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <p className="text-[15px] text-ink-2">
        Publicamos os Termos de Uso e a Política de Privacidade do P-Bell. Para continuar usando o app, leia e marque a caixa abaixo.
      </p>
      <FormAceiteDosTermos profissional={tipo === "personal"} voltar={destino} />
    </div>
  );
}
