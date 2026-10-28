import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { Carregando } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { InstalarApp } from "@/components/InstalarApp";
import { aulasParaDecidir, pedidosPendentes, reposicoesPorAluno } from "@/data/aulas";
import { contarAvisosNaoLidos } from "@/data/avisos";
import { financeiroDoMes, listarCobrancas } from "@/data/cobrancas";
import { aniversariantesDoMes, listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAulas, matriculasSuspensas } from "@/data/matriculas";
import { linkWhatsapp } from "@/lib/convite";
import { situacaoDaCobranca } from "@/lib/cobranca";
import { agoraEmBrasilia, curtoDoDia, dataCurta, diaDaSemana, emBrasilia, somarDias } from "@/lib/expediente";
import { centavosParaReais, textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Início",
};

export default function PaginaInicio() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-[1200px]">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

// Aba "Início" do personal (redesign "Foco no hoje", 22/10/2026): primeiro a próxima
// aula, depois o resto do dia, o que precisa de você e o dinheiro do mês.
async function Conteudo() {
  const personal = await exigirPersonal("/agenda");
  const hoje = agoraEmBrasilia().data;
  const agora = new Date();
  const [naoLidos, pedidos, aulas, financeiro, cobrancas, aniversarios, suspensas, alunos, decidir, reposicoes] = await Promise.all([
    contarAvisosNaoLidos(),
    pedidosPendentes(),
    listarAulas(agora.toISOString(), new Date(agora.getTime() + 7 * 86_400_000).toISOString()),
    financeiroDoMes(hoje),
    listarCobrancas(),
    aniversariantesDoMes(hoje),
    matriculasSuspensas(),
    listarMeusAlunos(),
    aulasParaDecidir(),
    reposicoesPorAluno(),
  ]);
  const vindouras = aulas.filter(
    (a) => (a.situacao === "agendada" || a.situacao === "confirmada") && Date.parse(a.fim) > agora.getTime(),
  );
  const [proxima, ...resto] = vindouras;
  const deHoje = resto.filter((a) => emBrasilia(a.inicio).data === hoje);
  const aulasHoje = vindouras.filter((a) => emBrasilia(a.inicio).data === hoje).length;
  const depois = deHoje.length > 0 ? deHoje : resto.slice(0, 3);
  const avisaram = cobrancas.filter((c) => c.situacao === "aberta" && c.alunoAvisouEm);
  const atrasadas = cobrancas.filter((c) => c.situacao === "aberta" && !c.alunoAvisouEm && situacaoDaCobranca(c, hoje) === "atrasada");
  const nomeDoMes = new Date(`${hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
  const whatsappDe = (vinculo: string | null) => alunos.find((a) => a.vinculoId === vinculo)?.whatsapp ?? null;
  // Reposições que o aluno ainda não marcou (decisão de 28/10/2026): o personal lembra o aluno antes
  // que vençam, senão vira pedido de desconto ou é esquecida. A que vence primeiro vem em cima.
  const pendentes = Object.entries(reposicoes)
    .map(([vinculoId, lista]) => ({
      vinculoId,
      quantas: lista.length,
      venceEm: lista.map((c) => c.validoAte).sort()[0],
      aluno: alunos.find((a) => a.vinculoId === vinculoId),
    }))
    .filter((p) => p.quantas > 0 && p.aluno && p.aluno.situacao === "ativo")
    .sort((x, y) => x.venceEm.localeCompare(y.venceEm));
  const aniversariosProximos = aniversarios.filter((a) => a.dia >= Number(hoje.slice(8, 10)));

  // "Agora", "em 25 min", "hoje às 18:00", "amanhã às 07:00", "qui, 23/10 às 07:00"
  const quando = (inicio: string, fim: string) => {
    const ms = Date.parse(inicio) - agora.getTime();
    if (ms <= 0 && Date.parse(fim) > agora.getTime()) return "Acontecendo agora";
    if (ms < 2 * 3_600_000) return `Começa em ${Math.max(1, Math.round(ms / 60_000))} min`;
    const d = emBrasilia(inicio);
    if (d.data === hoje) return `Hoje às ${d.hora}`;
    if (d.data === somarDias(hoje, 1)) return `Amanhã às ${d.hora}`;
    return textoDaAula(inicio, null);
  };

  // No computador (opção C): à esquerda o que precisa de você; à direita a próxima aula,
  // o dinheiro do mês e o resto do dia. No celular, uma coluna só (a ordem vem do "order").
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-x-6 lg:px-8 lg:pt-8 lg:pb-12">
      <div className="flex flex-col gap-4 lg:col-span-2">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[14px] text-ink-3">Área do personal</p>
          <h1 className="text-[24px] font-extrabold">Olá, {personal.nomeCompleto.split(" ")[0]}</h1>
        </div>
        <Link
          href="/agenda/avisos"
          aria-label={naoLidos > 0 ? `Avisos: ${naoLidos} novo${naoLidos > 1 ? "s" : ""}` : "Avisos"}
          className={`relative grid size-11 place-items-center rounded-full border border-line bg-surface ${naoLidos > 0 ? "sino-tocando" : ""}`}
        >
          <Icone nome="sino" className="size-5" />
          {naoLidos > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[12.5px] font-bold text-white tabular-nums">
              {naoLidos > 9 ? "9+" : naoLidos}
            </span>
          )}
        </Link>
      </header>

      <InstalarApp />
      <AtivarNotificacoes texto="Receba na hora os pedidos e avisos dos alunos, os pagamentos e as mensalidades que vencem hoje." />

      {/* Fase 1: as contas nascem liberadas (sem conferência do CREF); só a suspensão avisa. */}
      {personal.situacao === "suspenso" && (
        <section className="rounded-[20px] bg-gold-soft p-4 text-[14.5px] text-gold">
          <p className="font-bold">Conta suspensa</p>
          <p className="mt-1">Fale com a equipe do Pienel.</p>
        </section>
      )}

      </div>

      <div className="contents lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:gap-4">
      {/* Próxima aula em destaque. */}
      <section className="flex flex-col gap-3 rounded-[24px] bg-deep p-5 text-on-deep" aria-label="Próxima aula">
        {proxima ? (
          <>
            <div>
              <p className="text-[14px] text-on-deep-2">{quando(proxima.inicio, proxima.fim)}</p>
              <p className="font-display text-[30px] leading-tight font-extrabold">
                {emBrasilia(proxima.inicio).hora} · {proxima.nome.split(" ")[0]}
              </p>
              <p className="text-[14px] text-on-deep-2">
                {[proxima.local, proxima.vinculoId && suspensas[proxima.vinculoId] ? "matrícula suspensa" : null]
                  .filter(Boolean)
                  .join(" · ") || proxima.nome}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/agenda/aula/${proxima.id}`}
                className="flex min-h-12 items-center justify-center rounded-[14px] bg-on-deep text-[14.5px] font-bold text-deep"
              >
                Ver aula
              </Link>
              {whatsappDe(proxima.vinculoId) ? (
                <a
                  href={linkWhatsapp(whatsappDe(proxima.vinculoId), `Oi, ${proxima.nome.split(" ")[0]}!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border border-on-deep/30 text-[14.5px] font-bold"
                >
                  <Icone nome="conversa" className="size-4" /> WhatsApp
                </a>
              ) : (
                <Link
                  href="/agenda/calendario"
                  className="flex min-h-12 items-center justify-center rounded-[14px] border border-on-deep/30 text-[14.5px] font-bold"
                >
                  Ver agenda
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-[20px] font-extrabold">Nenhuma aula nos próximos 7 dias</p>
            <Link
              href="/agenda/aula/nova"
              className="flex min-h-12 items-center justify-center rounded-[14px] bg-on-deep text-[14.5px] font-bold text-deep"
            >
              Marcar uma aula
            </Link>
          </>
        )}
      </section>

      {depois.length > 0 && (
        <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Próximas aulas">
          <div className="flex items-center gap-2 pb-1">
            <h2 className="flex-1 text-[16px] font-semibold">
              {deHoje.length > 0 ? "Ainda hoje" : "Próximas"}
              {aulasHoje > 0 && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[13px] font-bold text-ink-2">
                  {aulasHoje} aula{aulasHoje > 1 ? "s" : ""} hoje
                </span>
              )}
            </h2>
            <Link href="/agenda/calendario" className="text-[14px] font-semibold text-brand">
              Agenda ›
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {depois.map((a) => (
              <li key={a.id}>
                <Link href={`/agenda/aula/${a.id}`} className="flex items-center gap-3 py-2">
                  {/* Hoje: só a hora. Outros dias: o dia em cima e a hora embaixo (não cabem lado a lado). */}
                  <span className="flex w-[64px] shrink-0 flex-col leading-tight tabular-nums">
                    <span className="text-[15px] font-extrabold">{emBrasilia(a.inicio).hora}</span>
                    {deHoje.length === 0 && <span className="text-[12.5px] font-semibold text-ink-3">{diaCurto(a.inicio)}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{a.nome}</span>
                    {a.local && <span className="block truncate text-[13px] text-ink-3">{a.local}</span>}
                  </span>
                  <span className="text-ink-3" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/agenda/financeiro" className="order-2 grid grid-cols-2 gap-2 lg:order-none" aria-label="Financeiro do mês">
        <span className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3.5">
          <span className="text-[13px] text-ink-3">Recebido em {nomeDoMes}</span>
          <span className="font-display text-[23px] font-extrabold text-ok tabular-nums">{centavosParaReais(financeiro.recebido)}</span>
        </span>
        <span className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3.5">
          <span className="text-[13px] text-ink-3">A receber</span>
          <span className="font-display text-[23px] font-extrabold tabular-nums">{centavosParaReais(financeiro.aReceber)}</span>
        </span>
      </Link>
      </div>

      <div className="contents lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:gap-4">
      <section className="order-1 flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3 lg:order-none" aria-label="Precisa de você">
        <h2 className="pb-1 text-[16px] font-semibold">Precisa de você</h2>
        {pedidos.length + decidir.length + avisaram.length + atrasadas.length === 0 ? (
          <p className="flex items-center gap-2 pb-1 text-[14px] text-ok">
            <Icone nome="certo" className="size-4" /> Tudo em dia por aqui.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {pedidos.map((p) => (
              <Pendencia key={p.id} href={`/agenda/aula/${p.id}`} icone="calendario" tom="text-gold">
                <strong>{p.nome.split(" ")[0]}</strong> {p.remarcacao ? "quer remarcar para" : "pediu reposição em"}{" "}
                {textoDaAula(p.inicio, null)}
              </Pendencia>
            ))}
            {decidir.map((a) => (
              <Pendencia key={a.id} href={`/agenda/aula/${a.id}`} icone="calendario" tom="text-bad">
                <strong>{a.nome.split(" ")[0]}</strong> não aceitou remarcar a aula de {textoDaAula(a.inicio, null)}: cancelar ou manter?
              </Pendencia>
            ))}
            {avisaram.map((c) => (
              <Pendencia key={c.id} href="/agenda/financeiro" icone="certo" tom="text-ok">
                <strong>{c.nome.split(" ")[0]}</strong> avisou que pagou {centavosParaReais(c.valorCentavos)}
              </Pendencia>
            ))}
            {atrasadas.slice(0, 3).map((c) => (
              <Pendencia key={c.id} href={`/agenda/cobrancas/${c.id}`} icone="dinheiro" tom="text-bad">
                <strong>{c.nome.split(" ")[0]}</strong> · {centavosParaReais(c.valorCentavos)} em atraso
              </Pendencia>
            ))}
            {atrasadas.length > 3 && (
              <Pendencia href="/agenda/financeiro" icone="dinheiro" tom="text-bad">
                e mais {atrasadas.length - 3} em atraso
              </Pendencia>
            )}
          </ul>
        )}
      </section>

      {pendentes.length > 0 && (
        <section className="order-1 flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3 lg:order-none" aria-label="Reposições pendentes">
          <h2 className="pb-1 text-[16px] font-semibold">
            Reposições pendentes
            <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[13px] font-bold text-ink-2">
              {pendentes.reduce((n, p) => n + p.quantas, 0)}
            </span>
          </h2>
          <p className="pb-1 text-[13px] text-ink-3">Lembre o aluno de marcar antes de vencer.</p>
          <ul className="flex flex-col divide-y divide-line">
            {pendentes.map((p) => {
              const nome = p.aluno!.nome;
              const primeiro = nome.split(" ")[0];
              const logo = p.venceEm <= somarDias(hoje, 7);
              const texto = `${p.quantas} reposiç${p.quantas > 1 ? "ões" : "ão"} · ${p.quantas > 1 ? "a primeira vence" : "vence"} ${p.venceEm === hoje ? "hoje" : `em ${dataCurta(p.venceEm)}`}`;
              const mensagem = `Oi, ${primeiro}! Você tem ${p.quantas === 1 ? "uma reposição" : `${p.quantas} reposições`} para marcar até ${dataCurta(p.venceEm)}. Vamos combinar um horário?`;
              return (
                <li key={p.vinculoId} className="flex items-center gap-2.5 py-2">
                  <Link href={`/agenda/alunos/${p.vinculoId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{nome}</span>
                    <span className={`block text-[13px] ${logo ? "font-semibold text-gold" : "text-ink-3"}`}>{texto}</span>
                  </Link>
                  {p.aluno!.whatsapp ? (
                    <a
                      href={linkWhatsapp(p.aluno!.whatsapp, mensagem)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-[12px] border border-line px-3 text-[14px] font-bold"
                    >
                      <Icone nome="conversa" className="size-4" /> Lembrar
                    </a>
                  ) : (
                    <Link
                      href={`/agenda/alunos/${p.vinculoId}`}
                      className="flex min-h-10 shrink-0 items-center rounded-[12px] border border-line px-3 text-[14px] font-bold"
                    >
                      Ver
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {aniversariosProximos.length > 0 && (
        <section className="order-3 flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3 lg:order-none" aria-label="Aniversários do mês">
          <h2 className="flex items-center gap-2 pb-1 text-[16px] font-semibold">
            <Icone nome="estrela" className="size-[18px] text-gold" /> Aniversários
          </h2>
          <ul className="flex flex-col">
            {aniversariosProximos.map((a) => {
              const ehHoje = a.dia === Number(hoje.slice(8, 10));
              return (
                <li key={a.vinculoId}>
                  <Link href={`/agenda/alunos/${a.vinculoId}`} className="flex items-center gap-3 py-1.5 text-[15px]">
                    <span className="w-14 shrink-0 font-bold tabular-nums">dia {a.dia}</span>
                    <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                    {ehHoje ? (
                      <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[12.5px] font-bold text-gold">hoje · {a.fazAnos}</span>
                    ) : (
                      <span className="shrink-0 text-[13px] text-ink-3">faz {a.fazAnos}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}

/** "qui 23/10" */
function diaCurto(inicio: string): string {
  const { data } = emBrasilia(inicio);
  return `${curtoDoDia(diaDaSemana(data)).toLowerCase()} ${dataCurta(data)}`;
}

function Pendencia({ href, icone, tom, children }: { href: string; icone: NomeIcone; tom: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2.5 py-2 text-[14.5px]">
        <Icone nome={icone} className={`size-[18px] shrink-0 ${tom}`} />
        <span className="min-w-0 flex-1">{children}</span>
        <span className="text-ink-3" aria-hidden="true">›</span>
      </Link>
    </li>
  );
}
