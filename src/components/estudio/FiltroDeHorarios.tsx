"use client";

import { useState } from "react";
import type { TurmaDoEstudio } from "@/data/estudio";
import { minParaHora, opcoesDeHora } from "@/lib/expediente";
import { ESTILO_CAIXA } from "../Formulario";
import { EscolhaDeDias } from "./EscolhaDeDias";

const ROTULO = "flex flex-col gap-1 text-[14px] font-bold text-ink-2";

export interface Filtro {
  tipo: "turma" | "turno" | "todos";
  modalidade: string;
  dias: number[];
  de: number;
  ate: number;
}

export const FILTRO_INICIAL: Filtro = { tipo: "todos", modalidade: "", dias: [0, 1, 2, 3, 4, 5, 6], de: 0, ate: 1440 };

export function filtrar(turmas: TurmaDoEstudio[], f: Filtro) {
  return turmas.filter(
    (t) =>
      (f.tipo === "todos" || t.tipo === f.tipo) &&
      (!f.modalidade || t.modalidade === f.modalidade) &&
      f.dias.includes(t.diaSemana) &&
      t.inicioMin >= f.de &&
      t.inicioMin < f.ate,
  );
}

export function useFiltro() {
  return useState<Filtro>(FILTRO_INICIAL);
}

/** Quais horários da semana (decisão 68): tipo, modalidade, dias e "começando das … às …". */
export function FiltroDeHorarios({ turmas, valor, mudar }: { turmas: TurmaDoEstudio[]; valor: Filtro; mudar: (f: Filtro) => void }) {
  const f = valor;
  const modalidades = [...new Set(turmas.filter((t) => f.tipo === "todos" || t.tipo === f.tipo).map((t) => t.modalidade))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  return (
    <>
      <label className={ROTULO + " sm:max-w-xs"}>
        Modalidade
        <select value={f.modalidade} onChange={(e) => mudar({ ...f, modalidade: e.target.value })} className={ESTILO_CAIXA}>
          <option value="">Todas</option>
          {modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <EscolhaDeDias valor={f.dias} mudar={(dias) => mudar({ ...f, dias })} />
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <label className={ROTULO}>
          Começando das
          <select value={f.de} onChange={(e) => mudar({ ...f, de: Number(e.target.value), ate: Math.max(f.ate, Number(e.target.value) + 30) })} className={ESTILO_CAIXA}>
            {opcoesDeHora(0, 1410).map((m) => (
              <option key={m} value={m}>
                {minParaHora(m)}
              </option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Às
          <select value={f.ate} onChange={(e) => mudar({ ...f, ate: Number(e.target.value) })} className={ESTILO_CAIXA}>
            {opcoesDeHora(f.de + 30, 1440).map((m) => (
              <option key={m} value={m}>
                {m === 1440 ? "24:00" : minParaHora(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
