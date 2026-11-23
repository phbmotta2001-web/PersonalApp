// Treino com exercícios (decisões 114 e 117): o foco de cada dia e a lista de exercícios.

export type Unidade = "kg" | "lb" | "placas";
export type MedidaDaSerie = "reps" | "segundos";

export const UNIDADES: { valor: Unidade; rotulo: string }[] = [
  { valor: "kg", rotulo: "kg" },
  { valor: "lb", rotulo: "lb" },
  { valor: "placas", rotulo: "placas" },
];

export interface Exercicio {
  /** Vazio enquanto não foi salvo. */
  id?: string;
  nome: string;
  series: number | null;
  /** "10", "8-12"… (repetições ou segundos, conforme a medida). */
  repeticoes: string | null;
  /** Carga na unidade do exercício (kg, lb ou placas). */
  cargaKg: number | null;
  descansoSeg: number | null;
  unidade: Unidade;
  medida: MedidaDaSerie;
  obs: string | null;
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

/** Uma série feita: carga (na unidade do exercício) e repetições ou segundos. */
export interface SerieFeita {
  carga: number | null;
  reps: number | null;
}

/** Registro de um exercício na aula. */
export interface RegistroDoExercicio {
  exercicioId: string;
  feito: boolean;
  series: SerieFeita[];
}

/** Treino da aula: o dia escolhido (vazio = o do dia da semana), início, fim e registros. */
export interface TreinoDaAula {
  dia: number | null;
  iniciado: string | null;
  encerrado: string | null;
  registros: RegistroDoExercicio[];
}

/** Um exercício feito numa aula, para a evolução e o relatório do mês. */
export interface PontoDeTreino {
  exercicioId: string | null;
  nome: string;
  aulaId: string | null;
  /** "AAAA-MM-DD" */
  data: string;
  /** Maior carga do dia (na unidade). */
  cargaKg: number | null;
  repeticoes: number | null;
  series: SerieFeita[];
  unidade: Unidade;
  medida: MedidaDaSerie;
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

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** 40 → "40 kg"; 8 placas → "8 placas" */
export const textoDaCarga = (n: number | null, u: Unidade = "kg") =>
  n == null ? "" : u === "placas" ? `${numero(n)} ${n === 1 ? "placa" : "placas"}` : `${numero(n)} ${u}`;

/** Compatível com o nome antigo (carga em kg). */
export const kg = (n: number | null) => textoDaCarga(n, "kg");

/** "reps" → "repetições"; "segundos" → "segundos" */
export const rotuloDaMedida = (m: MedidaDaSerie, curto = false) => (m === "segundos" ? (curto ? "s" : "segundos") : curto ? "rep." : "repetições");

/** "4 × 10 · 40 kg · descanso 1 min 30"; isometria: "3 × 30 s" */
export const resumoDoExercicio = (e: Exercicio) => {
  const r = e.repeticoes ? (e.medida === "segundos" ? `${e.repeticoes} s` : e.repeticoes) : null;
  return [
    e.series && r ? `${e.series} × ${r}` : e.series ? `${e.series} séries` : r,
    textoDaCarga(e.cargaKg, e.unidade),
    e.descansoSeg != null ? `descanso ${rotuloDescanso(e.descansoSeg)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

/** Carga em kg (lb convertida); placas não têm peso conhecido. */
export const emKg = (carga: number | null, u: Unidade) => (carga == null ? null : u === "kg" ? carga : u === "lb" ? carga * 0.45359237 : null);

/** Total levantado num registro (kg × repetições de cada série). Isometria e placas não entram. */
export function volumeDoRegistro(p: Pick<PontoDeTreino, "series" | "unidade" | "medida">): number {
  if (p.medida !== "reps" || p.unidade === "placas") return 0;
  return p.series.reduce((t, s) => t + (s.carga != null && s.reps != null ? (emKg(s.carga, p.unidade) ?? 0) * s.reps : 0), 0);
}

/** "40,5" → 40.5; vazio → null; texto inválido → NaN. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
