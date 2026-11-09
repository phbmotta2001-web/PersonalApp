import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { AgendaDoEstudio } from "@/components/estudio/AgendaDoEstudio";
import { BotaoSair } from "@/components/estudio/BotaoSair";
import { GestaoDoEstudio, type Aba } from "@/components/estudio/GestaoDoEstudio";
import { Carregando } from "@/components/Formulario";
import { souContaEmpresa } from "@/data/conta";
import { aulasDoEstudio, lerEstudio } from "@/data/estudio";
import { lerFinanceiroDoMes } from "@/data/estudio-financeiro";
import { exigirPersonal } from "@/data/exigir-personal";
import { diaDaSemana, emBrasilia, instante, somarDias } from "@/lib/expediente";

const ABAS: Aba[] = ["agenda", "turmas", "equipe", "alunos", "financeiro", "ajustes"];

export const metadata: Metadata = {
  title: "Coordenação do estúdio",
};

export default function PaginaEstudio({ params, searchParams }: PageProps<"/estudio/[estudio]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-[18px] pt-2 pb-12">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({
  params,
  searchParams,
}: {
  params: PageProps<"/estudio/[estudio]">["params"];
  searchParams: PageProps<"/estudio/[estudio]">["searchParams"];
}) {
  const { estudio: id } = await params;
  const { aba, mes, semana } = await searchParams;
  await exigirPersonal(`/estudio/${id}`);
  const [estudio, empresa] = await Promise.all([lerEstudio(id), souContaEmpresa()]);
  if (!estudio || estudio.papel !== "coordenacao") notFound();
  const qual = ABAS.find((a) => a === aba) ?? "agenda";
  const hoje = emBrasilia(new Date().toISOString()).data;
  const mesEscolhido = typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7);
  const financeiro =
    qual === "financeiro" ? { mes: mesEscolhido, hoje, dados: await lerFinanceiroDoMes(estudio.id, `${mesEscolhido}-01`) } : undefined;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5 pt-1.5">
        {!empresa && <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />}
        <div className="flex-1">
          <p className="text-[13px] text-ink-3">Coordenação</p>
          <h1 className="text-[24px] leading-tight font-extrabold">{estudio.nome}</h1>
        </div>
        {empresa && <BotaoSair />}
      </header>
      <GestaoDoEstudio estudio={estudio} aba={qual} financeiro={financeiro} agenda={qual === "agenda" ? await agendaDaSemana(estudio, hoje, semana) : undefined} />
    </div>
  );
}

/** A grade da semana (segunda a domingo); `semana` desloca a partir da semana de hoje. */
async function agendaDaSemana(estudio: NonNullable<Awaited<ReturnType<typeof lerEstudio>>>, hoje: string, semana: string | string[] | undefined) {
  const n = typeof semana === "string" && /^-?\d{1,3}$/.test(semana) ? Number(semana) : 0;
  const segunda = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7) + n * 7);
  const aulas = await aulasDoEstudio(estudio.id, instante(segunda, 0).toISOString(), instante(somarDias(segunda, 7), 0).toISOString());
  return <AgendaDoEstudio estudio={estudio} aulas={aulas} inicioSemana={segunda} semana={n} hoje={hoje} />;
}
