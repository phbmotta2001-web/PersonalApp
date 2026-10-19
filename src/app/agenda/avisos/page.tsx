import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarcarAvisosLidos } from "@/components/agenda/MarcarAvisosLidos";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { listarAvisos, type Aviso } from "@/data/avisos";
import { exigirPersonal } from "@/data/exigir-personal";
import { emBrasilia } from "@/lib/expediente";
import { textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Avisos",
};

export default function PaginaAvisos() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Avisos">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

/** O que o aluno fez, em português. */
function texto(a: Aviso): string {
  const aula = a.aula ? textoDaAula(a.aula.inicio, null) : "uma aula";
  const nova = a.aulaNova ? textoDaAula(a.aulaNova.inicio, null) : "outro horário";
  const nome = a.nome.split(" ")[0];
  switch (a.tipo) {
    case "cancelou_com_reposicao":
      return `${nome} cancelou a aula de ${aula} e ganhou uma reposição.`;
    case "cancelou_em_cima":
      return `${nome} cancelou em cima da hora a aula de ${aula}. Conta como dada.`;
    case "marcou_reposicao":
      return `${nome} marcou uma reposição para ${nova}.`;
    case "remarcou":
      return `${nome} remarcou a aula de ${aula} para ${nova}.`;
    case "pediu_reposicao":
      return `${nome} pediu uma reposição para ${nova}. Aceite, recuse ou sugira outro horário.`;
    case "pediu_remarcacao":
      return `${nome} pediu para remarcar a aula de ${aula} para ${nova}. Aceite, recuse ou sugira outro horário.`;
    case "aceitou_sugestao":
      return `${nome} aceitou o horário que você sugeriu: ${nova}.`;
    case "recusou_sugestao":
      return `${nome} recusou o horário que você sugeriu (${nova}).`;
    case "avisou_pagamento":
      return `${nome} avisou que pagou uma cobrança. Confira no seu banco e confirme.`;
  }
}

async function Conteudo() {
  await exigirPersonal("/agenda/avisos");
  const avisos = await listarAvisos();
  const haNaoLidos = avisos.some((a) => !a.lido);

  if (avisos.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 px-[18px] pt-10 text-center text-sm text-ink-3">
        <Icone nome="sino" className="size-8" />
        <p>Nenhum aviso ainda.</p>
        <p className="text-xs">Quando um aluno cancelar, remarcar ou marcar reposição pelo app, aparece aqui.</p>
      </div>
    );

  return (
    <ul className="flex flex-col gap-2 px-[18px] pt-2 pb-6">
      <MarcarAvisosLidos haNaoLidos={haNaoLidos} />
      {avisos.map((a) => {
        const alvo = a.cobrancaId ? null : (a.aulaNova?.id ?? a.aula?.id);
        const destino = a.cobrancaId ? `/agenda/cobrancas/${a.cobrancaId}` : alvo ? `/agenda/aula/${alvo}` : null;
        const quando = emBrasilia(a.criadoEm);
        const conteudo = (
          <>
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.lido ? "bg-transparent" : "bg-brand"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${a.lido ? "text-ink-2" : "font-semibold"}`}>{texto(a)}</span>
              <span className="block text-xs text-ink-3">
                {quando.data.slice(8, 10)}/{quando.data.slice(5, 7)} às {quando.hora}
                {!a.lido && " · novo"}
              </span>
            </span>
          </>
        );
        return (
          <li key={a.id}>
            {destino ? (
              <Link
                href={destino}
                className={`flex items-start gap-3 rounded-[16px] border p-3 ${a.lido ? "border-line bg-surface" : "border-brand bg-brand-soft"}`}
              >
                {conteudo}
              </Link>
            ) : (
              <div className="flex items-start gap-3 rounded-[16px] border border-line bg-surface p-3">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
