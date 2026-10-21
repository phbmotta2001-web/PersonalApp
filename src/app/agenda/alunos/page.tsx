import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alunos } from "@/components/agenda/Alunos";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { listarMeusAlunos } from "@/data/convites";
import { alunosComAtraso } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAlunosOnline, matriculasSuspensas, proximaAulaPorAluno } from "@/data/matriculas";
import { agoraEmBrasilia } from "@/lib/expediente";
import { origemDoSite } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Alunos",
};

// Aba "Alunos" do personal.
export default function PaginaAlunos() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-28">
      <h1 className="px-[18px] pt-5 text-[24px] font-extrabold">Alunos</h1>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/alunos");
  const [alunos, origem, proximas, comAtraso, suspensas, online] = await Promise.all([
    listarMeusAlunos(),
    origemDoSite(),
    proximaAulaPorAluno(),
    alunosComAtraso(agoraEmBrasilia().data),
    matriculasSuspensas(),
    listarAlunosOnline(),
  ]);
  const hibridos = online.filter((o) => o.modalidade === "hibrido").length;
  return (
    <>
      <div className="px-[18px] pt-3">
        <Link
          href="/agenda/online"
          className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 hover:border-brand"
        >
          <span className="grid size-9 place-items-center rounded-full bg-info-soft text-info">
            <Icone nome="conversa" className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">Alunos online{online.length > 0 ? ` (${online.length})` : ""}</span>
            <span className="block text-xs text-ink-3">
              {online.length === 0
                ? "Acompanhamento online e híbridos, com questionários"
                : `${hibridos} híbrido${hibridos === 1 ? "" : "s"} · questionários de acompanhamento`}
            </span>
          </span>
          <span className="text-ink-3" aria-hidden="true">›</span>
        </Link>
      </div>
      <Alunos alunos={alunos} origem={origem} proximas={proximas} comAtraso={comAtraso} suspensos={Object.keys(suspensas)} />
    </>
  );
}
