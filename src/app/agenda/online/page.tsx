import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { alunosComAtraso } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAlunosOnline } from "@/data/matriculas";
import { agoraEmBrasilia } from "@/lib/expediente";
import { resumoDaModalidade, resumoDosHorarios } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Alunos online",
};

export default function PaginaAlunosOnline() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Alunos online">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/online");
  const [alunos, comAtraso] = await Promise.all([listarAlunosOnline(), alunosComAtraso(agoraEmBrasilia().data)]);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <p className="text-[13px] text-ink-2">
        Alunos 100% online (não ocupam a agenda) e híbridos (online com aulas presenciais de rotina, que aparecem na
        agenda).
      </p>

      {alunos.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-sm text-ink-3">
          Nenhum aluno online ainda. Para incluir, abra a ficha do aluno em{" "}
          <Link href="/agenda/alunos" className="font-semibold text-brand">
            Alunos
          </Link>{" "}
          e, na matrícula, escolha <strong>Online</strong> ou <strong>Híbrido</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {alunos.map((a) => {
            const atrasado = comAtraso.includes(a.vinculoId);
            return (
              <li key={a.vinculoId}>
                <Link href={`/agenda/alunos/${a.vinculoId}`} className="flex items-center gap-3 py-3">
                  <Avatar nome={a.nome} cor="av6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate font-bold ${atrasado ? "text-bad" : ""}`}>{a.nome}</span>
                      {a.modalidade === "hibrido" && (
                        <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-bold text-info">
                          Híbrido
                        </span>
                      )}
                    </span>
                    <span className="block text-[12.5px] text-ink-3">
                      {resumoDaModalidade(a.matricula)}
                      {a.modalidade === "hibrido" &&
                        ` · ${resumoDosHorarios(a.matricula.horarios, a.matricula.intervaloSemanas)}`}
                    </span>
                    {atrasado && <span className="block text-[11.5px] font-bold text-bad">Mensalidade atrasada</span>}
                  </span>
                  <span className="text-ink-3" aria-hidden="true">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
