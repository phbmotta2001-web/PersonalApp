import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { aulasDeTurmaParaMim, aulasDoEstudio, lerEstudio } from "@/data/estudio";
import { SemanaDoEstudio } from "@/components/estudio/SemanaDoEstudio";
import { exigirPersonal } from "@/data/exigir-personal";
import { AusenciasDoEstudio } from "@/components/estudio/AusenciasDoEstudio";
import { ReposicoesAbertas } from "@/components/estudio/ReposicoesAbertas";
import { AgendarExperimental } from "@/components/estudio/AgendarExperimental";
import { CadastrarAlunoDaEquipe } from "@/components/estudio/CadastrarAlunoDaEquipe";
import { ausenciasDoEstudio, reposicoesAbertas } from "@/data/reposicao";
import { usuarioAtual } from "@/lib/supabase/servidor";
import { DIAS, agoraEmBrasilia, diaDaSemana, instante, minParaHora, somarDias } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Estúdio",
};

// Página do estúdio para o professor (aberta pelo ícone do estúdio no Início).
export default function PaginaEstudioDoProfessor({ params, searchParams }: PageProps<"/agenda/estudio/[estudio]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-6xl">
      <Cabecalho titulo="Estúdio">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
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
  params: PageProps<"/agenda/estudio/[estudio]">["params"];
  searchParams: PageProps<"/agenda/estudio/[estudio]">["searchParams"];
}) {
  const { estudio: id } = await params;
  const { semana: pedida } = await searchParams;
  const personal = await exigirPersonal(`/agenda/estudio/${id}`);
  const hoje = agoraEmBrasilia().data;
  // Decisão 78: a semana do estúdio como no painel da coordenação (domingo a sábado).
  const base = typeof pedida === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoje;
  const domingo = somarDias(base, -diaDaSemana(base));
  const [estudio, aulas, semana, reposicoes, ausencias, { id: eu }] = await Promise.all([
    lerEstudio(id),
    aulasDeTurmaParaMim(new Date().toISOString(), instante(somarDias(hoje, 7), 0).toISOString()),
    aulasDoEstudio(id, instante(domingo, 0).toISOString(), instante(somarDias(domingo, 7), 0).toISOString()),
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

      <AgendarExperimental
        estudioId={id}
        estudioNome={estudio.nome}
        equipe={estudio.equipe.map((m) => ({ personalId: m.personalId, nome: m.nome }))}
        hoje={hoje}
        soDoProfessor={estudio.papel === "coordenacao" ? null : eu}
      />

      {/* Decisão 98: o professor cadastra alunos (nas turmas dele, se quiser). */}
      <CadastrarAlunoDaEquipe
        estudioId={id}
        estudioNome={estudio.nome}
        turmas={estudio.turmas
          .filter((t) => t.tipo === "turma" && (estudio.papel === "coordenacao" || t.professorId === eu))
          .sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin)
          .map((t) => ({
            id: t.id,
            nome: `${t.modalidade} · ${DIAS[t.diaSemana].curto} ${minParaHora(t.inicioMin)}`,
            livres: t.vagas - t.alunos.length,
          }))}
      />

      {estudio.papel === "coordenacao" && (
        <Link href={`/estudio/${id}`} className="rounded-[16px] border border-line bg-surface px-4 py-3 font-bold text-estudio">
          Coordenação: turmas, professores e alunos ›
        </Link>
      )}

      <SemanaDoEstudio key={domingo} estudio={estudio} aulas={semana} segunda={domingo} hoje={hoje} base={`/agenda/estudio/${id}`} />

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
