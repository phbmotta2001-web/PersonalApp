import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { CriarEstudio } from "@/components/estudio/CriarEstudio";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { BotaoSair } from "@/components/estudio/BotaoSair";
import { estudioDoCadastro, souContaEmpresa } from "@/data/conta";
import { souDaEquipe } from "@/data/equipe";
import { meusEstudios } from "@/data/estudio";
import { exigirPersonal } from "@/data/exigir-personal";

export const metadata: Metadata = {
  title: "Estúdio",
};

// Coordenação do estúdio (decisão 54). Sem estúdio: cria um. Com um só: abre direto.
export default function PaginaEstudios() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-[18px] pb-12">
      <Suspense fallback={<Cabecalho titulo="Estúdio" />}>
        <Topo />
      </Suspense>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

/** Conta empresarial não tem a área de personal: no lugar de voltar, o botão de sair. */
async function Topo() {
  const empresa = await souContaEmpresa();
  return (
    <div className="flex items-center">
      <Cabecalho titulo="Estúdio">{!empresa && <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />}</Cabecalho>
      {empresa && <BotaoSair className="ml-auto" />}
    </div>
  );
}

async function Conteudo() {
  await exigirPersonal("/estudio");
  const coordeno = (await meusEstudios()).filter((e) => e.papel === "coordenacao");
  if (coordeno.length === 1) redirect(`/estudio/${coordeno[0].id}`);
  if (coordeno.length === 0) {
    const [empresa, equipe] = await Promise.all([souContaEmpresa(), souDaEquipe()]);
    if (empresa || equipe) return <CriarEstudio inicial={await estudioDoCadastro()} />;
    return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-5 text-ink-2">
        <p>
          O estúdio é cadastrado pela coordenação, com a <b>conta empresarial</b>. Para dar aula num estúdio, peça à coordenação o
          link de convite.
        </p>
        <Link href="/agenda" className="font-semibold text-brand">
          Voltar para a agenda
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
      {coordeno.map((e) => (
        <li key={e.id}>
          <Link href={`/estudio/${e.id}`} className="flex items-center py-3 font-semibold">
            <span className="flex-1">{e.nome}</span>›
          </Link>
        </li>
      ))}
    </ul>
  );
}
