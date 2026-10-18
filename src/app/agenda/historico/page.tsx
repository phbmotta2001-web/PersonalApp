import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FiltroAluno } from "@/components/agenda/FiltroAluno";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAulas, type AulaDaAgenda } from "@/data/matriculas";
import {
  CATEGORIAS_HISTORICO,
  categoriaDoHistorico,
  ROTULO_ORIGEM,
  type CategoriaHistorico,
  type OrigemAula,
} from "@/lib/aula";
import { maiuscula } from "@/lib/formato";
import { agoraEmBrasilia, DIAS, diaDaSemana, emBrasilia, instante, nomeDoDia, somarDias } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Calendário de aulas",
};

// Até quantos meses à frente dá para ver (as aulas fixas existem por 8 semanas).
const MESES_A_FRENTE = 2;
const mesValido = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const dataValida = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const somarMes = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

type AulaDoCalendario = AulaDaAgenda & { categoria: CategoriaHistorico | null; passou: boolean };

export default function PaginaCalendario({ searchParams }: PageProps<"/agenda/historico">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Calendário de aulas">
        <BotaoVoltar reserva="/agenda" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/historico">["searchParams"] }) {
  await exigirPersonal("/agenda/historico");
  const { mes: pedido, aluno, dia: diaPedido } = await searchParams;
  const hoje = agoraEmBrasilia().data;
  const esteMes = hoje.slice(0, 7);
  const ultimoMes = somarMes(esteMes, MESES_A_FRENTE);
  const mes = mesValido(pedido) && pedido <= ultimoMes ? pedido : esteMes;
  const filtro = typeof aluno === "string" ? aluno : "";
  const primeiroDia = `${mes}-01`;
  const proximoMes = `${somarMes(mes, 1)}-01`;
  const diasNoMes = Math.round((Date.parse(proximoMes) - Date.parse(primeiroDia)) / 86_400_000);
  const dia =
    dataValida(diaPedido) && diaPedido.startsWith(mes) ? diaPedido : hoje.startsWith(mes) ? hoje : primeiroDia;

  const [aulas, todos] = await Promise.all([
    listarAulas(instante(primeiroDia, 0).toISOString(), instante(proximoMes, 0).toISOString()),
    listarMeusAlunos(),
  ]);
  const agora = new Date();
  // Passadas entram com a cor do tipo; futuras, como aulas marcadas (ou pedidos aguardando).
  const doCalendario: AulaDoCalendario[] = aulas
    .filter((a) => (!filtro || a.vinculoId === filtro) && a.situacao !== "recusada" && a.situacao !== "remarcada")
    .map((a) => ({
      ...a,
      categoria: categoriaDoHistorico(a.situacao, a.origem, a.fim, agora),
      passou: Date.parse(a.fim) <= agora.getTime(),
    }))
    // Canceladas (mesmo as futuras, avisadas antes) entram com a cor de cancelada ou perdida.
    .filter((a) => a.categoria !== null || !a.passou)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  const doDia = (d: string) => doCalendario.filter((a) => emBrasilia(a.inicio).data === d);
  const contagem = Object.fromEntries(
    CATEGORIAS_HISTORICO.map((c) => [c.valor, doCalendario.filter((a) => a.passou && a.categoria === c.valor).length]),
  );
  const marcadas = doCalendario.filter((a) => !a.passou && a.categoria === null).length;

  // Grade de segunda a domingo; os dias antes do dia 1 ficam vazios.
  const recuo = (diaDaSemana(primeiroDia) + 6) % 7;
  const casas: (string | null)[] = [
    ...Array.from({ length: recuo }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => somarDias(primeiroDia, i)),
  ];
  while (casas.length % 7) casas.push(null);

  const alunos = todos.filter((a) => a.situacao === "ativo" || a.vinculoId === filtro);
  const nomeDoMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const link = (m: string, d?: string) =>
    `/agenda/historico?mes=${m}${filtro ? `&aluno=${filtro}` : ""}${d ? `&dia=${d}` : ""}`;
  const listaDoDia = doDia(dia);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <div className="flex items-center gap-2">
        <Link
          href={link(somarMes(mes, -1))}
          aria-label="Mês anterior"
          className="grid size-9 place-items-center rounded-full border border-line bg-surface"
        >
          ‹
        </Link>
        <h2 className="flex-1 text-center text-[17px] font-semibold">{maiuscula(nomeDoMes)}</h2>
        {mes < ultimoMes ? (
          <Link
            href={link(somarMes(mes, 1))}
            aria-label="Próximo mês"
            className="grid size-9 place-items-center rounded-full border border-line bg-surface"
          >
            ›
          </Link>
        ) : (
          <span className="size-9" />
        )}
      </div>

      <FiltroAluno alunos={alunos.map((a) => ({ vinculoId: a.vinculoId, nome: a.nome }))} atual={filtro} mes={mes} />

      <section aria-label="Calendário do mês" className="rounded-[20px] border border-line bg-surface p-2">
        <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-ink-3">
          {DIAS.map((d) => (
            <span key={d.valor}>{d.curto}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {casas.map((d, i) => {
            if (!d) return <span key={`v${i}`} />;
            const lista = doDia(d);
            const escolhido = d === dia;
            const ehHoje = d === hoje;
            return (
              <Link
                key={d}
                href={link(mes, d)}
                scroll={false}
                aria-label={`${nomeDoDia(diaDaSemana(d))} ${Number(d.slice(8))}: ${lista.length} aula${lista.length === 1 ? "" : "s"}`}
                aria-current={escolhido ? "date" : undefined}
                className={`flex min-h-[54px] flex-col items-center gap-1 rounded-[12px] pt-1.5 pb-1 ${
                  escolhido ? "bg-ink text-app" : ehHoje ? "bg-brand-soft" : "hover:bg-surface-2"
                } ${d < hoje && !escolhido ? "text-ink-2" : ""}`}
              >
                <span className={`text-[13px] tabular-nums ${ehHoje ? "font-extrabold" : "font-semibold"}`}>
                  {Number(d.slice(8))}
                </span>
                <span className="flex max-w-full flex-wrap justify-center gap-0.5 px-0.5">
                  {lista.slice(0, 4).map((a) => (
                    <span
                      key={a.id}
                      className={`size-[7px] rounded-full ${
                        a.categoria
                          ? CATEGORIAS_HISTORICO.find((c) => c.valor === a.categoria)!.ponto
                          : `border ${escolhido ? "border-app" : "border-brand"}`
                      }`}
                    />
                  ))}
                  {lista.length > 4 && <span className="text-[9px] leading-[7px] font-bold">+</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] text-ink-2" aria-label="Legenda">
        {CATEGORIAS_HISTORICO.map((c) => (
          <span key={c.valor} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${c.ponto}`} aria-hidden="true" />
            {c.rotulo} <strong className="tabular-nums">{contagem[c.valor]}</strong>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-brand" aria-hidden="true" />
          Marcadas <strong className="tabular-nums">{marcadas}</strong>
        </span>
      </section>
      <p className="-mt-2 text-[11px] text-ink-3">
        Perdidas = faltas e cancelamentos em cima da hora. Aula que passou sem marcação conta como dada.
      </p>

      <section className="flex flex-col gap-2" aria-label="Aulas do dia escolhido">
        <h3 className="text-[15px] font-bold">
          {dia === hoje ? "Hoje" : nomeDoDia(diaDaSemana(dia))}{" "}
          <span className="font-normal text-ink-3">
            {dia.slice(8, 10)}/{dia.slice(5, 7)}
          </span>
        </h3>
        {listaDoDia.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-line p-3 text-sm text-ink-3">Nenhuma aula neste dia.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {listaDoDia.map((a) => {
              const cat = a.categoria ? CATEGORIAS_HISTORICO.find((c) => c.valor === a.categoria)! : null;
              const etiqueta = !cat
                ? a.situacao === "pendente"
                  ? "Aguardando"
                  : "Marcada"
                : cat.valor === "dada"
                  ? "Dada"
                  : cat.valor === "reposicao"
                    ? "Reposição"
                    : cat.valor === "cancelada"
                      ? "Cancelada"
                      : a.situacao === "falta"
                        ? "Falta"
                        : "Em cima da hora";
              return (
                <li key={a.id}>
                  <Link
                    href={`/agenda/aula/${a.id}`}
                    className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2.5"
                  >
                    <span
                      className={`h-9 w-1.5 shrink-0 rounded-full ${cat ? cat.ponto : "border border-brand"}`}
                      aria-hidden="true"
                    />
                    <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{emBrasilia(a.inicio).hora}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.nome}</span>
                      {a.origem !== "fixa" && (
                        <span className="block text-xs text-ink-3">{ROTULO_ORIGEM[a.origem as OrigemAula]}</span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cat ? cat.etiqueta : "bg-brand-soft text-brand"}`}
                    >
                      {etiqueta}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
