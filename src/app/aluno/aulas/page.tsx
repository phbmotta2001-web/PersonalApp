import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AulasDoAluno } from "@/components/aluno/AulasDoAluno";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { regrasParaAluno } from "@/data/aluno-aulas";
import { reposicoesDisponiveis } from "@/data/aulas";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { lerMatricula, matriculasSuspensas, pedidosRecusadosDoAluno, proximasAulasDoAluno } from "@/data/matriculas";
import { resumoDaModalidade, resumoDosHorarios } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Minhas aulas",
};

export default function PaginaAulasDoAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoAluno />
    </div>
  );
}

// Aba "Aulas" do aluno: as próximas aulas com cada personal, com cancelar, remarcar e reposição.
async function Conteudo() {
  await exigirAluno("/aluno/aulas");
  const [personais, suspensas] = await Promise.all([listarMeusPersonais(), matriculasSuspensas()]);
  const blocos = await Promise.all(
    personais.map(async (p) => {
      const [matricula, aulas, reposicoes, regras, recusados] = await Promise.all([
        lerMatricula(p.vinculoId),
        proximasAulasDoAluno(p.vinculoId),
        reposicoesDisponiveis(p.vinculoId),
        regrasParaAluno(p.vinculoId),
        pedidosRecusadosDoAluno(p.vinculoId),
      ]);
      return { p, matricula, aulas, reposicoes, regras, recusados };
    }),
  );
  const agora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Minhas aulas</h1>
      {blocos.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-[14px] text-ink-3">
          Você ainda não treina com nenhum personal pelo P-Bell. Peça o link de convite ao seu personal.
        </p>
      )}
      {blocos.map(({ p, matricula, aulas, reposicoes, regras, recusados }) => {
        const primeiro = p.nome.split(" ")[0];
        return (
          <section key={p.vinculoId} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label={`Aulas com ${primeiro}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold">Com {primeiro}</h2>
                <p className="text-[14px] text-ink-3">
                  {matricula
                    ? matricula.modalidade === "online"
                      ? resumoDaModalidade(matricula)
                      : resumoDosHorarios(matricula.horarios, matricula.intervaloSemanas)
                    : "Sem horários fixos ainda"}
                </p>
              </div>
              <Link href={`/aluno/personal/${p.vinculoId}`} className="text-[14px] font-semibold text-brand">
                Detalhes ›
              </Link>
            </div>
            {suspensas[p.vinculoId] ? (
              <Link
                href="/aluno/pagamentos"
                className="flex items-center gap-2 rounded-[14px] border-2 border-bad bg-bad/5 p-3 text-[14px] text-bad"
              >
                <Icone nome="cadeado" className="size-5 shrink-0" />
                <span>
                  <strong>Matrícula suspensa.</strong> Pague a mensalidade para voltar a cancelar, remarcar e marcar aulas.
                </span>
              </Link>
            ) : aulas.length > 0 || reposicoes.length > 0 || recusados.length > 0 ? (
              <AulasDoAluno
                vinculoId={p.vinculoId}
                nomePersonal={p.nome}
                aulas={aulas.map((a) => ({
                  id: a.id,
                  inicio: a.inicio,
                  local: a.local,
                  origem: a.origem,
                  situacao: a.situacao,
                  propostaPor: a.propostaPor,
                  aulaOriginalId: a.aulaOriginalId,
                }))}
                recusados={recusados}
                reposicoes={reposicoes.map((r) => r.validoAte)}
                regras={regras}
                agora={agora}
              />
            ) : (
              <p className="text-[14px] text-ink-3">Nenhuma aula marcada. Quando {primeiro} marcar, elas aparecem aqui.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
