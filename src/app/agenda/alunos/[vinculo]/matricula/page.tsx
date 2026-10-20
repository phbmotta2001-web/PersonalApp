import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormMatricula } from "@/components/agenda/FormMatricula";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerFichaDoAluno } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente } from "@/data/expediente";
import { horariosOcupados, lerMatricula } from "@/data/matriculas";
import { lerTabelaDeValores, lerTabelaOnline } from "@/data/precos";
import { agoraEmBrasilia, DURACAO_PADRAO } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Matrícula",
};

export default function PaginaMatricula({ params }: PageProps<"/agenda/alunos/[vinculo]/matricula">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/alunos/[vinculo]/matricula">["params"] }) {
  const { vinculo } = await params;
  await exigirPersonal(`/agenda/alunos/${vinculo}/matricula`);
  const [aluno, atual, expediente, ocupados, tabela, tabelaOnline] = await Promise.all([
    lerFichaDoAluno(vinculo),
    lerMatricula(vinculo),
    lerExpediente(),
    horariosOcupados(vinculo),
    lerTabelaDeValores(),
    lerTabelaOnline(),
  ]);

  if (!aluno)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-6 text-sm text-ink-2">
        <p>Este aluno não está mais ligado a você, ou o endereço está errado.</p>
        <Link href="/agenda/alunos" className="font-semibold text-brand">
          Ver meus alunos
        </Link>
      </div>
    );

  return (
    <>
      <Cabecalho titulo={atual ? "Alterar matrícula" : "Nova matrícula"}>
        <BotaoVoltar reserva={`/agenda/alunos/${vinculo}`} className="hover:bg-surface-2" />
      </Cabecalho>
      <p className="px-[18px] text-[13px] text-ink-3">{aluno.nomeCompleto}</p>
      <FormMatricula
        vinculoId={vinculo}
        nomeAluno={aluno.nomeCompleto}
        atual={atual}
        duracaoPadrao={expediente?.duracao ?? DURACAO_PADRAO}
        faixas={expediente?.faixas ?? []}
        ocupados={ocupados}
        tabela={tabela}
        tabelaOnline={tabelaOnline}
        hoje={agoraEmBrasilia().data}
      />
    </>
  );
}
