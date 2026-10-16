import type { Metadata } from "next";
import { Suspense } from "react";
import { FormNovaAula } from "@/components/agenda/FormNovaAula";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { reposicoesPorAluno } from "@/data/aulas";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente } from "@/data/expediente";
import { lerMatricula } from "@/data/matriculas";
import { agoraEmBrasilia, DURACAO_PADRAO } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Nova aula",
};

export default function PaginaNovaAula({ searchParams }: PageProps<"/agenda/aula/nova">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Nova aula">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/aula/nova">["searchParams"] }) {
  await exigirPersonal("/agenda/aula/nova");
  const { dia } = await searchParams;
  const hoje = agoraEmBrasilia().data;
  const diaInicial = typeof dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= hoje ? dia : hoje;

  const [todos, reposicoes, expediente] = await Promise.all([listarMeusAlunos(), reposicoesPorAluno(), lerExpediente()]);
  const ativos = todos.filter((a) => a.situacao === "ativo");
  // O local da matrícula de cada aluno já vem preenchido.
  const matriculas = await Promise.all(ativos.map((a) => lerMatricula(a.vinculoId)));
  const alunos = ativos.map((a, i) => ({ vinculoId: a.vinculoId, nome: a.nome, local: matriculas[i]?.local ?? null }));

  return (
    <FormNovaAula
      alunos={alunos}
      reposicoes={reposicoes}
      duracaoPadrao={expediente?.duracao ?? DURACAO_PADRAO}
      diaInicial={diaInicial}
    />
  );
}
