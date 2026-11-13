import Link from "next/link";
import { Alunos, type DetalheDoAluno, type FiltroAluno } from "@/components/agenda/Alunos";
import { Icone } from "@/components/Icone";
import { listarMeusAlunos } from "@/data/convites";
import { alunosComAtraso } from "@/data/cobrancas";
import { AlunoDoEstudioNaLista } from "@/components/estudio/AlunoDoEstudioNaLista";
import { alunosDasMinhasTurmas } from "@/data/estudio";
import { exigirPersonal } from "@/data/exigir-personal";
import { matriculasAtivasPorAluno, matriculasSuspensas } from "@/data/matriculas";
import { alunosEmPausa } from "@/data/pausas";
import { agoraEmBrasilia } from "@/lib/expediente";
import { resumoDaModalidade, resumoDosHorarios } from "@/lib/matricula";
import { origemDoSite } from "@/lib/supabase/servidor";

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Lista de alunos (busca, filtros, etiquetas): coluna da esquerda no computador. */
export async function ListaDeAlunos() {
  await exigirPersonal("/agenda/alunos");
  const hoje = agoraEmBrasilia().data;
  const [alunos, origem, comAtraso, suspensas, matriculas, pausas, doEstudio] = await Promise.all([
    listarMeusAlunos(),
    origemDoSite(),
    alunosComAtraso(hoje),
    matriculasSuspensas(),
    matriculasAtivasPorAluno(),
    alunosEmPausa(hoje),
    alunosDasMinhasTurmas(),
  ]);

  // Uma etiqueta por aluno, na ordem do que mais pede atenção.
  const detalhes: Record<string, DetalheDoAluno> = {};
  let online = 0;
  for (const a of alunos.filter((x) => x.situacao === "ativo")) {
    const m = matriculas[a.vinculoId];
    const atrasado = comAtraso.includes(a.vinculoId);
    const pausa = pausas[a.vinculoId];
    const ehOnline = m?.modalidade === "online" || m?.modalidade === "hibrido";
    if (ehOnline) online++;
    const filtros: FiltroAluno[] = [];
    if (atrasado) filtros.push("atrasados");
    if (ehOnline) filtros.push("online");
    if (a.semConta) filtros.push("sem_app");
    if (pausa) filtros.push("pausa");
    if (!m) filtros.push("sem_aulas");

    const subtitulo = pausa
      ? `Em pausa até ${dataBr(pausa)}`
      : !m
        ? "Sem matrícula · toque para criar"
        : m.modalidade === "online"
          ? resumoDaModalidade(m)
          : `${resumoDosHorarios(m.horarios, m.intervaloSemanas)}${m.modalidade === "hibrido" ? " · híbrido" : ""}`;
    const etiqueta: DetalheDoAluno["etiqueta"] = suspensas[a.vinculoId]
      ? { texto: "suspensa", tom: "bad" }
      : atrasado
        ? { texto: "atrasado", tom: "bad" }
        : pausa
          ? { texto: "pausa", tom: "info" }
          : a.semConta
            ? { texto: a.menor ? "menor · sem app" : "sem app", tom: "neu" }
            : ehOnline
              ? { texto: m?.modalidade === "hibrido" ? "híbrido" : "online", tom: "info" }
              : !m
                ? { texto: "sem matrícula", tom: "gold" }
                : { texto: "em dia", tom: "ok" };
    detalhes[a.vinculoId] = {
      subtitulo: a.semConta && a.menor && a.responsavelNome ? `${subtitulo} · resp. ${a.responsavelNome.split(" ")[0]}` : subtitulo,
      etiqueta,
      filtros,
      atrasado,
    };
  }

  return (
    <>
      <h1 className="px-[18px] pt-5 text-[24px] font-extrabold">Alunos</h1>
      {online > 0 && (
        <Link href="/agenda/online" className="mx-[18px] mt-2 flex items-center gap-2 text-[14px] font-semibold text-info lg:hidden">
          <Icone nome="conversa" className="size-4" /> Acompanhamento online e check-ins ›
        </Link>
      )}
      <Alunos alunos={alunos} origem={origem} detalhes={detalhes} />
      {/* Alunos das turmas que ele dá no estúdio (decisão 54): em roxo, sempre abaixo dos particulares.
          Decisão 82: começam recolhidos; o personal expande quando quiser. */}
      {doEstudio.map((g) => (
        <details key={g.estudio} className="group px-[18px] pb-6" aria-label={`Alunos do ${g.estudio}`}>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[16px] border border-estudio/30 bg-estudio-soft/50 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
            <span className="size-2.5 rounded-full bg-estudio" aria-hidden="true" />
            <span className="flex-1 text-[13px] font-extrabold tracking-[0.06em] text-estudio uppercase">
              {g.estudio} · {g.alunos.length}
            </span>
            <span className="text-[13.5px] font-semibold text-estudio">
              <span className="group-open:hidden">Expandir</span>
              <span className="hidden group-open:inline">Recolher</span>
            </span>
          </summary>
          <ul className="mt-2 divide-y divide-line rounded-[20px] border border-estudio/30 bg-estudio-soft/50 px-3.5">
            {g.alunos.map((a) => (
              <AlunoDoEstudioNaLista key={a.id} id={a.id} nome={a.nome} turmas={a.turmas.join(", ")} />
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}
