// Tabela de valores do personal (decisão de 16/10/2026).
//
// - O personal informa o valor de CADA AULA conforme a frequência semanal do aluno
//   (ex.: 1x/semana R$ 200, 2x/semana R$ 185…). Uma tabela só, para qualquer duração.
// - Mensalidade = valor da aula × vezes por semana × 4 (fixa todo mês).
// - Na matrícula a mensalidade já sai pronta; "valor fora do padrão" é a exceção manual.
// - Fase 2: o perfil público mostra "a partir de" (o menor valor por aula) e a tabela toda.

export const VEZES_POR_SEMANA = [1, 2, 3, 4, 5, 6, 7] as const;
export const SEMANAS_POR_MES = 4;

/** Valor de cada aula, em centavos, por vezes na semana (sem a chave = não oferece). */
export type TabelaDeValores = Partial<Record<number, number>>;

/** Mensalidade pela tabela, ou null se o personal não tem valor para essa frequência. */
export function mensalidadeDaTabela(tabela: TabelaDeValores, vezes: number): number | null {
  const aula = tabela[vezes];
  return aula == null ? null : aula * vezes * SEMANAS_POR_MES;
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
