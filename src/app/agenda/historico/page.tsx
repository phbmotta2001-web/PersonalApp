import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FiltroAluno } from "@/components/agenda/FiltroAluno";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { listarAulas } from "@/data/matriculas";
import { CATEGORIAS_HISTORICO, categoriaDoHistorico, ROTULO_ORIGEM, type OrigemAula } from "@/lib/aula";
import { agoraEmBrasilia, curtoDoDia, dataCurta, diaDaSemana, emBrasilia, instante } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Histórico de aulas",
};

const mesValido = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const somarMes = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function PaginaHistorico({ searchParams }: PageProps<"/agenda/historico">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Histórico de aulas">
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
  const { mes: pedido, aluno } = await searchParams;
  const esteMes = agoraEmBrasilia().data.slice(0, 7);
  const mes = mesValido(pedido) && pedido <= esteMes ? pedido : esteMes;
  const filtro = typeof aluno === "string" ? aluno : "";

  const [aulas, todos] = await Promise.all([
    listarAulas(instante(`${mes}-01`, 0).toISOString(), instante(`${somarMes(mes, 1)}-01`, 0).toISOString()),
    listarMeusAlunos(),
  ]);
  const agora = new Date();
  // Do mais recente para o mais antigo.
  const doHistorico = aulas
    .filter((a) => !filtro || a.vinculoId === filtro)
    .map((a) => ({ ...a, categoria: categoriaDoHistorico(a.situacao, a.origem, a.fim, agora) }))
    .filter((a) => a.categoria !== null)
    .reverse();
  const contagem = Object.fromEntries(
    CATEGORIAS_HISTORICO.map((c) => [c.valor, doHistorico.filter((a) => a.categoria === c.valor).length]),
  );
  const dias = [...new Set(doHistorico.map((a) => emBrasilia(a.inicio).data))];
  const alunos = todos.filter((a) => a.situacao === "ativo" || a.vinculoId === filtro);
  const nomeDoMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const link = (m: string) => `/agenda/historico?mes=${m}${filtro ? `&aluno=${filtro}` : ""}`;

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
        <h2 className="flex-1 text-center text-[17px] font-semibold capitalize">{nomeDoMes}</h2>
        {mes < esteMes ? (
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

      <section className="grid grid-cols-2 gap-2" aria-label="Resumo do mês">
        {CATEGORIAS_HISTORICO.map((c) => (
          <div key={c.valor} className="flex items-center gap-2.5 rounded-[16px] border border-line bg-surface px-3 py-2.5">
            <span className={`size-3 shrink-0 rounded-full ${c.ponto}`} aria-hidden="true" />
            <span>
              <span className="block text-[20px] leading-tight font-extrabold tabular-nums">{contagem[c.valor]}</span>
              <span className="block text-[11.5px] text-ink-3">{c.rotulo}</span>
            </span>
          </div>
        ))}
      </section>
      <p className="-mt-2 text-[11.5px] text-ink-3">
        Perdidas = faltas e cancelamentos em cima da hora. Aula que passou sem marcação conta como dada.
      </p>

      {dias.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line p-4 text-sm text-ink-3">
          Nenhuma aula neste mês até agora.
        </p>
      ) : (
        dias.map((d) => (
          <section key={d} className="flex flex-col gap-1.5">
            <h3 className="text-[13px] font-bold text-ink-2">
              {curtoDoDia(diaDaSemana(d))} {dataCurta(d)}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {doHistorico
                .filter((a) => emBrasilia(a.inicio).data === d)
                .map((a) => {
                  const cat = CATEGORIAS_HISTORICO.find((c) => c.valor === a.categoria)!;
                  const etiqueta =
                    cat.valor === "dada"
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
                        <span className={`h-9 w-1.5 shrink-0 rounded-full ${cat.ponto}`} aria-hidden="true" />
                        <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{emBrasilia(a.inicio).hora}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{a.nome}</span>
                          {a.origem !== "fixa" && a.origem !== "reposicao" && (
                            <span className="block text-xs text-ink-3">{ROTULO_ORIGEM[a.origem as OrigemAula]}</span>
                          )}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cat.etiqueta}`}>
                          {etiqueta}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
