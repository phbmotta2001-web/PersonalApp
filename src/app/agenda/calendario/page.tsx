import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carregando } from "@/components/Formulario";
import { CalendarioDoMes, mesValido, paraCalendario, somarMes } from "@/components/agenda/CalendarioDoMes";
import { Icone } from "@/components/Icone";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { aniversariantesDoMes } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
import { lerRegraDeFeriados } from "@/data/feriados";
import { listarAulas, matriculasSuspensas } from "@/data/matriculas";
import {
  CATEGORIAS_HISTORICO,
  COR_SITUACAO,
  naoAcontece,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  situacaoEfetiva,
  SITUACOES_QUE_OCUPAM,
  type OrigemAula,
  type SituacaoAula,
} from "@/lib/aula";
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
import { feriadoDoDia, trabalhaNoFeriado } from "@/lib/feriados";
import { maiuscula } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Agenda",
};

// No calendário expandido dá para ver até 2 meses à frente (as aulas fixas existem por 8 semanas).
const MESES_A_FRENTE = 2;
const dataValida = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export default function PaginaAgenda({ searchParams }: PageProps<"/agenda/calendario">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-[1400px]">
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/calendario">["searchParams"] }) {
  await exigirPersonal("/agenda/calendario");
  const { dia: pedido, ver, mes: mesPedido } = await searchParams;
  const hoje = agoraEmBrasilia().data;

  // Recolhida: os 7 dias a partir de hoje. Expandida (?ver=mes): o mês inteiro, com setas.
  const expandida = ver === "mes";
  const ultimoMes = somarMes(hoje.slice(0, 7), MESES_A_FRENTE);
  const mes = mesValido(mesPedido)
    ? mesPedido > ultimoMes ? ultimoMes : mesPedido
    : dataValida(pedido) && pedido.slice(0, 7) <= ultimoMes ? pedido.slice(0, 7) : hoje.slice(0, 7);
  const dia = dataValida(pedido) && (!expandida || pedido.startsWith(mes))
    ? pedido
    : expandida && !hoje.startsWith(mes) ? `${mes}-01` : hoje;
  // O bloco de 7 dias (contado a partir de hoje) em que o dia escolhido cai.
  const distancia = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86_400_000);
  const semanaN = Math.floor(distancia / 7);
  const inicioSemana = somarDias(hoje, semanaN * 7);

  const [expediente, bloqueios, aulas, aniversarios, suspensas, regraFeriados] = await Promise.all([
    lerExpediente(),
    listarBloqueios(),
    listarAulas(instante(inicioSemana, 0).toISOString(), instante(somarDias(inicioSemana, 7), 0).toISOString()),
    aniversariantesDoMes(dia),
    matriculasSuspensas(),
    lerRegraDeFeriados(),
  ]);
  const doMes = expandida
    ? paraCalendario(
        await listarAulas(instante(`${mes}-01`, 0).toISOString(), instante(`${somarMes(mes, 1)}-01`, 0).toISOString()),
        new Date(),
      )
    : [];
  const nomeDoMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const feriado = feriadoDoDia(dia);
  const aniversariosDoDia = aniversarios.filter((a) => a.dia === Number(dia.slice(8, 10)));
  const faixas = expediente?.faixas ?? [];
  const duracao = expediente?.duracao ?? 60;

  const agora = new Date();
  const aulasQueOcupam = aulas.filter((a) => SITUACOES_QUE_OCUPAM.includes(a.situacao as SituacaoAula));
  const semana = horariosLivres(faixas, bloqueios, duracao, 7, new Date(), aulasQueOcupam, inicioSemana);
  const doDia = semana.find((d) => d.data === dia) ?? semana[0];
  const aulasDe = (data: string) => aulasQueOcupam.filter((a) => emBrasilia(a.inicio).data === data);
  // Aulas em pausa: o horário fica livre só para reposição ou aula avulsa (exceção).
  const pausasDe = (data: string) => aulas.filter((a) => a.situacao === "pausada" && emBrasilia(a.inicio).data === data);
  const pausasDoDia = pausasDe(dia);
  const pausaNoHorario = (m: number) =>
    pausasDoDia.find((a) => {
      const [hi, mi] = emBrasilia(a.inicio).hora.split(":").map(Number);
      const [hf, mf] = emBrasilia(a.fim).hora.split(":").map(Number);
      const ini = hi * 60 + mi;
      const fim = hf * 60 + mf;
      return m < fim && m + duracao > ini;
    });
  // No dia escolhido aparecem também as canceladas e remarcadas (riscadas).
  const aulasDoDia = aulas.filter((a) => emBrasilia(a.inicio).data === dia && a.situacao !== "recusada");
  const caiEmBloqueio = (a: { inicio: string; fim: string }) =>
    bloqueios.some((b) => Date.parse(b.inicio) < Date.parse(a.fim) && Date.parse(b.fim) > Date.parse(a.inicio));
  const rotuloDoDia = dia === hoje ? "Hoje" : dia === somarDias(hoje, 1) ? "Amanhã" : nomeDoDia(doDia.diaSemana);
  // Linha do tempo do dia (redesign "Foco no hoje", 22/10/2026): aulas, pausas e horários livres em ordem.
  const minutoDe = (iso: string) => {
    const [h, m] = emBrasilia(iso).hora.split(":").map(Number);
    return h * 60 + m;
  };
  const linhas = [
    ...aulasDoDia.map((a) => ({ min: minutoDe(a.inicio), tipo: a.situacao === "pausada" ? ("pausa" as const) : ("aula" as const), aula: a })),
    ...(dia >= hoje ? doDia.livres.filter((m) => !pausaNoHorario(m)).map((m) => ({ min: m, tipo: "livre" as const, aula: null })) : []),
  ].sort((x, y) => x.min - y.min || (x.tipo === "livre" ? 1 : -1));
  const novaAula = (min?: number) => `/agenda/aula/nova?dia=${dia}${min != null ? `&hora=${min}` : ""}`;
  const totalLivres = semana.reduce((n, d) => n + d.livres.length, 0);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-32 lg:px-8 lg:pt-8 lg:pb-12">
      <h1 className="text-[24px] font-extrabold">Agenda</h1>

      {/* No computador (opção C): a semana em grade à esquerda e o dia escolhido à direita. */}
      <section className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-6 lg:gap-y-4" aria-label="Agenda da semana">
        <div className="flex items-center gap-2 lg:col-span-2">
          {expandida ? (
            <>
              <Link
                href={`/agenda/calendario?ver=mes&mes=${somarMes(mes, -1)}`}
                scroll={false}
                aria-label="Mês anterior"
                className="grid size-9 place-items-center rounded-full border border-line bg-surface"
              >
                ‹
              </Link>
              <h2 className="flex-1 text-center text-[17px] font-semibold">{maiuscula(nomeDoMes)}</h2>
              {mes < ultimoMes ? (
                <Link
                  href={`/agenda/calendario?ver=mes&mes=${somarMes(mes, 1)}`}
                  scroll={false}
                  aria-label="Próximo mês"
                  className="grid size-9 place-items-center rounded-full border border-line bg-surface"
                >
                  ›
                </Link>
              ) : (
                <span className="size-9" />
              )}
            </>
          ) : (
            <h2 className="flex-1 text-[17px] font-semibold">
              {semanaN === 0 ? "Próximos 7 dias" : `${dataCurta(inicioSemana)} a ${dataCurta(somarDias(inicioSemana, 6))}`}
            </h2>
          )}
          {!expandida && (
            <span className="hidden gap-1 lg:flex">
              <Link
                href={`/agenda/calendario?dia=${somarDias(inicioSemana, -7)}`}
                scroll={false}
                aria-label="Semana anterior"
                className="grid size-9 place-items-center rounded-full border border-line bg-surface"
              >
                ‹
              </Link>
              {semanaN !== 0 && (
                <Link href="/agenda/calendario" scroll={false} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] font-semibold">
                  Hoje
                </Link>
              )}
              {somarDias(inicioSemana, 7).slice(0, 7) <= ultimoMes && (
                <Link
                  href={`/agenda/calendario?dia=${somarDias(inicioSemana, 7)}`}
                  scroll={false}
                  aria-label="Próxima semana"
                  className="grid size-9 place-items-center rounded-full border border-line bg-surface"
                >
                  ›
                </Link>
              )}
            </span>
          )}
          <Link
            href={expandida ? `/agenda/calendario?dia=${dia}` : `/agenda/calendario?ver=mes&dia=${dia}`}
            scroll={false}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] font-semibold"
          >
            {expandida ? "Recolher" : "Expandir"}
          </Link>
        </div>

        {expandida ? (
          <div className="flex flex-col gap-3 lg:col-start-1">
            <CalendarioDoMes
              mes={mes}
              dia={dia}
              hoje={hoje}
              aulas={doMes}
              linkDoDia={(d) => `/agenda/calendario?ver=mes&mes=${mes}&dia=${d}`}
            />
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-2" aria-label="Legenda">
              {CATEGORIAS_HISTORICO.map((c) => (
                <span key={c.valor} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${c.ponto}`} aria-hidden="true" />
                  {c.rotulo}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-brand" aria-hidden="true" />
                Marcada
              </span>
            </p>
          </div>
        ) : (
        <>
        <GradeDaSemana
          dias={semana}
          aulas={aulas.filter((a) => a.situacao !== "recusada")}
          duracao={duracao}
          dia={dia}
          hoje={hoje}
          agora={agora}
        />
        <nav className="grid grid-cols-7 gap-1 lg:hidden" aria-label="Dias da semana">
          {semana.map((d) => {
            const n = aulasDe(d.data).length;
            const p = pausasDe(d.data).length;
            const ativo = d.data === dia;
            return (
              <Link
                key={d.data}
                href={`/agenda/calendario?dia=${d.data}`}
                scroll={false}
                aria-current={ativo ? "date" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-[14px] py-2 text-[13px] ${
                  ativo ? "bg-ink text-app" : p > 0 ? "border border-dashed border-info bg-info-soft/60 text-ink-2" : "border border-line bg-surface text-ink-2"
                }`}
              >
                <span>{curtoDoDia(d.diaSemana)}</span>
                <span className="text-[16px] font-bold tabular-nums">{d.data.slice(8, 10)}</span>
                <span className={`text-[12px] ${ativo ? "" : "text-ink-3"}`}>
                  {n > 0 ? `${n} aula${n > 1 ? "s" : ""}` : p > 0 ? "" : feriadoDoDia(d.data) ? "feriado" : d.trabalha ? "livre" : "folga"}
                </span>
                {p > 0 && <span className={`text-[11.5px] font-bold ${ativo ? "" : "text-info"}`}>{p === 1 ? "pausa" : `${p} pausas`}</span>}
              </Link>
            );
          })}
        </nav>
        </>
        )}

        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2">
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Dia escolhido">
          <h2 className="text-[17px] font-bold">
            {rotuloDoDia} <span className="font-normal text-ink-3 tabular-nums">{dataCurta(dia)}</span>
          </h2>
          {aniversariosDoDia.map((a) => (
            <Link
              key={a.vinculoId}
              href={`/agenda/alunos/${a.vinculoId}`}
              className="flex items-center gap-2 rounded-[12px] bg-gold-soft px-3 py-2 text-[14px] text-gold"
            >
              <Icone nome="estrela" className="size-4 shrink-0" />
              <span>
                <strong>Aniversário de {a.nome.split(" ")[0]}</strong> (faz {a.fazAnos})
              </span>
            </Link>
          ))}
          {feriado && (
            <Link
              href="/agenda/feriados"
              className={`flex flex-col rounded-[12px] px-3 py-2 text-[14px] ${trabalhaNoFeriado(regraFeriados, dia) ? "bg-surface-2 text-ink-2" : "bg-gold-soft text-gold"}`}
            >
              <strong>Feriado: {feriado.nome}</strong>
              <span className="text-[13px]">
                {trabalhaNoFeriado(regraFeriados, dia)
                  ? "Você trabalha neste feriado."
                  : "Folga: as aulas fixas foram canceladas e os alunos ganharam reposição."}
              </span>
            </Link>
          )}
          {doDia.bloqueios.filter((b) => !b.startsWith("Feriado: ")).length > 0 && (
            <p className="rounded-[12px] bg-gold-soft px-3 py-2 text-[13px] text-gold">
              Bloqueado: {doDia.bloqueios.filter((b) => !b.startsWith("Feriado: ")).join(", ")}
            </p>
          )}
          {faixas.length === 0 && (
            <p className="text-[14px] text-ink-3">
              Você ainda não configurou seus horários de trabalho.{" "}
              <Link href="/agenda/horarios" className="font-semibold text-brand">
                Configurar agora
              </Link>
            </p>
          )}
          {linhas.length === 0 ? (
            <p className="text-[14px] text-ink-3">{doDia.trabalha ? "Nenhuma aula neste dia." : "Folga."}</p>
          ) : (
            <ol className="flex flex-col">
              {linhas.map((l) => {
                const a = l.aula;
                const s = a ? situacaoEfetiva(a.situacao, a.fim, agora) : null;
                const riscada = s ? naoAcontece(s) : false;
                return (
                  <li
                    key={a ? a.id : `livre-${l.min}`}
                    className="grid grid-cols-[46px_1fr] items-start gap-2 border-t border-dashed border-line py-1.5 first:border-t-0"
                  >
                    <span className={`pt-2 text-[14px] font-bold tabular-nums ${l.tipo === "livre" ? "text-ink-3" : ""}`}>
                      {minParaHora(l.min)}
                    </span>
                    {l.tipo === "livre" ? (
                      <Link href={novaAula(l.min)} className="flex min-h-9 items-center gap-1.5 text-[14px] text-ink-3">
                        livre <span className="font-semibold text-brand">· marcar aula</span>
                      </Link>
                    ) : l.tipo === "pausa" && a ? (
                      <Link
                        href={novaAula(l.min)}
                        className="flex flex-col rounded-[12px] border border-dashed border-info bg-info-soft/60 px-3 py-2 text-info"
                      >
                        <span className="truncate text-[15px] font-bold">{a.nome.split(" ")[0]} · em pausa</span>
                        <span className="text-[13px]">Livre para reposição ou aula avulsa · marcar aqui</span>
                      </Link>
                    ) : a && s ? (
                      <Link
                        href={`/agenda/aula/${a.id}`}
                        className={`flex items-start gap-2 rounded-[12px] px-3 py-2 ${
                          riscada ? "bg-surface-2 text-ink-3" : "border-l-[3px] border-brand bg-brand-soft/70"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[15px] font-bold ${riscada ? "line-through" : ""}`}>{a.nome}</span>
                          <span className="block truncate text-[13px] text-ink-3">
                            {[
                              a.porFeriado ? "feriado · o aluno ganhou reposição" : `até ${emBrasilia(a.fim).hora}`,
                              !riscada && a.local,
                              !riscada && a.origem !== "fixa" && ROTULO_ORIGEM[a.origem as OrigemAula],
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {!riscada && caiEmBloqueio(a) && <span className="block text-[13px] font-semibold text-gold">Cai num bloqueio</span>}
                          {!riscada && a.vinculoId && suspensas[a.vinculoId] && (
                            <span className="block text-[13px] font-semibold text-bad">Matrícula suspensa</span>
                          )}
                        </span>
                        {s !== "agendada" && s !== "confirmada" && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-bold ${COR_SITUACAO[s]}`}>
                            {s === "pendente"
                              ? a.propostaPor === "personal"
                                ? "Aguardando aluno"
                                : "Aguardando você"
                              : ROTULO_SITUACAO[s].split(" (")[0]}
                          </span>
                        )}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        {!expandida && (
        <p className="text-[13px] text-ink-3">
          Nesta semana: {aulasQueOcupam.length} aula{aulasQueOcupam.length === 1 ? "" : "s"} · {totalLivres} horário
          {totalLivres === 1 ? "" : "s"} livre{totalLivres === 1 ? "" : "s"} de {duracao} min.
        </p>
        )}
        </div>
      </section>

      {dia >= hoje && (
        <Link
          href={novaAula()}
          className="botao-macio fixed right-[max(18px,calc(50vw-14rem+18px))] bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 lg:right-8 lg:bottom-8 flex items-center gap-1.5 rounded-full bg-brand px-4 py-3 text-[15px] font-extrabold text-brand-ink"
        >
          <Icone nome="mais" className="size-4" /> Aula
        </Link>
      )}

      <BarraDoPersonal />
    </div>
  );
}


type AulaDaSemana = Awaited<ReturnType<typeof listarAulas>>[number];
// Altura de 1 minuto na grade (px): 1 hora = 54 px.
const PX_POR_MIN = 0.9;

/**
 * Semana em grade de horários (só no computador): uma coluna por dia, as aulas na
 * altura do horário, horários livres em tracejado (clique para marcar) e pausas em azul.
 */
function GradeDaSemana({
  dias,
  aulas,
  duracao,
  dia,
  hoje,
  agora,
}: {
  dias: { data: string; diaSemana: number; livres: number[]; trabalha: boolean }[];
  aulas: AulaDaSemana[];
  duracao: number;
  dia: string;
  hoje: string;
  agora: Date;
}) {
  const minutoDe = (iso: string) => {
    const [h, m] = emBrasilia(iso).hora.split(":").map(Number);
    return h * 60 + m;
  };
  const doDia = (data: string) => aulas.filter((a) => emBrasilia(a.inicio).data === data);
  // Faixa de horas: do primeiro ao último compromisso ou horário livre da semana (padrão 7h–20h).
  const inicios = [...aulas.map((a) => minutoDe(a.inicio)), ...dias.flatMap((d) => d.livres)];
  const fins = [
    ...aulas.map((a) => Math.max(minutoDe(a.inicio) + 30, minutoDe(a.fim) || 24 * 60)),
    ...dias.flatMap((d) => d.livres.map((m) => m + duracao)),
  ];
  const de = inicios.length ? Math.floor(Math.min(...inicios) / 60) * 60 : 7 * 60;
  const ate = fins.length ? Math.min(24 * 60, Math.ceil(Math.max(...fins) / 60) * 60) : 20 * 60;
  const horas = Array.from({ length: Math.max(1, (ate - de) / 60) }, (_, i) => de + i * 60);
  const altura = (ate - de) * PX_POR_MIN;

  return (
    <div className="hidden overflow-hidden rounded-[20px] border border-line bg-surface lg:col-start-1 lg:row-start-2 lg:block" aria-label="Grade da semana">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line">
        <span />
        {dias.map((d) => (
          <Link
            key={d.data}
            href={`/agenda/calendario?dia=${d.data}`}
            scroll={false}
            aria-current={d.data === dia ? "date" : undefined}
            className={`flex flex-col items-center py-2.5 text-[13px] font-semibold ${
              d.data === dia ? "bg-ink text-app" : d.trabalha ? "text-ink-2 hover:bg-surface-2" : "text-ink-3 hover:bg-surface-2"
            }`}
          >
            {curtoDoDia(d.diaSemana)}
            <span className={`text-[19px] font-extrabold tabular-nums ${d.data === hoje && d.data !== dia ? "text-brand" : ""}`}>
              {d.data.slice(8, 10)}
            </span>
            {feriadoDoDia(d.data) && (
              <span className={`max-w-full truncate px-1 text-[11px] font-bold ${d.data === dia ? "" : "text-gold"}`}>
                {feriadoDoDia(d.data)?.nome}
              </span>
            )}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: altura }}>
        <div className="relative">
          {horas.map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[12px] text-ink-3 tabular-nums first:translate-y-0"
              style={{ top: (h - de) * PX_POR_MIN }}
            >
              {minParaHora(h)}
            </span>
          ))}
        </div>
        {dias.map((d) => {
          const lista = doDia(d.data);
          const ocupado = (m: number) =>
            lista.some((a) => m < Math.max(minutoDe(a.fim), minutoDe(a.inicio) + 1) && m + duracao > minutoDe(a.inicio));
          return (
            <div
              key={d.data}
              className={`relative border-l border-line ${d.data === dia ? "bg-brand-soft/30" : ""}`}
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${60 * PX_POR_MIN}px)`,
              }}
            >
              {d.data >= hoje &&
                d.livres
                  .filter((m) => !ocupado(m))
                  .map((m) => (
                    <Link
                      key={`l${m}`}
                      href={`/agenda/aula/nova?dia=${d.data}&hora=${m}`}
                      title={`Livre às ${minParaHora(m)}: marcar aula`}
                      className="absolute inset-x-1 flex items-start rounded-[8px] border border-dashed border-line px-1.5 pt-0.5 text-[11.5px] text-ink-3 hover:border-brand hover:bg-brand-soft/50 hover:text-brand"
                      style={{ top: (m - de) * PX_POR_MIN + 1, height: duracao * PX_POR_MIN - 2 }}
                    >
                      {minParaHora(m)} livre
                    </Link>
                  ))}
              {lista.map((a) => {
                const ini = minutoDe(a.inicio);
                const fim = Math.max(ini + 20, minutoDe(a.fim) || 24 * 60);
                const s = situacaoEfetiva(a.situacao, a.fim, agora);
                const pausa = a.situacao === "pausada";
                const riscada = !pausa && naoAcontece(s);
                const pendente = s === "pendente";
                return (
                  <Link
                    key={a.id}
                    href={pausa ? `/agenda/aula/nova?dia=${d.data}&hora=${ini}` : `/agenda/aula/${a.id}`}
                    title={`${emBrasilia(a.inicio).hora} · ${a.nome}${pausa ? " (em pausa)" : ""}`}
                    className={`absolute inset-x-1 overflow-hidden rounded-[8px] px-1.5 py-1 text-[12px] leading-tight font-bold ${
                      pausa
                        ? "border border-dashed border-info bg-info-soft text-info"
                        : riscada
                          ? "bg-surface-2 text-ink-3 line-through"
                          : pendente
                            ? "border-l-[3px] border-gold bg-gold-soft text-gold"
                            : "border-l-[3px] border-brand bg-brand-soft text-brand hover:brightness-95"
                    }`}
                    style={{ top: (ini - de) * PX_POR_MIN + 1, height: (fim - ini) * PX_POR_MIN - 2 }}
                  >
                    <span className="block truncate">{a.nome.split(" ")[0]}</span>
                    <span className="block truncate text-[11px] font-semibold opacity-80">
                      {pausa ? "pausa · livre" : pendente ? "pedido" : emBrasilia(a.inicio).hora}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
