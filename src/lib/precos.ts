// Tabela de valores do personal (decisão de 16/10/2026).
//
// - O personal informa o valor de CADA AULA conforme a frequência semanal do aluno
//   (ex.: 1x/semana R$ 200, 2x/semana R$ 185…). Uma tabela só, para qualquer duração.
// - Mensalidade = valor da aula × vezes por semana × 4 (fixa todo mês).
// - Aulas a cada N semanas (20/10/2026): proporcional, ÷ N. Vale também para o híbrido,
//   que paga só as aulas presenciais (o online já está incluído).
// - Na matrícula a mensalidade já sai pronta; "valor fora do padrão" é a exceção manual.
// - Fase 2: o perfil público mostra "a partir de" (o menor valor por aula) e a tabela toda.

export const VEZES_POR_SEMANA = [1, 2, 3, 4, 5, 6, 7] as const;
export const SEMANAS_POR_MES = 4;

/** Valor de cada aula, em centavos, por vezes na semana (sem a chave = não oferece). */
export type TabelaDeValores = Partial<Record<number, number>>;

/** Aulas no mês, em média: 2x por semana = 8; 1x a cada 15 dias = 2; 1x a cada 3 semanas ≈ 1,3. */
export function aulasNoMes(vezes: number, intervaloSemanas = 1): number {
  return (vezes * SEMANAS_POR_MES) / intervaloSemanas;
}

/**
 * Mensalidade pela tabela (centavos), ou null se o personal não tem valor para essa
 * frequência. O valor da aula é o de "vezes" por semana em que o aluno treina.
 */
export function mensalidadeDaTabela(tabela: TabelaDeValores, vezes: number, intervaloSemanas = 1): number | null {
  const aula = tabela[vezes];
  return aula == null ? null : Math.round(aula * aulasNoMes(vezes, intervaloSemanas));
}

/** Menor valor por aula ("a partir de"), ou null se a tabela está vazia. */
export function aPartirDe(tabela: TabelaDeValores): number | null {
  const valores = Object.values(tabela).filter((v): v is number => typeof v === "number");
  return valores.length ? Math.min(...valores) : null;
}

/** Confere a tabela digitada (centavos ou NaN quando o texto não é um valor). */
export function problemasDaTabela(tabela: TabelaDeValores): string[] {
  const valores = Object.values(tabela);
  return valores.some((v) => v == null || Number.isNaN(v) || v < 100 || v > 1_000_000)
    ? ["confira os valores (de R$ 1,00 a R$ 10.000,00 por aula)"]
    : [];
}

// ─── Planos online (decisão de 20/10/2026) ──────────────────────────────────
// Valor TOTAL de cada período, cobrado uma vez por período.

export const PLANOS_ONLINE = [
  { meses: 1, rotulo: "Mensal" },
  { meses: 3, rotulo: "Trimestral" },
  { meses: 6, rotulo: "Semestral" },
  { meses: 12, rotulo: "Anual" },
] as const;

/** Valor (centavos) de cada plano online, por meses (sem a chave = não oferece). */
export type TabelaOnline = Partial<Record<number, number>>;
