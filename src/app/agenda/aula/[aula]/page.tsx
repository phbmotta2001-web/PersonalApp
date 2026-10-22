import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcoesDaAula } from "@/components/agenda/AcoesDaAula";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerAntecedencia, lerAula } from "@/data/aulas";
import { exigirPersonal } from "@/data/exigir-personal";

export const metadata: Metadata = {
  title: "Aula",
};

export default function PaginaAula({ params }: PageProps<"/agenda/aula/[aula]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Aula">
        <BotaoVoltar reserva="/agenda/calendario" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/aula/[aula]">["params"] }) {
  const { aula: id } = await params;
  await exigirPersonal(`/agenda/aula/${id}`);
  const [aula, antecedenciaH] = await Promise.all([lerAula(id), lerAntecedencia()]);
  if (!aula)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-[15px] text-ink-2">
        <p>Aula não encontrada.</p>
        <Link href="/agenda/calendario" className="font-semibold text-brand">
          Voltar para a agenda
        </Link>
      </div>
    );
  return <AcoesDaAula aula={aula} antecedenciaH={antecedenciaH} agora={new Date().toISOString()} />;
}
