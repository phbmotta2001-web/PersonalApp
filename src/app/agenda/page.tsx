import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { sair } from "@/data/conta";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
import { listarAulas } from "@/data/matriculas";
import { lerTabelaDeValores } from "@/data/precos";
import {
  agoraEmBrasilia,
  curtoDoDia,
  dataCurta,
  emBrasilia,
  horariosLivres,
  instante,
  minParaHora,
  nomeDoDia,
  somarDias,
} from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { formatarWhatsapp } from "@/lib/personal";
import { aPartirDe } from "@/lib/precos";

export const metadata: Metadata = {
  title: "Minha agenda",
};

// Até quantas semanas à frente dá para ver (as aulas fixas existem por 8 semanas).
const SEMANAS = 8;
// Situações de aula que ocupam o horário.
const OCUPA = ["agendada", "confirmada", "realizada", "falta"];
const dataValida = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export default function PaginaAgenda({ searchParams }: PageProps<"/agenda">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda">["searchParams"] }) {
  const personal = await exigirPersonal("/agenda");
  const { dia: pedido } = await searchParams;

  // A semana mostrada começa hoje (ou 7, 14… dias depois) e o dia escolhido fica nela.
  const hoje = agoraEmBrasilia().data;
  const distancia = dataValida(pedido) ? Math.round((Date.parse(pedido) - Date.parse(hoje)) / 86_400_000) : 0;
  const semanaN = Math.min(Math.max(Math.floor(distancia / 7), 0), SEMANAS - 1);
  const inicioSemana = somarDias(hoje, semanaN * 7);
  const dia = dataValida(pedido) && distancia >= semanaN * 7 && distancia < semanaN * 7 + 7 ? pedido : inicioSemana;

  const [expediente, bloqueios, alunos, aulas, tabela] = await Promise.all([
    lerExpediente(),
    listarBloqueios(),
    listarMeusAlunos(),
    listarAulas(instante(inicioSemana, 0).toISOString(), instante(somarDias(inicioSemana, 7), 0).toISOString()),
    lerTabelaDeValores(),
  ]);
  const ativos = alunos.filter((a) => a.situacao === "ativo").length;
  const aguardando = alunos.filter((a) => a.situacao === "convidado").length;
  const faixas = expediente?.faixas ?? [];
  const menorValor = aPartirDe(tabela);
  const duracao = expediente?.duracao ?? 60;

  const aulasQueOcupam = aulas.filter((a) => OCUPA.includes(a.situacao));
  const semana = horariosLivres(faixas, bloqueios, duracao, 7, new Date(), aulasQueOcupam, inicioSemana);
  const doDia = semana.find((d) => d.data === dia) ?? semana[0];
  const aulasDe = (data: string) => aulasQueOcupam.filter((a) => emBrasilia(a.inicio).data === data);
  const aulasDoDia = aulasDe(dia);
  const caiEmBloqueio = (a: { inicio: string; fim: string }) =>
    bloqueios.some((b) => Date.parse(b.inicio) < Date.parse(a.fim) && Date.parse(b.fim) > Date.parse(a.inicio));
  const rotuloDoDia = dia === hoje ? "Hoje" : dia === somarDias(hoje, 1) ? "Amanhã" : nomeDoDia(doDia.diaSemana);
  const totalLivres = semana.reduce((n, d) => n + d.livres.length, 0);

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

      <section className="flex flex-col gap-3" aria-label="Agenda da semana">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-semibold">
            {semanaN === 0 ? "Próximos 7 dias" : `${dataCurta(inicioSemana)} a ${dataCurta(somarDias(inicioSemana, 6))}`}
          </h2>
          {semanaN > 0 && (
            <Link
              href={`/agenda?dia=${somarDias(inicioSemana, -7)}`}
              scroll={false}
              aria-label="Semana anterior"
              className="grid size-9 place-items-center rounded-full border border-line bg-surface"
            >
              ‹
            </Link>
          )}
          {semanaN < SEMANAS - 1 && (
            <Link
              href={`/agenda?dia=${somarDias(inicioSemana, 7)}`}
              scroll={false}
              aria-label="Próxima semana"
              className="grid size-9 place-items-center rounded-full border border-line bg-surface"
            >
              ›
            </Link>
          )}
        </div>

        <nav className="grid grid-cols-7 gap-1" aria-label="Dias da semana">
          {semana.map((d) => {
            const n = aulasDe(d.data).length;
            const ativo = d.data === dia;
            return (
              <Link
                key={d.data}
                href={`/agenda?dia=${d.data}`}
                scroll={false}
                aria-current={ativo ? "date" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-[14px] py-2 text-xs ${
                  ativo ? "bg-ink text-app" : "border border-line bg-surface text-ink-2"
                }`}
              >
                <span>{curtoDoDia(d.diaSemana)}</span>
                <span className="text-[15px] font-bold tabular-nums">{d.data.slice(8, 10)}</span>
                <span className={`text-[10.5px] ${ativo ? "" : "text-ink-3"}`}>
                  {n > 0 ? `${n} aula${n > 1 ? "s" : ""}` : d.trabalha ? "livre" : "folga"}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
          <p className="text-sm font-bold">
            {rotuloDoDia} <span className="font-normal text-ink-3 tabular-nums">{dataCurta(dia)}</span>
          </p>
          {doDia.bloqueios.length > 0 && (
            <p className="rounded-[12px] bg-gold-soft px-3 py-2 text-xs text-gold">Bloqueado: {doDia.bloqueios.join(", ")}</p>
          )}
          {aulasDoDia.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {aulasDoDia.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.vinculoId ? `/agenda/alunos/${a.vinculoId}` : "/agenda/alunos"}
                    className="flex items-start gap-3 py-2.5"
                  >
                    <span className="w-[92px] shrink-0 text-sm font-bold tabular-nums">
                      {emBrasilia(a.inicio).hora}–{emBrasilia(a.fim).hora}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.nome}</span>
                      {a.local && <span className="block truncate text-xs text-ink-3">{a.local}</span>}
                      {caiEmBloqueio(a) && <span className="block text-xs font-semibold text-gold">Cai num bloqueio</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">Nenhuma aula neste dia.</p>
          )}
          {faixas.length === 0 ? (
            <p className="border-t border-line pt-2.5 text-[13px] text-ink-3">
              Você ainda não configurou seus horários de trabalho.{" "}
              <Link href="/agenda/horarios" className="font-semibold text-brand">
                Configurar agora
              </Link>
            </p>
          ) : doDia.livres.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-line pt-2.5">
              <p className="text-xs font-semibold text-ink-3">Horários livres</p>
              <span className="flex flex-wrap gap-1.5">
                {doDia.livres.map((m) => (
                  <span key={m} className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
                    {minParaHora(m)}
                  </span>
                ))}
              </span>
            </div>
          ) : (
            <p className="border-t border-line pt-2.5 text-xs text-ink-3">{doDia.trabalha ? "Sem horários livres." : "Folga."}</p>
          )}
        </div>
        <p className="text-xs text-ink-3">
          Nesta semana: {aulasQueOcupam.length} aula{aulasQueOcupam.length === 1 ? "" : "s"} · {totalLivres} horário
          {totalLivres === 1 ? "" : "s"} livre{totalLivres === 1 ? "" : "s"} de {duracao} min.
        </p>
      </section>

      <Link
        href="/agenda/alunos"
        className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3.5 hover:border-brand"
      >
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
          <Icone nome="usuario" className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">Alunos e matrículas</span>
          <span className="block text-xs text-ink-3">
            {ativos === 0 ? "Convide seus alunos por link" : `${ativos} ${ativos === 1 ? "aluno ativo" : "alunos ativos"}`}
            {aguardando > 0 && ` · ${aguardando} convite${aguardando > 1 ? "s" : ""} aguardando`}
          </span>
        </span>
        <span className="text-ink-3" aria-hidden="true">›</span>
      </Link>

      <nav className="grid grid-cols-3 gap-2" aria-label="Configurar agenda">
        <Atalho href="/agenda/horarios" icone="relogio" titulo="Horários" texto={faixas.length ? `Aulas de ${duracao} min` : "Configure aqui"} />
        <Atalho href="/agenda/bloqueios" icone="calendario" titulo="Bloqueios" texto={bloqueios.length ? `${bloqueios.length} marcado${bloqueios.length > 1 ? "s" : ""}` : "Férias, feriados…"} />
        <Atalho href="/agenda/valores" icone="estrela" titulo="Valores" texto={menorValor != null ? `A partir de ${centavosParaReais(menorValor)}` : "Cadastre aqui"} />
      </nav>

      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold">O que vem por aí</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          <li>Marcar aula dada, falta, cancelamento e aulas avulsas</li>
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
    <Link href={href} className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-surface p-3 hover:border-brand">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
        <Icone nome={icone} className="size-[18px]" />
      </span>
      <span className="text-sm font-bold">{titulo}</span>
      <span className="text-xs text-ink-3">{texto}</span>
    </Link>
  );
}
