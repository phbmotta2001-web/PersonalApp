import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { lerAntecedencia } from "@/data/aulas";
import { lerPix } from "@/data/cobrancas";
import { sair } from "@/data/conta";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerTabelaDeValores } from "@/data/precos";
import { textoDeHoras } from "@/lib/aula";
import { centavosParaReais } from "@/lib/matricula";
import { formatarWhatsapp } from "@/lib/personal";
import { aPartirDe } from "@/lib/precos";

export const metadata: Metadata = {
  title: "Minha conta",
};

export default function PaginaMinhaConta() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

// Aba "Minha conta" do personal: dados, configurações de cobrança e regras, sair.
async function Conteudo() {
  const personal = await exigirPersonal("/agenda/conta");
  const [tabela, antecedencia, pix] = await Promise.all([lerTabelaDeValores(), lerAntecedencia(), lerPix()]);
  const menorValor = aPartirDe(tabela);

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Minha conta</h1>

      <section className="rounded-[20px] border border-line bg-surface p-4 text-[13px] text-ink-2">
        <p className="text-[17px] font-bold text-ink">{personal.nomeCompleto}</p>
        <p>{personal.email}</p>
        <p>WhatsApp {formatarWhatsapp(personal.whatsapp)}</p>
        <p>
          CREF {personal.cref}/{personal.crefUf}
        </p>
      </section>

      <nav className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4" aria-label="Configurações">
        <Linha
          href="/agenda/valores"
          icone="estrela"
          titulo="Valores"
          texto={menorValor != null ? `Aulas a partir de ${centavosParaReais(menorValor)}` : "Cadastre seus valores"}
        />
        <Linha href="/agenda/pix" icone="cadeado" titulo="Chave Pix" texto={pix ? "Cadastrada" : "Cadastre para receber pelo Pienel"} />
        <Linha href="/agenda/regras" icone="escudo" titulo="Regras" texto={`Cancelar até ${textoDeHoras(antecedencia)} antes`} />
      </nav>

      <form action={sair}>
        <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </form>
      <Link href="/conta/excluir" className="self-center text-[13px] font-semibold text-bad">
        Excluir minha conta
      </Link>
    </div>
  );
}

function Linha({ href, icone, titulo, texto }: { href: string; icone: NomeIcone; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
        <Icone nome={icone} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{titulo}</span>
        <span className="block text-xs text-ink-3">{texto}</span>
      </span>
      <span className="text-ink-3" aria-hidden="true">›</span>
    </Link>
  );
}
