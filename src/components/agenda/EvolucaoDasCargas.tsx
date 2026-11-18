"use client";

import { useState } from "react";
import type { PontoDeTreino } from "@/lib/treino";
import { Grafico } from "./AvaliacaoFisica";

/**
 * Decisão 114: a evolução de cada exercício nas aulas (carga, ou repetições quando o exercício
 * não tem carga). Os dados vêm do que personal e aluno registram no "treino em andamento".
 */
export function EvolucaoDasCargas({ pontos }: { pontos: PontoDeTreino[] }) {
  // Um exercício por id (ou pelo nome, se saiu da ficha); o mais recente primeiro.
  const grupos = new Map<string, { nome: string; pontos: PontoDeTreino[] }>();
  for (const p of pontos) {
    const chave = p.exercicioId ?? `nome:${p.nome}`;
    const g = grupos.get(chave) ?? { nome: p.nome, pontos: [] };
    g.nome = p.nome;
    g.pontos.push(p);
    grupos.set(chave, g);
  }
  // Primeiro o exercício com mais registros (o gráfico abre nele).
  const lista = [...grupos.entries()].sort(([, a], [, b]) => b.pontos.length - a.pontos.length);
  const [escolhido, setEscolhido] = useState(lista[0]?.[0]);
  if (lista.length === 0) return null;
  const g = grupos.get(escolhido ?? "") ?? lista[0][1];
  const porCarga = g.pontos.some((p) => p.cargaKg != null);
  // Um ponto por dia: o maior valor do dia.
  const porDia = new Map<string, number>();
  for (const p of g.pontos) {
    const v = porCarga ? p.cargaKg : p.repeticoes;
    if (v == null) continue;
    porDia.set(p.data, Math.max(v, porDia.get(p.data) ?? -Infinity));
  }
  const serie = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, valor]) => ({ data, valor }));

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Evolução nos treinos">
      <h3 className="text-[16px] font-bold">Evolução nos treinos</h3>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Exercício">
        {lista.map(([chave, x]) => (
          <button
            key={chave}
            type="button"
            aria-pressed={chave === (escolhido ?? lista[0][0])}
            onClick={() => setEscolhido(chave)}
            className={`rounded-full border px-3 py-1.5 text-[13.5px] font-semibold ${
              chave === (escolhido ?? lista[0][0]) ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink-2"
            }`}
          >
            {x.nome}
          </button>
        ))}
      </div>
      {serie.length >= 2 ? (
        <Grafico pontos={serie} unidade={porCarga ? " kg" : " rep."} />
      ) : (
        <p className="text-[14px] text-ink-3">
          {serie.length === 1
            ? `${serie[0].valor.toLocaleString("pt-BR")}${porCarga ? " kg" : " repetições"} no último treino. O gráfico aparece a partir do segundo registro.`
            : "Ainda sem carga ou repetições registradas."}
        </p>
      )}
      <p className="text-[13px] text-ink-3">
        {porCarga ? "Maior carga" : "Repetições"} registrada em cada aula · {g.pontos.length} {g.pontos.length === 1 ? "registro" : "registros"}
      </p>
    </section>
  );
}
