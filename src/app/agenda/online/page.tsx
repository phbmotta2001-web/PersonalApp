import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { LinkWhatsappQuestionario } from "@/components/online/LinkWhatsappQuestionario";
import { alunosComAtraso } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAlunosOnline } from "@/data/matriculas";
import { checkinsRecentes } from "@/data/questionarios";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia, emBrasilia } from "@/lib/expediente";
import { resumoDaModalidade, resumoDosHorarios } from "@/lib/matricula";
import { mensagemDoQuestionario } from "@/lib/questionario";
import { origemDoSite } from "@/lib/supabase/servidor";

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

const diaMes = (iso: string) => {
  const { data } = emBrasilia(iso);
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
};

async function Conteudo() {
  await exigirPersonal("/agenda/online");
  const [alunos, comAtraso, checkins, origem] = await Promise.all([
    listarAlunosOnline(),
    alunosComAtraso(agoraEmBrasilia().data),
    checkinsRecentes(),
    origemDoSite(),
  ]);
  const ids = new Set(alunos.map((a) => a.vinculoId));
  // Questionários que chegaram na data e ainda não tiveram o link enviado.
  const paraEnviar = checkins.filter((c) => ids.has(c.vinculoId) && !c.respondidoEm && !c.enviadoEm);
  const ultimoDe = (vinculoId: string) => checkins.find((c) => c.vinculoId === vinculoId);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <Link
        href="/agenda/online/questionarios"
        className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 hover:border-brand"
      >
        <span className="grid size-9 place-items-center rounded-full bg-info-soft text-info">
          <Icone nome="conversa" className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Questionários</span>
          <span className="block text-xs text-ink-3">Criar e editar os seus modelos de acompanhamento</span>
        </span>
        <span className="text-ink-3" aria-hidden="true">›</span>
      </Link>

      {paraEnviar.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[20px] border-2 border-gold bg-gold-soft p-3.5" aria-label="Para enviar">
          <h2 className="text-[15px] font-bold text-gold">
            {paraEnviar.length === 1 ? "1 questionário para enviar" : `${paraEnviar.length} questionários para enviar`}
          </h2>
          {paraEnviar.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-[14px] bg-surface p-2.5">
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-bold">{c.nome}</span>
                <span className="block text-xs text-ink-3">{c.titulo}</span>
              </span>
              <LinkWhatsappQuestionario
                checkinId={c.id}
                enviado={false}
                href={linkWhatsapp(c.whatsapp, mensagemDoQuestionario(c.nome.split(" ")[0], c.titulo, `${origem}/aluno/questionario/${c.id}`))}
              />
            </div>
          ))}
        </section>
      )}

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
            const ultimo = ultimoDe(a.vinculoId);
            const situacao = !ultimo
              ? { texto: "Sem questionário", cor: "bg-surface-2 text-ink-3" }
              : ultimo.respondidoEm
                ? { texto: `Respondeu ${diaMes(ultimo.respondidoEm)}`, cor: "bg-ok-soft text-ok" }
                : { texto: "Aguardando resposta", cor: "bg-gold-soft text-gold" };
            return (
              <li key={a.vinculoId}>
                <Link href={`/agenda/online/${a.vinculoId}`} className="flex items-center gap-3 py-3">
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
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${situacao.cor}`}>{situacao.texto}</span>
                      {atrasado && (
                        <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] font-bold text-bad">Mensalidade atrasada</span>
                      )}
                    </span>
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
