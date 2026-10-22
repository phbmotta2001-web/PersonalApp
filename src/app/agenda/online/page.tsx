import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { LinkWhatsappQuestionario } from "@/components/online/LinkWhatsappQuestionario";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAlunosOnline } from "@/data/matriculas";
import { checkinsRecentes } from "@/data/questionarios";
import { linkWhatsapp } from "@/lib/convite";
import { mensagemDoQuestionario } from "@/lib/questionario";
import { origemDoSite } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Alunos online",
};

export default function PaginaAlunosOnline() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-2xl">
      <Cabecalho titulo="Alunos online">
        <BotaoVoltar reserva="/agenda/alunos" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/online");
  const [alunos, checkins, origem] = await Promise.all([listarAlunosOnline(), checkinsRecentes(), origemDoSite()]);
  const ids = new Set(alunos.map((a) => a.vinculoId));
  // Questionários que chegaram na data e ainda não tiveram o link enviado.
  const paraEnviar = checkins.filter((c) => ids.has(c.vinculoId) && !c.respondidoEm && !c.enviadoEm);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-2 lg:pb-6">
      <Link
        href="/agenda/online/questionarios"
        className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 hover:border-brand"
      >
        <span className="grid size-9 place-items-center rounded-full bg-info-soft text-info">
          <Icone nome="conversa" className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold">Questionários</span>
          <span className="block text-[13px] text-ink-3">Criar e editar os seus modelos de acompanhamento</span>
        </span>
        <span className="text-ink-3" aria-hidden="true">›</span>
      </Link>

      {paraEnviar.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[20px] border-2 border-gold bg-gold-soft p-3.5" aria-label="Para enviar">
          <h2 className="text-[16px] font-bold text-gold">
            {paraEnviar.length === 1 ? "1 questionário para enviar" : `${paraEnviar.length} questionários para enviar`}
          </h2>
          {paraEnviar.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-[14px] bg-surface p-2.5">
              <span className="min-w-0 flex-1 text-[15px]">
                <span className="block truncate font-bold">{c.nome}</span>
                <span className="block text-[13px] text-ink-3">{c.titulo}</span>
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

      {/* No computador, o espaço do acompanhamento enquanto nenhum aluno está aberto. */}
      <div className="hidden flex-col items-center gap-3 pt-16 text-center text-ink-3 lg:flex">
        <span className="grid size-16 place-items-center rounded-full bg-info-soft text-info">
          <Icone nome="conversa" className="size-8" />
        </span>
        <p className="text-[17px] font-semibold text-ink-2">Escolha um aluno na lista para ver os check-ins e as respostas.</p>
      </div>
    </div>
  );
}
