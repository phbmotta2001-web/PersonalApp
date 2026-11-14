import type { GanhosDoMes as Ganhos } from "@/data/ganhos";
import { centavosParaReais } from "@/lib/matricula";

/**
 * Decisão 102: no Financeiro do personal, quanto recebe no mês por origem — cada estúdio, personal,
 * consultoria online e aulas avulsas — e o total. Só aparecem as origens com valor.
 */
export function GanhosDoMes({ ganhos, mes }: { ganhos: Ganhos; mes: string }) {
  const linhas: { rotulo: string; valor: number; detalhe?: string }[] = [
    ...ganhos.estudios.map((e) => ({ rotulo: e.nome, valor: e.valor, detalhe: e.pago ? "Pago" : "Previsão do estúdio" })),
    { rotulo: "Personal", valor: ganhos.personal, detalhe: "Mensalidades dos alunos presenciais" },
    { rotulo: "Consultoria online", valor: ganhos.online, detalhe: "Alunos online e híbridos" },
    { rotulo: "Aulas avulsas", valor: ganhos.avulsas },
  ].filter((l) => l.valor > 0);
  if (linhas.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Quanto você recebe no mês">
      <h2 className="text-[16px] font-semibold">Quanto você recebe em {mes}</h2>
      <ul className="flex flex-col divide-y divide-line">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{l.rotulo}</span>
              {l.detalhe && <span className="block text-[13px] text-ink-3">{l.detalhe}</span>}
            </span>
            <span className="text-[16px] font-bold tabular-nums">{centavosParaReais(l.valor)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t-2 border-line pt-2">
        <span className="flex-1 font-extrabold">Total do mês</span>
        <span className="text-[20px] font-extrabold text-ok tabular-nums">{centavosParaReais(ganhos.total)}</span>
      </div>
      <p className="text-[12.5px] text-ink-3">Inclui o que já recebeu e o que ainda vai receber neste mês.</p>
    </section>
  );
}
