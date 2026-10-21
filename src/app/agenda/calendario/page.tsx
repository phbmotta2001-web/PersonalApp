import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carregando } from "@/components/Formulario";
import { CalendarioDoMes, mesValido, paraCalendario, somarMes } from "@/components/agenda/CalendarioDoMes";
import { Icone, type NomeIcone } from "@/components/Icone";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { aniversariantesDoMes } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
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
import { maiuscula } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Agenda",
};

// No calendário expandido dá para ver até 2 meses à frente (as aulas fixas existem por 8 semanas).
const MESES_A_FRENTE = 2;
const dataValida = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export default function PaginaAgenda({ searchParams }: PageProps<"/agenda/calendario">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
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

  const [expediente, bloqueios, aulas, aniversarios, suspensas] = await Promise.all([
    lerExpediente(),
    listarBloqueios(),
    listarAulas(instante(inicioSemana, 0).toISOString(), instante(somarDias(inicioSemana, 7), 0).toISOString()),
    aniversariantesDoMes(dia),
    matriculasSuspensas(),
  ]);
  const doMes = expandida
    ? paraCalendario(
        await listarAulas(instante(`${mes}-01`, 0).toISOString(), instante(`${somarMes(mes, 1)}-01`, 0).toISOString()),
        new Date(),
      )
    : [];
  const nomeDoMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
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
  const totalLivres = semana.reduce((n, d) => n + d.livres.length, 0);

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Agenda</h1>

      <section className="flex flex-col gap-3" aria-label="Agenda da semana">
        <div className="flex items-center gap-2">
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
          <Link
            href={expandida ? `/agenda/calendario?dia=${dia}` : `/agenda/calendario?ver=mes&dia=${dia}`}
            scroll={false}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold"
          >
            {expandida ? "Recolher" : "Expandir"}
          </Link>
        </div>

        {expandida ? (
          <>
            <CalendarioDoMes
              mes={mes}
              dia={dia}
              hoje={hoje}
              aulas={doMes}
              linkDoDia={(d) => `/agenda/calendario?ver=mes&mes=${mes}&dia=${d}`}
            />
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-2" aria-label="Legenda">
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
          </>
        ) : (
        <nav className="grid grid-cols-7 gap-1" aria-label="Dias da semana">
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
                className={`flex flex-col items-center gap-0.5 rounded-[14px] py-2 text-xs ${
                  ativo ? "bg-ink text-app" : p > 0 ? "border border-dashed border-info bg-info-soft/60 text-ink-2" : "border border-line bg-surface text-ink-2"
                }`}
              >
                <span>{curtoDoDia(d.diaSemana)}</span>
                <span className="text-[15px] font-bold tabular-nums">{d.data.slice(8, 10)}</span>
                <span className={`text-[10.5px] ${ativo ? "" : "text-ink-3"}`}>
                  {n > 0 ? `${n} aula${n > 1 ? "s" : ""}` : p > 0 ? "" : d.trabalha ? "livre" : "folga"}
                </span>
                {p > 0 && <span className={`text-[10px] font-bold ${ativo ? "" : "text-info"}`}>{p === 1 ? "pausa" : `${p} pausas`}</span>}
              </Link>
            );
          })}
        </nav>
        )}

        <div className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-bold">
              {rotuloDoDia} <span className="font-normal text-ink-3 tabular-nums">{dataCurta(dia)}</span>
            </p>
            {dia >= hoje && (
              <Link
                href={`/agenda/aula/nova?dia=${dia}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-brand-ink"
              >
                <Icone nome="mais" className="size-4" /> Aula
              </Link>
            )}
          </div>
          {aniversariosDoDia.map((a) => (
            <Link
              key={a.vinculoId}
              href={`/agenda/alunos/${a.vinculoId}`}
              className="flex items-center gap-2 rounded-[12px] bg-gold-soft px-3 py-2 text-[13px] text-gold"
            >
              <Icone nome="estrela" className="size-4 shrink-0" />
              <span>
                <strong>Aniversário de {a.nome.split(" ")[0]}</strong> (faz {a.fazAnos})
              </span>
            </Link>
          ))}
          {doDia.bloqueios.length > 0 && (
            <p className="rounded-[12px] bg-gold-soft px-3 py-2 text-xs text-gold">Bloqueado: {doDia.bloqueios.join(", ")}</p>
          )}
          {aulasDoDia.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {aulasDoDia.map((a) => {
                const s = situacaoEfetiva(a.situacao, a.fim, agora);
                const riscada = naoAcontece(s);
                if (s === "pausada")
                  return (
                    <li key={a.id}>
                      <div className="my-1.5 flex items-start gap-3 rounded-[12px] border border-dashed border-info bg-info-soft/60 px-2.5 py-2 text-info">
                        <span className="w-[82px] shrink-0 text-sm font-bold tabular-nums">
                          {emBrasilia(a.inicio).hora}–{emBrasilia(a.fim).hora}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{a.nome} · em pausa</span>
                          <span className="block text-xs">Horário livre para reposição ou aula avulsa</span>
                        </span>
                      </div>
                    </li>
                  );
                return (
                  <li key={a.id}>
                    <Link href={`/agenda/aula/${a.id}`} className="flex items-start gap-3 py-2.5">
                      <span className={`w-[92px] shrink-0 text-sm font-bold tabular-nums ${riscada ? "text-ink-3 line-through" : ""}`}>
                        {emBrasilia(a.inicio).hora}–{emBrasilia(a.fim).hora}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${riscada ? "text-ink-3 line-through" : ""}`}>
                          {a.nome}
                        </span>
                        {a.local && !riscada && <span className="block truncate text-xs text-ink-3">{a.local}</span>}
                        {a.origem !== "fixa" && !riscada && (
                          <span className="block text-xs text-ink-3">{ROTULO_ORIGEM[a.origem as OrigemAula]}</span>
                        )}
                        {!riscada && caiEmBloqueio(a) && <span className="block text-xs font-semibold text-gold">Cai num bloqueio</span>}
                        {!riscada && a.vinculoId && suspensas[a.vinculoId] && (
                          <span className="block text-xs font-semibold text-bad">Matrícula suspensa (mensalidade vencida)</span>
                        )}
                      </span>
                      {s !== "agendada" && s !== "confirmada" && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_SITUACAO[s]}`}>
                          {s === "pendente"
                            ? a.propostaPor === "personal"
                              ? "Aguardando aluno"
                              : "Aguardando você"
                            : ROTULO_SITUACAO[s].split(" (")[0]}
                        </span>
                      )}
                      <span className="text-ink-3" aria-hidden="true">›</span>
                    </Link>
                  </li>
                );
              })}
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
                {doDia.livres.map((m) => {
                  const pausa = pausaNoHorario(m);
                  return pausa ? (
                    <span
                      key={m}
                      title={`Horário de ${pausa.nome} (em pausa): só reposição ou aula avulsa`}
                      className="rounded-lg border border-dashed border-info bg-info-soft px-2 py-0.5 text-xs font-bold text-info tabular-nums"
                    >
                      {minParaHora(m)}*
                    </span>
                  ) : (
                    <span key={m} className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
                      {minParaHora(m)}
                    </span>
                  );
                })}
              </span>
              {pausasDoDia.length > 0 && (
                <p className="text-xs text-info">
                  * Horário de {[...new Set(pausasDoDia.map((a) => a.nome.split(" ")[0]))].join(" e ")} (em pausa): use só
                  para reposição ou aula avulsa. O horário fixo continua dele.
                </p>
              )}
            </div>
          ) : (
            <p className="border-t border-line pt-2.5 text-xs text-ink-3">{doDia.trabalha ? "Sem horários livres." : "Folga."}</p>
          )}
        </div>
        {!expandida && (
        <p className="text-xs text-ink-3">
          Nesta semana: {aulasQueOcupam.length} aula{aulasQueOcupam.length === 1 ? "" : "s"} · {totalLivres} horário
          {totalLivres === 1 ? "" : "s"} livre{totalLivres === 1 ? "" : "s"} de {duracao} min.
        </p>
        )}
      </section>

      <nav className="grid grid-cols-2 gap-2" aria-label="Configurar agenda">
        <Atalho href="/agenda/horarios" icone="relogio" titulo="Horários" texto={faixas.length ? `Aulas de ${duracao} min` : "Configure aqui"} />
        <Atalho href="/agenda/bloqueios" icone="calendario" titulo="Bloqueios" texto={bloqueios.length ? `${bloqueios.length} marcado${bloqueios.length > 1 ? "s" : ""}` : "Férias, feriados…"} />
      </nav>

      <BarraDoPersonal />
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
