"use client";

import { useEffect } from "react";
import { marcarAvisosLidos } from "@/data/avisos";

/** Ao abrir a tela de avisos, os não lidos passam a lidos (o número do sininho zera). */
export function MarcarAvisosLidos({ haNaoLidos }: { haNaoLidos: boolean }) {
  useEffect(() => {
    if (haNaoLidos) void marcarAvisosLidos();
  }, [haNaoLidos]);
  return null;
}
