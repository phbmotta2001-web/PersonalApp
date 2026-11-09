import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { ChamadaDaTurma } from "@/components/estudio/ChamadaDaTurma";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerAulaParaChamada } from "@/data/estudio";
import { exigirPersonal } from "@/data/exigir-personal";
import { emBrasilia } from "@/lib/expediente";
import { textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Chamada",
};

export default function PaginaChamada({ params }: PageProps<"/agenda/turma/[aula]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Chamada">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/turma/[aula]">["params"] }) {
  const { aula: id } = await params;
  await exigirPersonal(`/agenda/turma/${id}`);
  const aula = await lerAulaParaChamada(id);
  if (!aula) notFound();
  const abre = Date.parse(aula.inicio) - 30 * 60_000;
  const aberta = new Date().getTime() >= abre;
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-10">
      <section className="flex flex-col gap-1 rounded-[20px] bg-estudio p-4 text-white">
        <span className="text-[13px] opacity-85">{aula.estudioNome}</span>
        <span className="font-display text-[24px] leading-tight font-extrabold">
          {emBrasilia(aula.inicio).hora} · {aula.modalidade}
        </span>
        <span className="text-[14px] opacity-85">
          {textoDaAula(aula.inicio, null)} · {aula.alunos.length} de {aula.vagas} vagas
        </span>
        {aula.chamadaEm && <span className="mt-1 text-[13px] font-bold">Chamada feita</span>}
      </section>
      {aula.cancelada ? (
        <p className="text-ink-2">Esta aula foi cancelada.</p>
      ) : !aberta ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-2">A chamada abre 30 minutos antes da aula, às {emBrasilia(new Date(abre).toISOString()).hora}.</p>
          <h2 className="pt-2 text-[16px] font-bold">Alunos da turma ({aula.alunos.length})</h2>
          <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
            {aula.alunos.map((a) => (
              <li key={a.id} className="py-2.5 font-semibold">
                {a.nome}
                {a.situacao === "falta_avisada" && <span className="ml-2 text-[13px] text-gold">vai faltar</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : aula.alunos.length === 0 ? (
        <p className="text-ink-2">Nenhum aluno nesta turma ainda. A coordenação inclui os alunos.</p>
      ) : (
        <ChamadaDaTurma aulaId={aula.id} alunos={aula.alunos} feita={aula.chamadaEm !== null} />
      )}
    </div>
  );
}
