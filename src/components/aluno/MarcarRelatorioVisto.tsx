"use client";

import { useEffect } from "react";
import { marcarRelatorioVisto } from "@/data/treino";

/** Decisão 117: ao abrir o relatório, o botão brilhante sai do Início. */
export function MarcarRelatorioVisto({ vinculoId, mes }: { vinculoId: string; mes: string }) {
  useEffect(() => {
    void marcarRelatorioVisto(vinculoId, mes);
  }, [vinculoId, mes]);
  return null;
}
