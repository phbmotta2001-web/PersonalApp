// Treino com exercícios (decisão 114): o foco de cada dia e a lista de exercícios.

export interface Exercicio {
  /** Vazio enquanto não foi salvo. */
  id?: string;
  nome: string;
  series: number | null;
  /** "10", "8-12", "30s"… */
  repeticoes: string | null;
  cargaKg: number | null;
  descansoSeg: number | null;
}

export interface TreinoCompleto {
  /** Dia da semana (0 = domingo) → o que se trabalha no dia. */
  focos: Record<number, string | null>;
  /** Dia da semana → exercícios na ordem. */
  exercicios: Record<number, Exercicio[]>;
}

/** Dias com treino (foco ou exercícios). */
export const diasComTreino = (t: TreinoCompleto) =>
  [...new Set([...Object.keys(t.focos), ...Object.keys(t.exercicios)].map(Number))].sort((a, b) => a - b);

/** Registro de um exercício na aula. */
export interface RegistroDoExercicio {
  exercicioId: string;
  feito: boolean;
  cargaKg: number | null;
  repeticoes: number | null;
}

/** Um exercício feito numa aula, para o gráfico de evolução. */
export interface PontoDeTreino {
  exercicioId: string | null;
  nome: string;
  /** "AAAA-MM-DD" */
  data: string;
  cargaKg: number | null;
  repeticoes: number | null;
}

export const DESCANSOS = [
  { valor: 30, rotulo: "30 s" },
  { valor: 45, rotulo: "45 s" },
  { valor: 60, rotulo: "1 min" },
  { valor: 90, rotulo: "1 min 30" },
  { valor: 120, rotulo: "2 min" },
  { valor: 180, rotulo: "3 min" },
  { valor: 300, rotulo: "5 min" },
];

export const rotuloDescanso = (s: number | null) =>
  s == null ? "" : (DESCANSOS.find((d) => d.valor === s)?.rotulo ?? (s % 60 === 0 ? `${s / 60} min` : `${s} s`));

export const kg = (n: number | null) => (n == null ? "" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`);

/** "4 × 10 · 40 kg · 1 min 30" */
export const resumoDoExercicio = (e: Exercicio) =>
  [
    e.series && e.repeticoes ? `${e.series} × ${e.repeticoes}` : e.series ? `${e.series} séries` : e.repeticoes,
    kg(e.cargaKg),
    e.descansoSeg != null ? `descanso ${rotuloDescanso(e.descansoSeg)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

/** "40,5" → 40.5; vazio → null; texto inválido → NaN. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
