import Link from "next/link";
import { LinkDaLista } from "@/components/agenda/ColunaDaLista";
import { Avatar } from "@/components/Avatar";
import { alunosComAtraso } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAlunosOnline, matriculasSuspensas } from "@/data/matriculas";
import { checkinsRecentes } from "@/data/questionarios";
import { agoraEmBrasilia, emBrasilia } from "@/lib/expediente";
import { resumoDaModalidade, resumoDosHorarios } from "@/lib/matricula";

const diaMes = (iso: string) => {
  const { data } = emBrasilia(iso);
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
};

/** Alunos online e híbridos com a situação do último questionário (coluna da esquerda no computador). */
export async function ListaOnline() {
  await exigirPersonal("/agenda/online");
  const [alunos, comAtraso, checkins, suspensas] = await Promise.all([
    listarAlunosOnline(),
    alunosComAtraso(agoraEmBrasilia().data),
    checkinsRecentes(),
    matriculasSuspensas(),
  ]);
  const ultimoDe = (vinculoId: string) => checkins.find((c) => c.vinculoId === vinculoId);

  return (
    <div className="flex flex-col gap-3 px-[18px] pt-2 pb-6 lg:pt-5">
      <h2 className="hidden text-[24px] font-extrabold lg:block">Alunos online</h2>
      {alunos.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-[15px] text-ink-3">
          Nenhum aluno online ainda. Para incluir, abra a ficha do aluno em{" "}
          <Link href="/agenda/alunos" className="font-semibold text-brand">
            Alunos
          </Link>{" "}
          e, na matrícula, escolha <strong>Online</strong> ou <strong>Híbrido</strong>.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4 lg:border-0 lg:px-0">
          {alunos.map((a) => {
            const atrasado = comAtraso.includes(a.vinculoId);
            const ultimo = ultimoDe(a.vinculoId);
            const situacao = !ultimo
              ? { texto: "Sem questionário", cor: "bg-surface-2 text-ink-3" }
              : ultimo.respondidoEm
                ? { texto: `Respondeu ${diaMes(ultimo.respondidoEm)}`, cor: "bg-ok-soft text-ok" }
                : { texto: "Aguardando resposta", cor: "bg-gold-soft text-gold" };
            return (
              <li key={a.vinculoId}>
                <LinkDaLista href={`/agenda/online/${a.vinculoId}`} className="flex items-center gap-3 py-3 lg:rounded-[14px] lg:px-2">
                  <Avatar nome={a.nome} cor="av6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate font-bold ${atrasado ? "text-bad" : ""}`}>{a.nome}</span>
                      {a.modalidade === "hibrido" && (
                        <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[12.5px] font-bold text-info">
                          Híbrido
                        </span>
                      )}
                    </span>
                    <span className="block text-[14px] text-ink-3">
                      {resumoDaModalidade(a.matricula)}
                      {a.modalidade === "hibrido" &&
                        ` · ${resumoDosHorarios(a.matricula.horarios, a.matricula.intervaloSemanas)}`}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${situacao.cor}`}>{situacao.texto}</span>
                      {atrasado && (
                        <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[12.5px] font-bold text-bad">
                          {suspensas[a.vinculoId] ? "Matrícula suspensa" : "Mensalidade atrasada"}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-ink-3" aria-hidden="true">›</span>
                </LinkDaLista>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
