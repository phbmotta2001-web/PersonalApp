"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Decisão 113: o Início se atualiza sozinho quando uma aula começa ou termina, para o painel
// "Aula em andamento" aparecer e sumir sem o usuário puxar a tela. Também atualiza quando o
// app volta para a frente depois de um desses momentos (o celular pausa a página em segundo plano).
// Decisão 117: com "aCada", também atualiza de tempo em tempo (o aluno vê quando o personal começa o treino antes).
export function AtualizarNaHora({ momentos, aCada }: { momentos: (string | null | undefined)[]; aCada?: number }) {
  const router = useRouter();
  const chave = momentos.filter(Boolean).join("|");

  useEffect(() => {
    if (!aCada) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, aCada);
    return () => window.clearInterval(t);
  }, [aCada, router]);

  useEffect(() => {
    const desde = Date.now();
    const lista = chave
      .split("|")
      .filter(Boolean)
      .map((m) => Date.parse(m))
      .filter((t) => Number.isFinite(t) && t > desde);
    if (lista.length === 0) return;
    const primeiro = Math.min(...lista);
    // Um pouco depois do horário, para a aula já contar como começada (ou terminada).
    const espera = primeiro - desde + 3_000;
    // setTimeout não aceita mais de ~24 dias; aqui o horário costuma ser em minutos ou horas.
    const timer = espera < 2 ** 31 - 1 ? window.setTimeout(() => router.refresh(), espera) : undefined;
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() >= primeiro) router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [chave, router]);

  return null;
}
