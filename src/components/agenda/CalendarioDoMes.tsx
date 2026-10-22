import Link from "next/link";
import type { AulaDaAgenda } from "@/data/matriculas";
import { CATEGORIAS_HISTORICO, categoriaDoHistorico, type CategoriaHistorico } from "@/lib/aula";
import { DIAS, diaDaSemana, emBrasilia, nomeDoDia, somarDias } from "@/lib/expediente";

export type AulaDoCalendario = AulaDaAgenda & { categoria: CategoriaHistorico | null; passou: boolean };

export const mesValido = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/** "2026-10" + n meses. */
export function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aulas com a cor do calendário: passadas pela categoria (dada, reposição, cancelada,
 * perdida); futuras como marcadas (bolinha vazada). Sem recusadas e remarcadas.
 */
export function paraCalendario(aulas: AulaDaAgenda[], agora: Date, filtro = ""): AulaDoCalendario[] {
  return aulas
    .filter((a) => (!filtro || a.vinculoId === filtro) && a.situacao !== "recusada" && a.situacao !== "remarcada" && a.situacao !== "pausada")
    .map((a) => ({
      ...a,
      categoria: categoriaDoHistorico(a.situacao, a.origem, a.fim, agora),
      passou: Date.parse(a.fim) <= agora.getTime(),
    }))
    // Canceladas (mesmo as futuras, avisadas antes) entram com a cor de cancelada ou perdida.
    .filter((a) => a.categoria !== null || !a.passou)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
}

/** Grade do mês (segunda a domingo) com uma bolinha colorida por aula. */
export function CalendarioDoMes({
  mes,
  dia,
  hoje,
  aulas,
  linkDoDia,
}: {
  /** "AAAA-MM" */
  mes: string;
  /** Dia escolhido, "AAAA-MM-DD". */
  dia: string;
  hoje: string;
  aulas: AulaDoCalendario[];
  linkDoDia: (d: string) => string;
}) {
  const primeiroDia = `${mes}-01`;
  const diasNoMes = Math.round((Date.parse(`${somarMes(mes, 1)}-01`) - Date.parse(primeiroDia)) / 86_400_000);
  // Os dias antes do dia 1 ficam vazios.
  const recuo = (diaDaSemana(primeiroDia) + 6) % 7;
  const casas: (string | null)[] = [
    ...Array.from({ length: recuo }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => somarDias(primeiroDia, i)),
  ];
  while (casas.length % 7) casas.push(null);
  const doDia = (d: string) => aulas.filter((a) => emBrasilia(a.inicio).data === d);

  return (
    <section aria-label="Calendário do mês" className="rounded-[20px] border border-line bg-surface p-2">
      <div className="grid grid-cols-7 pb-1 text-center text-[12.5px] font-semibold text-ink-3">
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
              href={linkDoDia(d)}
              scroll={false}
              aria-label={`${nomeDoDia(diaDaSemana(d))} ${Number(d.slice(8))}: ${lista.length} aula${lista.length === 1 ? "" : "s"}`}
              aria-current={escolhido ? "date" : undefined}
              className={`flex min-h-[54px] flex-col items-center gap-1 rounded-[12px] pt-1.5 pb-1 ${
                escolhido ? "bg-ink text-app" : ehHoje ? "bg-brand-soft" : "hover:bg-surface-2"
              } ${d < hoje && !escolhido ? "text-ink-2" : ""}`}
            >
              <span className={`text-[14px] tabular-nums ${ehHoje ? "font-extrabold" : "font-semibold"}`}>
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
                {lista.length > 4 && <span className="text-[11px] leading-[7px] font-bold">+</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
