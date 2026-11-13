import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgendaDoAlunoNoEstudio } from "@/components/aluno/AgendaDoAlunoNoEstudio";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { agendaDoAlunoNoEstudio, meusEstudiosComoAluno, meuTreinoNoEstudio, minhaFilaDeEspera, minhasReposicoesNoEstudio } from "@/data/aluno-estudio";
import { exigirAluno } from "@/data/exigir-aluno";
import { agoraEmBrasilia, dataCurta, DIAS, somarDias } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Estúdio",
};

// Agenda do estúdio para o aluno (decisão 61): a semana com as vagas de cada turma.
export default function PaginaEstudioDoAluno({ params, searchParams }: PageProps<"/aluno/estudio/[estudio]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-6xl">
      <Cabecalho titulo="Estúdio">
        <BotaoVoltar reserva="/aluno" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
      <BarraDoAluno />
    </div>
  );
}

const SEMANAS = 7;

async function Conteudo({
  params,
  searchParams,
}: {
  params: PageProps<"/aluno/estudio/[estudio]">["params"];
  searchParams: PageProps<"/aluno/estudio/[estudio]">["searchParams"];
}) {
  const { estudio: id } = await params;
  const { semana } = await searchParams;
  await exigirAluno(`/aluno/estudio/${id}`);
  const estudio = (await meusEstudiosComoAluno()).find((e) => e.id === id);
  if (!estudio) notFound();
  const hoje = agoraEmBrasilia().data;
  const n = typeof semana === "string" && /^\d$/.test(semana) ? Math.min(Number(semana), SEMANAS) : 0;
  const inicio = somarDias(hoje, n * 7);
  const fim = somarDias(inicio, 6);
  const [aulas, reposicoes, treino, fila] = await Promise.all([
    agendaDoAlunoNoEstudio(id, inicio, fim),
    minhasReposicoesNoEstudio(id),
    meuTreinoNoEstudio(id),
    minhaFilaDeEspera(),
  ]);
  const link = (x: number) => `/aluno/estudio/${id}${x ? `?semana=${x}` : ""}`;

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-28 lg:px-8">
      <section className="flex flex-col gap-1 rounded-[20px] bg-estudio p-4 text-white">
        <span className="font-display text-[24px] leading-tight font-extrabold">{estudio.nome}</span>
        <span className="text-[14px] opacity-90">
          {reposicoes.length === 0
            ? `Sem reposições no momento. Avise a falta com ${estudio.faltaH} h de antecedência para ganhar uma.`
            : `Você tem ${reposicoes.length} ${reposicoes.length === 1 ? "reposição" : "reposições"}: ${reposicoes
                .map((r) => `${r.modalidade} (até ${dataCurta(r.validoAte)})`)
                .join(", ")}. Toque numa turma para repor, mudar seus dias ou entrar na lista de espera.`}
        </span>
      </section>

      {/* Decisão 73: o que treina em cada dia, escrito pelo professor. */}
      {treino.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Seu treino">
          <h2 className="text-[17px] font-bold">Seu treino</h2>
          <ul className="flex flex-col gap-1.5">
            {[...treino]
              .sort((a, b) => a.dia - b.dia)
              .map((t) => (
                <li key={t.dia} className="flex gap-3 text-[15px]">
                  <span className="w-20 shrink-0 font-bold">{DIAS.find((d) => d.valor === t.dia)?.nome}</span>
                  <span className="whitespace-pre-line text-ink-2">{t.texto}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <nav className="flex items-center gap-2" aria-label="Semana">
        {n > 0 ? (
          <Link href={link(n - 1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Semana anterior">
            ‹
          </Link>
        ) : (
          <span className="size-10" />
        )}
        <h2 className="flex-1 text-center text-[16px] font-bold">
          {dataCurta(inicio)} a {dataCurta(fim)}
        </h2>
        {n < SEMANAS ? (
          <Link href={link(n + 1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próxima semana">
            ›
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </nav>

      <AgendaDoAlunoNoEstudio
        estudio={estudio}
        aulas={aulas}
        reposicoes={reposicoes}
        fila={fila.filter((f) => f.estudioId === id)}
        inicio={inicio}
        hoje={hoje}
        agora={new Date().getTime()}
      />

      <p className="text-[13px] text-ink-3">
        Reposição: só na mesma modalidade, com pelo menos {estudio.marcarH} h de antecedência, e vale {estudio.validadeDias} dias. O professor é
        avisado na hora.
      </p>
    </div>
  );
}
