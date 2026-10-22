import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { InstalarApp } from "@/components/InstalarApp";
import { pedidosPendentes } from "@/data/aulas";
import { contarAvisosNaoLidos } from "@/data/avisos";
import { listarCobrancas, resumoDasCobrancas } from "@/data/cobrancas";
import { aniversariantesDoMes } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAulas, matriculasSuspensas } from "@/data/matriculas";
import { situacaoDaCobranca, textoDoVencimento } from "@/lib/cobranca";
import { agoraEmBrasilia, emBrasilia, somarDias } from "@/lib/expediente";
import { centavosParaReais, textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Início",
};

// Quantas aulas e mensalidades o Início mostra (o resto fica nas abas e telas próprias).
const PROXIMAS = 5;
const DIAS_PARA_VENCER = 7;

export default function PaginaInicio() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

// Aba "Início" do personal: o que pede atenção agora.
async function Conteudo() {
  const personal = await exigirPersonal("/agenda");
  const hoje = agoraEmBrasilia().data;
  const agora = new Date();
  const [naoLidos, pedidos, aulas, resumo, cobrancas, aniversarios, suspensas] = await Promise.all([
    contarAvisosNaoLidos(),
    pedidosPendentes(),
    listarAulas(agora.toISOString(), new Date(agora.getTime() + 7 * 86_400_000).toISOString()),
    resumoDasCobrancas(hoje),
    listarCobrancas(),
    aniversariantesDoMes(hoje),
    matriculasSuspensas(),
  ]);
  const proximas = aulas
    .filter((a) => (a.situacao === "agendada" || a.situacao === "confirmada") && Date.parse(a.fim) > agora.getTime())
    .slice(0, PROXIMAS);
  const vencendo = cobrancas
    .filter((c) => c.situacao === "aberta" && c.vencimento <= somarDias(hoje, DIAS_PARA_VENCER))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const nomeDoMes = new Date(`${hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const quando = (inicio: string) => {
    const d = emBrasilia(inicio);
    return d.data === hoje ? `Hoje ${d.hora}` : d.data === somarDias(hoje, 1) ? `Amanhã ${d.hora}` : textoDaAula(inicio, null);
  };

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-5 pb-28">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-[12.5px] text-ink-3">Área do personal</p>
          <h1 className="text-[24px] font-extrabold">Olá, {personal.nomeCompleto.split(" ")[0]}</h1>
        </div>
        <Link
          href="/agenda/avisos"
          aria-label={naoLidos > 0 ? `Avisos: ${naoLidos} novo${naoLidos > 1 ? "s" : ""}` : "Avisos"}
          className={`relative grid size-11 place-items-center rounded-full border border-line bg-surface ${naoLidos > 0 ? "sino-tocando" : ""}`}
        >
          <Icone nome="sino" className="size-5" />
          {naoLidos > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-white tabular-nums">
              {naoLidos > 9 ? "9+" : naoLidos}
            </span>
          )}
        </Link>
      </header>

      <InstalarApp />
      <AtivarNotificacoes texto="Receba na hora os pedidos e avisos dos alunos, os pagamentos e as mensalidades que vencem hoje." />

      {/* Fase 1: as contas nascem liberadas (sem conferência do CREF); só a suspensão avisa. */}
      {personal.situacao === "suspenso" && (
        <section className="rounded-[20px] bg-gold-soft p-4 text-[13.5px] text-gold">
          <p className="font-bold">Conta suspensa</p>
          <p className="mt-1">Fale com a equipe do Pienel.</p>
        </section>
      )}

      {pedidos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[20px] border-2 border-gold bg-gold-soft p-4" aria-label="Pedidos aguardando você">
          <h2 className="text-[15px] font-bold text-gold">
            {pedidos.length === 1 ? "1 pedido aguardando você" : `${pedidos.length} pedidos aguardando você`}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/agenda/aula/${p.id}`} className="flex items-center gap-2 rounded-[12px] bg-surface px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <strong>{p.nome.split(" ")[0]}</strong> {p.remarcacao ? "quer remarcar para" : "pediu reposição em"}{" "}
                    {textoDaAula(p.inicio, null)}
                  </span>
                  <span className="text-ink-3" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Próximas aulas">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-semibold">Próximas aulas</h2>
          <Link href="/agenda/calendario" className="text-[13px] font-semibold text-brand">
            Ver agenda
          </Link>
        </div>
        {proximas.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nenhuma aula nos próximos 7 dias.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {proximas.map((a) => (
              <li key={a.id}>
                <Link href={`/agenda/aula/${a.id}`} className="flex items-center gap-3 py-2">
                  <span className="w-[104px] shrink-0 text-[13px] font-bold tabular-nums">{quando(a.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.nome}</span>
                    {a.vinculoId && suspensas[a.vinculoId] ? (
                      <span className="block text-xs font-semibold text-bad">Matrícula suspensa</span>
                    ) : (
                      a.local && <span className="block truncate text-xs text-ink-3">{a.local}</span>
                    )}
                  </span>
                  <span className="text-ink-3" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/agenda/cobrancas" className="grid grid-cols-2 gap-2" aria-label="Cobranças">
        <span className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3.5">
          <span className="text-xs text-ink-3">Recebido em {nomeDoMes}</span>
          <span className="text-[19px] font-extrabold text-ok tabular-nums">{centavosParaReais(resumo.recebido)}</span>
        </span>
        <span className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3.5">
          <span className="text-xs text-ink-3">A receber</span>
          <span className="text-[19px] font-extrabold tabular-nums">{centavosParaReais(resumo.aReceber)}</span>
          {resumo.atrasado > 0 && (
            <span className="text-xs font-bold text-bad">+ {centavosParaReais(resumo.atrasado)} atrasado</span>
          )}
        </span>
      </Link>

      <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Mensalidades perto do vencimento">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-semibold">Vencimentos</h2>
          <Link href="/agenda/cobrancas" className="text-[13px] font-semibold text-brand">
            Ver cobranças
          </Link>
        </div>
        {vencendo.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nada vencendo nos próximos {DIAS_PARA_VENCER} dias.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {vencendo.map((c) => {
              const atrasada = situacaoDaCobranca(c, hoje) === "atrasada";
              return (
                <li key={c.id}>
                  <Link href={`/agenda/cobrancas/${c.id}`} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${atrasada ? "text-bad" : ""}`}>{c.nome}</span>
                      <span className={`block text-xs ${atrasada ? "font-semibold text-bad" : "text-ink-3"}`}>
                        {c.alunoAvisouEm ? "Avisou que pagou · confira" : textoDoVencimento(c.vencimento, hoje)}
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular-nums">{centavosParaReais(c.valorCentavos)}</span>
                    <span className="text-ink-3" aria-hidden="true">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {aniversarios.length > 0 && (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Aniversários do mês">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icone nome="estrela" className="size-[18px] text-gold" /> Aniversários de {nomeDoMes}
          </h2>
          <ul className="flex flex-col gap-1">
            {aniversarios.map((a) => {
              const data = `${hoje.slice(0, 8)}${String(a.dia).padStart(2, "0")}`;
              const passou = data < hoje;
              return (
                <li key={a.vinculoId}>
                  <Link href={`/agenda/alunos/${a.vinculoId}`} className={`flex items-center gap-3 py-1 text-sm ${passou ? "text-ink-3" : ""}`}>
                    <span className="w-14 shrink-0 font-bold tabular-nums">dia {a.dia}</span>
                    <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                    <span className="shrink-0 text-xs text-ink-3">faz {a.fazAnos}</span>
                    {data === hoje && <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold">hoje</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
