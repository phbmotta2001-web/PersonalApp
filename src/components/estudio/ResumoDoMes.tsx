import type { ResumoDoMes as Resumo } from "@/data/estudio-atencao";
import { formatarReais } from "@/lib/formato";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Decisão 101: os números do mês escolhido, no alto da aba Financeiro. */
export function ResumoDoMes({ mes, resumo }: { mes: string; resumo: Resumo }) {
  const aulas = resumo.presencas + resumo.faltas;
  const itens: { rotulo: string; valor: string; detalhe?: string }[] = [
    {
      rotulo: "Alunos novos",
      valor: String(resumo.novos),
      detalhe: `${resumo.saidas} ${resumo.saidas === 1 ? "saiu" : "saíram"} · ${resumo.ativos} ativos hoje`,
    },
    { rotulo: "Recebido", valor: formatarReais(resumo.recebidoCentavos / 100), detalhe: resumo.atrasadas > 0 ? `${resumo.atrasadas} em atraso (${formatarReais(resumo.atrasadoCentavos / 100)})` : "Nada em atraso" },
    {
      rotulo: "Experimentais",
      valor: `${resumo.matricularam} de ${resumo.experimentais}`,
      detalhe: resumo.experimentais > 0 ? `${Math.round((resumo.matricularam / resumo.experimentais) * 100)}% viraram matrícula` : "Nenhuma no mês",
    },
    {
      rotulo: "Frequência",
      valor: aulas > 0 ? `${Math.round((resumo.presencas / aulas) * 100)}%` : "—",
      detalhe: `${resumo.faltas} ${resumo.faltas === 1 ? "falta" : "faltas"}${resumo.reposicoesVencidas > 0 ? ` · ${resumo.reposicoesVencidas} ${resumo.reposicoesVencidas === 1 ? "reposição venceu" : "reposições venceram"} sem uso` : ""}`,
    },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Resumo do mês">
      <h2 className="font-bold">Resumo de {MESES[Number(mes.slice(5, 7)) - 1]}</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex flex-col gap-0.5 rounded-[14px] bg-surface-2 p-3">
            <span className="text-[12.5px] font-extrabold tracking-[0.05em] text-ink-3 uppercase">{i.rotulo}</span>
            <span className="text-[20px] leading-tight font-extrabold">{i.valor}</span>
            {i.detalhe && <span className="text-[13px] text-ink-2">{i.detalhe}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
