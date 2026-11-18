import Link from "next/link";
import { DIAS } from "@/lib/expediente";
import { diasComTreino, type TreinoCompleto } from "@/lib/treino";
import { Icone } from "../Icone";

/**
 * Decisão 114: na ficha, os dias de aula do aluno com o que será trabalhado e o botão para o
 * treino completo. Dias fora da matrícula só aparecem se ainda têm treino (para poder apagar).
 */
export function TreinoDaFicha({
  dias,
  treino,
  base,
  quem,
}: {
  /** Dias de aula da matrícula. */
  dias: number[];
  treino: TreinoCompleto;
  /** Endereço base do treino do dia: ".../treino" (o dia vai no fim). */
  base: string;
  quem: "personal" | "aluno";
}) {
  const comTreino = diasComTreino(treino);
  const lista = DIAS.filter((d) => (quem === "personal" ? dias.includes(d.valor) || comTreino.includes(d.valor) : comTreino.includes(d.valor)));
  if (quem === "aluno" && lista.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Treino">
      <div className="flex items-center gap-2">
        <Icone nome="estrela" className="size-[18px] text-brand" />
        <h3 className="flex-1 text-[16px] font-bold">{quem === "aluno" ? "Seu treino" : "Treino"}</h3>
        {quem === "personal" && <span className="text-[13px] text-ink-3">o aluno vê no app</span>}
      </div>
      {lista.length === 0 ? (
        <p className="text-[14px] text-ink-3">Crie a matrícula com os dias de aula para montar o treino.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {lista.map((d) => {
            const foco = treino.focos[d.valor];
            const n = treino.exercicios[d.valor]?.length ?? 0;
            const tem = foco || n > 0;
            return (
              <li key={d.valor} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-ink-3">
                    {d.nome}
                    {quem === "personal" && !dias.includes(d.valor) && " · não é mais dia de aula"}
                  </span>
                  <span className={`block truncate text-[15.5px] font-semibold ${tem ? "" : "text-ink-3"}`}>
                    {foco || (n > 0 ? "Treino montado" : "Sem treino")}
                  </span>
                  {n > 0 && (
                    <span className="block text-[13px] text-ink-3">
                      {n} {n === 1 ? "exercício" : "exercícios"}
                    </span>
                  )}
                </span>
                <Link
                  href={`${base}/${d.valor}`}
                  className={`shrink-0 rounded-[11px] px-3 py-2 text-[14px] font-bold ${tem ? "bg-brand text-brand-ink" : "border border-brand text-brand"}`}
                >
                  {tem ? "Exibir treino" : "Montar treino"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
