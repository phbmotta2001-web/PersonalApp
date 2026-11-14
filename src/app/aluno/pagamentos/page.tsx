import type { Metadata } from "next";
import Link from "next/link";
import { meusEstudiosComoAluno } from "@/data/aluno-estudio";
import { lerMatricula } from "@/data/matriculas";
import { meuPlanoNoEstudio } from "@/data/mensalidade-estudio";
import { dataCompleta, fimDaMatricula, fimDoPlano, NOME_DO_PLANO } from "@/lib/plano";
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
  const [personais, estudios] = await Promise.all([listarMeusPersonais(), meusEstudiosComoAluno()]);
  // Decisão 103: até quando vai o plano no estúdio (trimestral, semestral ou anual).
  const planosNoEstudio = (
    await Promise.all(
      estudios.map(async (e) => {
        const plano = await meuPlanoNoEstudio(e.id);
        const fim = plano ? fimDoPlano(plano.meses, plano.inicio, hoje) : null;
        return plano && fim ? { e, meses: plano.meses, fim } : null;
      }),
    )
  ).filter((x) => x !== null);
  const blocos = await Promise.all(
    personais.map(async (p) => {
      const [cobrancas, pixDoPersonal, matricula] = await Promise.all([cobrancasDoAluno(p.vinculoId), pixParaAluno(p.vinculoId), lerMatricula(p.vinculoId)]);
      const pix = Object.fromEntries(
        (
          await Promise.all(
            cobrancas.filter((c) => c.situacao === "aberta").map(async (c) => [c.id, await pixDaCobranca(pixDoPersonal, c)] as const),
          )
        ).filter((par): par is readonly [string, { codigo: string; qrSvg: string }] => par[1] !== null),
      );
      // Decisão 103: até quando vai o plano (data de término ou fim do ciclo de 3, 6 ou 12 meses).
      const fim = matricula ? fimDaMatricula(matricula, hoje) : null;
      const plano = matricula && fim ? { fim, termina: fim === matricula.fim, meses: matricula.cicloMeses } : null;
      return { p, cobrancas, pix, plano };
    }),
  );
  const comCobranca = blocos.filter((b) => b.cobrancas.length > 0 || b.plano);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Pagamentos</h1>
      {planosNoEstudio.map(({ e, meses, fim }) => (
        <Link key={e.id} href={`/aluno/estudio/${e.id}`} className="flex flex-col gap-0.5 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-bold">{e.nome}</span>
          <span className="text-[14px] text-ink-2">
            Plano {NOME_DO_PLANO[meses].toLowerCase()}: vai até <b>{dataCompleta(fim)}</b> (renova sozinho)
          </span>
          <span className="text-[14px] font-semibold text-brand">Ver as mensalidades ›</span>
        </Link>
      ))}
      {comCobranca.length === 0 && planosNoEstudio.length === 0 && (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-[14px] text-ink-3">
          Nenhuma cobrança por enquanto. Quando a sua matrícula tiver mensalidade, ela aparece aqui com o Pix.
        </p>
      )}
      {comCobranca.map(({ p, cobrancas, pix, plano }) => (
        <section key={p.vinculoId} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label={`Pagamentos para ${p.nome}`}>
          {comCobranca.length > 1 && <h2 className="text-[16px] font-bold">Para {p.nome.split(" ")[0]}</h2>}
          {plano && (
            <p className="text-[14px] text-ink-2">
              {plano.termina ? "Seu plano termina em " : `Plano ${NOME_DO_PLANO[plano.meses].toLowerCase()}: vai até `}
              <b>{dataCompleta(plano.fim)}</b>
              {!plano.termina && " (renova sozinho)"}
            </p>
          )}
          {cobrancas.length > 0 && <CobrancasDoAluno cobrancas={cobrancas} pix={pix} nomePersonal={p.nome} hoje={hoje} />}
        </section>
      ))}
    </div>
  );
}
