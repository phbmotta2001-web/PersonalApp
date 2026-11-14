// Decisão 105: avaliação física do aluno do personal.

export const MEDIDAS = [
  { chave: "peito", rotulo: "Peito" },
  { chave: "cintura", rotulo: "Cintura" },
  { chave: "abdomen", rotulo: "Abdômen" },
  { chave: "quadril", rotulo: "Quadril" },
  { chave: "braco", rotulo: "Braço" },
  { chave: "coxa", rotulo: "Coxa" },
  { chave: "panturrilha", rotulo: "Panturrilha" },
] as const;

export type Medida = (typeof MEDIDAS)[number]["chave"];

export interface AvaliacaoFisica {
  id: string;
  /** "AAAA-MM-DD" */
  data: string;
  pesoKg: number | null;
  gorduraPct: number | null;
  medidas: Partial<Record<Medida, number>>;
  observacao: string | null;
}

/** "82,4" → 82.4; vazio → null; inválido → NaN. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const numeroBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
