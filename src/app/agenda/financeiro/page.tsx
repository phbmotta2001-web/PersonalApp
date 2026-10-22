import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { ConfirmarRecebimento } from "@/components/agenda/ConfirmarRecebimento";
import { Avatar, corPorId } from "@/components/Avatar";
import { Carregando } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { financeiroDoMes, listarCobrancas, lerPix, recebidoPorMes } from "@/data/cobrancas";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerTabelaDeValores } from "@/data/precos";
import { descricaoDaCobranca, situacaoDaCobranca, textoDoVencimento, type Cobranca } from "@/lib/cobranca";
import { agoraEmBrasilia, somarDias } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { aPartirDe } from "@/lib/precos";

export const metadata: Metadata = {
  title: "Financeiro",
};

// Quantos dias à frente entram em "Vencendo".
const DIAS_VENCENDO = 7;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function PaginaFinanceiro() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

/** "R$ 3,2 mil" / "R$ 850" — para caber em cima das barras. */
function curto(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 1000) return `${(Math.round(reais / 100) / 10).toLocaleString("pt-BR")} mil`;
  return `R$ ${Math.round(reais)}`;
}

// Aba "Financeiro" do personal (decisão de 22/10/2026, redesign "Foco no hoje").
async function Conteudo() {
  await exigirPersonal("/agenda/financeiro");
  const hoje = agoraEmBrasilia().data;
  const [financeiro, cobrancas, meses, tabela, pix] = await Promise.all([
    financeiroDoMes(hoje),
    listarCobrancas(),
    recebidoPorMes(hoje),
    lerTabelaDeValores(),
    lerPix(),
  ]);
  const abertas = cobrancas.filter((c) => c.situacao === "aberta");
  const avisaram = abertas.filter((c) => c.alunoAvisouEm);
  const atrasadas = abertas.filter((c) => !c.alunoAvisouEm && situacaoDaCobranca(c, hoje) === "atrasada");
  const vencendo = abertas
    .filter((c) => !c.alunoAvisouEm && c.vencimento >= hoje && c.vencimento <= somarDias(hoje, DIAS_VENCENDO))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const maior = Math.max(1, ...meses.map((m) => m.centavos));
  const nomeDoMes = new Date(`${hoje}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  const menorValor = aPartirDe(tabela);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-32">
      <header className="flex items-end gap-2">
        <h1 className="flex-1 text-[24px] font-extrabold">Financeiro</h1>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-[14px] font-semibold text-ink-2 first-letter:uppercase">
          {nomeDoMes}
        </span>
      </header>

      <section className="grid grid-cols-2 gap-2" aria-label="Resumo do mês">
        <Numero titulo="Recebido no mês" valor={financeiro.recebido} cor="text-ok" grande />
        <Numero titulo="A receber" valor={financeiro.aReceber} />
        <Numero titulo="Atrasado" valor={financeiro.atrasado} cor={financeiro.atrasado > 0 ? "text-bad" : undefined} />
      </section>
      {financeiro.previsto > 0 && (
        <p className="-mt-2 text-[13px] text-ink-3">
          A receber inclui {centavosParaReais(financeiro.previsto)} de mensalidades que ainda vão ser geradas.
        </p>
      )}

      {avisaram.map((c) => (
        <section key={c.id} className="flex flex-col gap-2.5 rounded-[20px] bg-ok-soft p-4" aria-label="Aluno avisou que pagou">
          <p className="flex items-start gap-2 text-[15px] text-ok">
            <Icone nome="certo" className="mt-0.5 size-4" />
            <span className="flex-1">
              <strong>{c.nome.split(" ")[0]}</strong> avisou que pagou {centavosParaReais(c.valorCentavos)}
              <span className="block text-[13px] opacity-80">{descricaoDaCobranca(c)}</span>
            </span>
            <Link href={`/agenda/cobrancas/${c.id}`} className="text-[13px] font-semibold underline">
              Ver
            </Link>
          </p>
          <ConfirmarRecebimento cobrancaId={c.id} valorCentavos={c.valorCentavos} hoje={hoje} />
        </section>
      ))}

      <Lista titulo="Atrasadas" vazio={null} cobrancas={atrasadas} hoje={hoje} acao="Cobrar" />
      <Lista
        titulo={`Vencendo nos próximos ${DIAS_VENCENDO} dias`}
        vazio="Nada vencendo esta semana."
        cobrancas={vencendo}
        hoje={hoje}
      />

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Recebido por mês">
        <h2 className="text-[16px] font-semibold">Recebido por mês</h2>
        <div className="flex h-36 items-end gap-2">
          {meses.map((m, i) => {
            const atual = i === meses.length - 1;
            return (
              <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[12px] tabular-nums ${atual ? "font-bold text-ink" : "text-ink-3"}`}>
                  {m.centavos > 0 ? curto(m.centavos) : ""}
                </span>
                <span
                  className={`w-full rounded-t-[7px] rounded-b-[3px] ${atual ? "botao-macio bg-brand" : "bg-brand-soft"}`}
                  style={{ height: `${Math.max(3, Math.round((m.centavos / maior) * 100))}%` }}
                  title={`${MESES[Number(m.mes.slice(5)) - 1]}: ${centavosParaReais(m.centavos)}`}
                />
                <span className={`text-[12.5px] ${atual ? "font-bold text-ink" : "text-ink-3"}`}>
                  {MESES[Number(m.mes.slice(5)) - 1]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <nav className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4" aria-label="Mais do financeiro">
        <Linha href="/agenda/cobrancas" icone="dinheiro" titulo="Todas as cobranças" texto="Em aberto, pagas e canceladas" />
        <Linha
          href="/agenda/valores"
          icone="estrela"
          titulo="Valores das aulas"
          texto={menorValor != null ? `Aulas a partir de ${centavosParaReais(menorValor)}` : "Cadastre seus valores"}
        />
        <Linha href="/agenda/pix" icone="cadeado" titulo="Chave Pix" texto={pix ? "Cadastrada" : "Cadastre para receber pelo Pienel"} />
      </nav>

      <Link
        href="/agenda/cobrancas/nova"
        className="botao-macio fixed right-[max(18px,calc(50vw-14rem+18px))] bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex items-center gap-1.5 rounded-full bg-brand px-4 py-3 text-[15px] font-extrabold text-brand-ink"
      >
        <Icone nome="mais" className="size-4" /> Cobrança
      </Link>
    </div>
  );
}

function Numero({ titulo, valor, cor, grande = false }: { titulo: string; valor: number; cor?: string; grande?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-[18px] border border-line bg-surface px-4 py-3.5 ${grande ? "col-span-2" : ""}`}>
      <span className="text-[13px] text-ink-3">{titulo}</span>
      <span className={`font-display ${grande ? "text-[30px]" : "text-[21px]"} leading-tight font-extrabold tabular-nums ${cor ?? ""}`}>
        {centavosParaReais(valor)}
      </span>
    </div>
  );
}

function Lista({
  titulo,
  vazio,
  cobrancas,
  hoje,
  acao,
}: {
  titulo: string;
  /** Texto quando não há nenhuma (null: a seção some). */
  vazio: string | null;
  cobrancas: (Cobranca & { nome: string })[];
  hoje: string;
  acao?: string;
}) {
  if (cobrancas.length === 0 && vazio === null) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={titulo}>
      <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">{titulo}</h2>
      {cobrancas.length === 0 ? (
        <p className="text-[14px] text-ink-3">{vazio}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-3.5">
          {cobrancas.map((c) => {
            const atrasada = situacaoDaCobranca(c, hoje) === "atrasada";
            return (
              <li key={c.id}>
                <Link href={`/agenda/cobrancas/${c.id}`} className="flex items-center gap-3 py-2.5">
                  <Avatar nome={c.nome} cor={corPorId(c.vinculoId)} tamanho="pequeno" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-bold ${atrasada ? "text-bad" : ""}`}>{c.nome}</span>
                    <span className={`block text-[13px] ${atrasada ? "font-semibold text-bad" : "text-ink-3"}`}>
                      {textoDoVencimento(c.vencimento, hoje)} · {centavosParaReais(c.valorCentavos)}
                    </span>
                  </span>
                  {acao ? (
                    <span className="rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[14px] font-bold">{acao}</span>
                  ) : (
                    <span className="text-ink-3" aria-hidden="true">›</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
