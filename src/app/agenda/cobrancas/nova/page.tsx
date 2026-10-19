import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { FormCobrancaAvulsa } from "@/components/agenda/FormCobrancaAvulsa";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { agoraEmBrasilia } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Cobrança avulsa",
};

export default function PaginaCobrancaAvulsa() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Cobrança avulsa">
        <BotaoVoltar reserva="/agenda/cobrancas" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/agenda/cobrancas/nova");
  const alunos = (await listarMeusAlunos()).filter((a) => a.situacao === "ativo");
  return (
    <FormCobrancaAvulsa
      alunos={alunos.map((a) => ({ vinculoId: a.vinculoId, nome: a.nome }))}
      hoje={agoraEmBrasilia().data}
    />
  );
}
