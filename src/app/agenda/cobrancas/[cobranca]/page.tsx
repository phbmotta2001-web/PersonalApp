import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcoesDaCobranca } from "@/components/agenda/AcoesDaCobranca";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerCobranca, lerPix, pixDaCobranca } from "@/data/cobrancas";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerMatricula } from "@/data/matriculas";
import {
  COR_COBRANCA,
  descricaoDaCobranca,
  mensagemDeCobranca,
  ROTULO_COBRANCA,
  situacaoDaCobranca,
  textoDoVencimento,
} from "@/lib/cobranca";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Cobrança",
};

export default function PaginaCobranca({ params }: PageProps<"/agenda/cobrancas/[cobranca]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Cobrança">
        <BotaoVoltar reserva="/agenda/cobrancas" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/cobrancas/[cobranca]">["params"] }) {
  const { cobranca: id } = await params;
  await exigirPersonal(`/agenda/cobrancas/${id}`);
  const hoje = agoraEmBrasilia().data;
  const [c, pixDados, alunos] = await Promise.all([lerCobranca(id), lerPix(), listarMeusAlunos()]);
  if (!c)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
        <p>Cobrança não encontrada.</p>
        <Link href="/agenda/cobrancas" className="font-semibold text-brand">
          Ver cobranças
        </Link>
      </div>
    );

  const s = situacaoDaCobranca(c, hoje);
  const pix = c.situacao === "aberta" ? await pixDaCobranca(pixDados, c) : null;
  const doAluno = alunos.find((a) => a.vinculoId === c.vinculoId);
  const whatsapp = doAluno?.whatsapp ?? null;
  // Menor sem app: a conversa é com o responsável.
  const responsavel = doAluno?.menor && doAluno.responsavelNome ? doAluno.responsavelNome : null;
  const matricula = c.situacao === "aberta" && c.tipo === "mensalidade" ? await lerMatricula(c.vinculoId) : null;
  // Sem WhatsApp do aluno, o link abre o WhatsApp para o personal escolher o contato.
  const conversa =
    c.situacao === "aberta"
      ? linkWhatsapp(whatsapp, mensagemDeCobranca(
          (responsavel ?? c.nome).split(" ")[0],
          c,
          hoje,
          pix?.codigo ?? null,
          matricula?.suspenderSeAtrasar ?? false,
          responsavel ? c.nome.split(" ")[0] : undefined,
        ))
      : null;

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <section className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex items-start gap-2">
          <Link href={`/agenda/alunos/${c.vinculoId}`} className={`flex-1 text-[19px] font-extrabold ${s === "atrasada" ? "text-bad" : ""}`}>
            {c.nome}
          </Link>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${COR_COBRANCA[s]}`}>{ROTULO_COBRANCA[s]}</span>
        </div>
        <p className="text-sm text-ink-2">{descricaoDaCobranca(c)}</p>
        <p className="text-[26px] font-extrabold tabular-nums">{centavosParaReais(c.valorCentavos)}</p>
        <p className={`text-[13px] ${s === "atrasada" ? "font-semibold text-bad" : "text-ink-3"}`}>
          {textoDoVencimento(c.vencimento, hoje)}
        </p>
      </section>
      {c.situacao === "aberta" && !pixDados && (
        <Link href="/agenda/pix" className="text-[13px] font-semibold text-brand">
          Cadastre sua chave Pix para mandar o Pix copia e cola junto ›
        </Link>
      )}
      <AcoesDaCobranca cobranca={c} hoje={hoje} pix={pix} linkWhatsapp={conversa} />
    </div>
  );
}
