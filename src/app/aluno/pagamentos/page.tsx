import type { Metadata } from "next";
import { Suspense } from "react";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { CobrancasDoAluno } from "@/components/aluno/CobrancasDoAluno";
import { Carregando } from "@/components/Formulario";
import { cobrancasDoAluno, pixDaCobranca, pixParaAluno } from "@/data/cobrancas";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { agoraEmBrasilia } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Pagamentos",
};

export default function PaginaPagamentosDoAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoAluno />
    </div>
  );
}

// Aba "Pagamentos" do aluno: matrícula e cobranças de cada personal, com Pix e "Já paguei".
async function Conteudo() {
  await exigirAluno("/aluno/pagamentos");
  const hoje = agoraEmBrasilia().data;
  const personais = await listarMeusPersonais();
  const blocos = await Promise.all(
    personais.map(async (p) => {
      const [cobrancas, pixDoPersonal] = await Promise.all([cobrancasDoAluno(p.vinculoId), pixParaAluno(p.vinculoId)]);
      const pix = Object.fromEntries(
        (
          await Promise.all(
            cobrancas.filter((c) => c.situacao === "aberta").map(async (c) => [c.id, await pixDaCobranca(pixDoPersonal, c)] as const),
          )
        ).filter((par): par is readonly [string, { codigo: string; qrSvg: string }] => par[1] !== null),
      );
      return { p, cobrancas, pix };
    }),
  );
  const comCobranca = blocos.filter((b) => b.cobrancas.length > 0);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Pagamentos</h1>
      {comCobranca.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-[13px] text-ink-3">
          Nenhuma cobrança por enquanto. Quando a sua matrícula tiver mensalidade, ela aparece aqui com o Pix.
        </p>
      )}
      {comCobranca.map(({ p, cobrancas, pix }) => (
        <section key={p.vinculoId} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label={`Pagamentos para ${p.nome}`}>
          {comCobranca.length > 1 && <h2 className="text-[15px] font-bold">Para {p.nome.split(" ")[0]}</h2>}
          <CobrancasDoAluno cobrancas={cobrancas} pix={pix} nomePersonal={p.nome} hoje={hoje} />
        </section>
      ))}
    </div>
  );
}
