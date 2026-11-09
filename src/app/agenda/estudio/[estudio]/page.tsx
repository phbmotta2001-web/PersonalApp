import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { aulasDeTurmaParaMim, lerEstudio } from "@/data/estudio";
import { exigirPersonal } from "@/data/exigir-personal";
import { AusenciasDoEstudio } from "@/components/estudio/AusenciasDoEstudio";
import { ReposicoesAbertas } from "@/components/estudio/ReposicoesAbertas";
import { ausenciasDoEstudio, reposicoesAbertas } from "@/data/reposicao";
import { usuarioAtual } from "@/lib/supabase/servidor";
import { agoraEmBrasilia, emBrasilia, instante, somarDias } from "@/lib/expediente";
import { textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Estúdio",
};

// Página do estúdio para o professor (aberta pelo ícone do estúdio no Início).
export default function PaginaEstudioDoProfessor({ params }: PageProps<"/agenda/estudio/[estudio]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-2xl">
      <Cabecalho titulo="Estúdio">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/estudio/[estudio]">["params"] }) {
  const { estudio: id } = await params;
  const personal = await exigirPersonal(`/agenda/estudio/${id}`);
  const hoje = agoraEmBrasilia().data;
  const [estudio, aulas, reposicoes, ausencias, { id: eu }] = await Promise.all([
    lerEstudio(id),
    aulasDeTurmaParaMim(new Date().toISOString(), instante(somarDias(hoje, 7), 0).toISOString()),
    reposicoesAbertas(id),
    ausenciasDoEstudio(id),
    usuarioAtual(),
  ]);
  if (!estudio) notFound();
  const minhas = aulas.filter((a) => a.estudioId === id && !a.cancelada);
  const minhasTurmas = estudio.turmas.filter((t) => minhas.some((a) => a.turmaId === t.id));
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-10">
      <section className="flex flex-col gap-1 rounded-[20px] bg-estudio p-4 text-white">
        <span className="text-[13px] opacity-85">{estudio.papel === "coordenacao" ? "Você coordena" : "Você é professor"}</span>
        <span className="font-display text-[26px] leading-tight font-extrabold">{estudio.nome}</span>
        <span className="text-[14px] opacity-85">
          {minhas.length} aula{minhas.length === 1 ? "" : "s"} suas nos próximos 7 dias · {estudio.alunos.length} alunos no estúdio
        </span>
      </section>

      <ReposicoesAbertas reposicoes={reposicoes} />

      {estudio.papel === "coordenacao" && (
        <Link href={`/estudio/${id}`} className="rounded-[16px] border border-line bg-surface px-4 py-3 font-bold text-estudio">
          Coordenação: turmas, professores e alunos ›
        </Link>
      )}

      <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Suas próximas aulas">
        <h2 className="pb-1 text-[16px] font-semibold">Suas próximas aulas no estúdio</h2>
        {minhas.length === 0 ? (
          <p className="pb-1 text-[14px] text-ink-3">Nenhuma aula sua nos próximos 7 dias.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {minhas.map((a) => (
              <li key={a.id}>
                <Link href={`/agenda/turma/${a.id}`} className="flex items-center gap-3 py-2.5">
                  <span className="w-[52px] shrink-0 font-extrabold tabular-nums">{emBrasilia(a.inicio).hora}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.modalidade}</span>
                    <span className="block text-[13px] text-ink-3">{textoDaAula(a.inicio, null).split(" às ")[0]}</span>
                  </span>
                  <span className="rounded-full bg-estudio-soft px-2 py-0.5 text-[12.5px] font-bold text-estudio">
                    {a.turno ? "turno" : `${a.alunos}/${a.vagas}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {eu && (
        <AusenciasDoEstudio
          estudioId={id}
          estudioNome={estudio.nome}
          equipe={estudio.equipe.map((m) => ({ personalId: m.personalId, nome: m.nome }))}
          fixo={{ personalId: eu, nome: personal.nomeCompleto }}
          ausencias={ausencias}
        />
      )}

      {minhasTurmas.length > 0 && (
        <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Seus alunos no estúdio">
          <h2 className="pb-1 text-[16px] font-semibold">Seus alunos no estúdio</h2>
          {minhasTurmas.map((t) => (
            <div key={t.id} className="py-1.5">
              <p className="text-[13px] font-bold text-estudio">{t.modalidade}</p>
              <p className="text-[14.5px] text-ink-2">
                {t.alunos.length
                  ? t.alunos.map((aid) => estudio.alunos.find((a) => a.id === aid)?.nome).filter(Boolean).join(", ")
                  : "Sem alunos ainda"}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Equipe">
        <h2 className="pb-1 text-[16px] font-semibold">Equipe</h2>
        <ul className="flex flex-col divide-y divide-line">
          {estudio.equipe.map((m) => (
            <li key={m.personalId} className="flex items-center py-2 text-[15px]">
              <span className="flex-1">{m.nome}</span>
              <span className="text-[13px] text-ink-3">{m.papel === "coordenacao" ? "coordenação" : "professor"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
