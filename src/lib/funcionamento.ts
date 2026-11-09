// Horário de funcionamento do estúdio/academia: um horário (abre–fecha) por dia aberto.

/** Dia da semana (0 = domingo) → horário em minutos desde 00:00. Dia ausente = fechado. */
export type Funcionamento = Partial<Record<number, { inicio: number; fim: number }>>;

export const FUNCIONAMENTO_PADRAO: Funcionamento = {
  1: { inicio: 360, fim: 1320 },
  2: { inicio: 360, fim: 1320 },
  3: { inicio: 360, fim: 1320 },
  4: { inicio: 360, fim: 1320 },
  5: { inicio: 360, fim: 1320 },
  6: { inicio: 480, fim: 840 },
};

/** Para o banco: [{dia, inicio_min, fim_min}] só com os dias abertos. */
export const funcionamentoParaBanco = (f: Funcionamento) =>
  Object.entries(f)
    .filter(([, h]) => h)
    .map(([dia, h]) => ({ dia: Number(dia), inicio_min: h!.inicio, fim_min: h!.fim }));

export function problemasDoFuncionamento(f: Funcionamento): string[] {
  const abertos = Object.values(f).filter(Boolean);
  if (abertos.length === 0) return ["marque pelo menos um dia de funcionamento"];
  if (abertos.some((h) => h!.fim <= h!.inicio)) return ["o horário de fechar precisa ser depois do de abrir"];
  return [];
}
