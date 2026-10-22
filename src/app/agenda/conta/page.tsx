import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { Avatar } from "@/components/Avatar";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { lerAntecedencia } from "@/data/aulas";
import { sair } from "@/data/conta";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
import { textoDeHoras } from "@/lib/aula";
import { formatarWhatsapp } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Conta",
};

export default function PaginaConta() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

// Aba "Conta" do personal: dados e configurações (o dinheiro fica na aba Financeiro).
async function Conteudo() {
  const personal = await exigirPersonal("/agenda/conta");
  const [antecedencia, expediente, bloqueios] = await Promise.all([lerAntecedencia(), lerExpediente(), listarBloqueios()]);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Conta</h1>

      <section className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4">
        <Avatar nome={personal.nomeCompleto} cor="av1" />
        <div className="min-w-0 text-[14px] text-ink-2">
          <p className="truncate text-[17px] font-bold text-ink">{personal.nomeCompleto}</p>
          <p className="truncate">{personal.email}</p>
          <p>
            WhatsApp {formatarWhatsapp(personal.whatsapp)} · CREF {personal.cref}/{personal.crefUf}
          </p>
        </div>
      </section>

      <Grupo titulo="Agenda">
        <Linha
          href="/agenda/horarios"
          icone="relogio"
          titulo="Horários de trabalho"
          texto={expediente?.faixas.length ? `Aulas de ${expediente.duracao} min` : "Configure seus horários"}
        />
        <Linha
          href="/agenda/bloqueios"
          icone="calendario"
          titulo="Bloqueios"
          texto={bloqueios.length ? `${bloqueios.length} marcado${bloqueios.length > 1 ? "s" : ""}` : "Férias, feriados…"}
        />
        <Linha href="/agenda/regras" icone="escudo" titulo="Regras e pausas" texto={`Cancelar até ${textoDeHoras(antecedencia)} antes`} />
      </Grupo>

      <Grupo titulo="Alunos online">
        <Linha href="/agenda/online/questionarios" icone="conversa" titulo="Questionários" texto="Modelos de check-in e acompanhamento" />
      </Grupo>

      <form action={sair}>
        <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </form>
      <Link href="/conta/excluir" className="self-center text-[14px] font-semibold text-bad">
        Excluir minha conta
      </Link>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={titulo}>
      <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">{titulo}</h2>
      <nav className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">{children}</nav>
    </section>
  );
}

function Linha({ href, icone, titulo, texto }: { href: string; icone: NomeIcone; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
        <Icone nome={icone} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{titulo}</span>
        <span className="block text-[13px] text-ink-3">{texto}</span>
      </span>
      <span className="text-ink-3" aria-hidden="true">›</span>
    </Link>
  );
}
