"use client";

import { salvarTreinoDoVinculo } from "@/data/treino";
import { EditorDeTreino } from "../EditorDeTreino";
import { Icone } from "../Icone";

/** Ficha do aluno do personal: o treino de cada dia, só por texto (decisão 81). */
export function TreinoDoAluno({ vinculoId, dias, inicial }: { vinculoId: string; dias: number[]; inicial: Record<number, string> }) {
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Treino">
      <div className="flex items-center gap-2">
        <Icone nome="estrela" className="size-[18px] text-brand" />
        <h3 className="flex-1 text-[16px] font-bold">Treino</h3>
        <span className="text-[13px] text-ink-3">o aluno vê no app</span>
      </div>
      <EditorDeTreino
        dias={dias}
        inicial={inicial}
        salvar={(dia, texto) => salvarTreinoDoVinculo(vinculoId, dia, texto)}
        maximo={1000}
        outrosDias
        semDias=""
      />
    </section>
  );
}
