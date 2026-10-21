import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormPlanosOnline } from "@/components/agenda/FormPlanosOnline";
import { FormValores } from "@/components/agenda/FormValores";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerTabelaDeValores, lerTabelaOnline } from "@/data/precos";

export const metadata: Metadata = {
  title: "Valores",
};

export default function PaginaValores({ searchParams }: PageProps<"/agenda/valores">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Valores">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/valores">["searchParams"] }) {
  await exigirPersonal("/agenda/valores");
  const { tipo } = await searchParams;
  const online = tipo === "online";
  const aba = (ativo: boolean) =>
    `flex-1 rounded-[11px] py-2 text-center text-sm font-bold ${ativo ? "bg-surface shadow-sm" : "text-ink-3"}`;

  return (
    <>
      <nav className="mx-[18px] mb-2 flex gap-1 rounded-[14px] bg-surface-2 p-1" aria-label="Tipo de valor">
        <Link href="/agenda/valores" replace aria-current={!online ? "page" : undefined} className={aba(!online)}>
          Presencial
        </Link>
        <Link href="/agenda/valores?tipo=online" replace aria-current={online ? "page" : undefined} className={aba(online)}>
          Planos online
        </Link>
      </nav>
      {online ? (
        <FormPlanosOnline inicial={await lerTabelaOnline()} />
      ) : (
        <FormValores inicial={await lerTabelaDeValores()} />
      )}
    </>
  );
}
