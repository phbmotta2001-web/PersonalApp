import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { sair } from "@/data/conta";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
import { curtoDoDia, dataCurta, horariosLivres, minParaHora } from "@/lib/expediente";
import { formatarWhatsapp } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Minha agenda",
};

export default function PaginaAgenda() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const personal = await exigirPersonal("/agenda");
  const [expediente, bloqueios, alunos] = await Promise.all([lerExpediente(), listarBloqueios(), listarMeusAlunos()]);
  const ativos = alunos.filter((a) => a.situacao === "ativo").length;
  const aguardando = alunos.filter((a) => a.situacao === "convidado").length;
  const faixas = expediente?.faixas ?? [];
  const duracao = expediente?.duracao ?? 60;
  const semana = horariosLivres(faixas, bloqueios, duracao, 7);

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-5 pb-6">
      <header>
        <p className="text-[12.5px] text-ink-3">Área do personal</p>
        <h1 className="text-[24px] font-extrabold">Olá, {personal.nomeCompleto.split(" ")[0]}</h1>
      </header>

      {/* Fase 1: as contas nascem liberadas (sem conferência do CREF); só a suspensão avisa. */}
      {personal.situacao === "suspenso" && (
        <section className="rounded-[20px] bg-gold-soft p-4 text-[13.5px] text-gold">
          <p className="font-bold">Conta suspensa</p>
          <p className="mt-1">Fale com a equipe do Pienel.</p>
        </section>
      )}

      <Link
        href="/agenda/alunos"
        className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 hover:border-brand"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
          <Icone nome="usuario" className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Alunos</span>
          <span className="block text-xs text-ink-3">
            {ativos === 0 ? "Convide seus alunos por link" : `${ativos} ${ativos === 1 ? "aluno ativo" : "alunos ativos"}`}
            {aguardando > 0 && ` · ${aguardando} convite${aguardando > 1 ? "s" : ""} aguardando`}
          </span>
        </span>
        <span className="text-ink-3" aria-hidden="true">›</span>
      </Link>

      <nav className="grid grid-cols-2 gap-3" aria-label="Configurar agenda">
        <Atalho href="/agenda/horarios" icone="relogio" titulo="Horários de trabalho" texto={faixas.length ? `Aulas de ${duracao} min` : "Configure aqui"} />
        <Atalho href="/agenda/bloqueios" icone="calendario" titulo="Bloqueios" texto={bloqueios.length ? `${bloqueios.length} marcado${bloqueios.length > 1 ? "s" : ""}` : "Férias, feriados…"} />
      </nav>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-semibold">Seus horários livres nos próximos 7 dias</h2>
        {faixas.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-line p-4 text-sm text-ink-3">
            Você ainda não configurou seus horários de trabalho.{" "}
            <Link href="/agenda/horarios" className="font-semibold text-brand">
              Configurar agora
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
            {semana.map((d, i) => (
              <li key={d.data} className="flex flex-col gap-1.5 py-3">
                <p className="text-sm font-bold">
                  {i === 0 ? "Hoje" : i === 1 ? "Amanhã" : curtoDoDia(d.diaSemana)}{" "}
                  <span className="font-normal text-ink-3 tabular-nums">{dataCurta(d.data)}</span>
                </p>
                {d.livres.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {d.livres.map((m) => (
                      <span key={m} className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
                        {minParaHora(m)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">
                    {!d.trabalha ? "Folga" : d.bloqueios.length ? `Bloqueado: ${d.bloqueios.join(", ")}` : "Sem horários livres"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-3">
          Por enquanto não há aulas marcadas, então todos os horários de trabalho aparecem livres.
        </p>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">O que vem por aí</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          <li>Aulas fixas na agenda da semana e do dia</li>
          <li>Remarcações e reposições feitas pelo próprio aluno</li>
          <li>Mensalidades, atrasos e lembretes por WhatsApp</li>
        </ul>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-4 text-[13px] text-ink-2">
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Seus dados</h2>
        <p>{personal.email}</p>
        <p>WhatsApp {formatarWhatsapp(personal.whatsapp)}</p>
        <p>
          CREF {personal.cref}/{personal.crefUf}
        </p>
      </section>

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

function Atalho({ href, icone, titulo, texto }: { href: string; icone: NomeIcone; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-3.5 hover:border-brand">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
        <Icone nome={icone} className="size-[18px]" />
      </span>
      <span className="text-sm font-bold">{titulo}</span>
      <span className="text-xs text-ink-3">{texto}</span>
    </Link>
  );
}
