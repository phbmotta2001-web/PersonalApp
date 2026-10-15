// Agenda semanal de horários livres dos personais.
//
// Regras (decisão de 14/10/2026):
// - A agenda se repete toda semana (os planos são mensais).
// - Cada aula dura 1 hora e começa em hora cheia: 7 = 07:00 às 08:00.
// - No pedido, o aluno escolhe exatamente tantos horários quanto o plano
//   (4x = 4 horários), no máximo um por dia.
// - O pedido não reserva o horário: ele só fica do aluno quando o personal aceitar.

export const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const NOME_DIA: Record<DiaSemana, string> = {
  Seg: "Segunda",
  Ter: "Terça",
  Qua: "Quarta",
  Qui: "Quinta",
  Sex: "Sexta",
  Sáb: "Sábado",
};

/** Primeira e última hora em que uma aula pode começar (06:00 a 21:00). */
export const HORA_MIN = 6;
export const HORA_MAX = 21;

/** Horários livres por dia: { Seg: [7, 9] } = segunda às 07:00 e às 09:00. */
export type Disponibilidade = Partial<Record<DiaSemana, number[]>>;

/** Um horário escolhido no pedido, ex.: "Seg 07:00". É assim que vai para o banco. */
export type Horario = `${DiaSemana} ${string}:00`;

const doisDigitos = (h: number) => String(h).padStart(2, "0");

export function horario(dia: DiaSemana, hora: number): Horario {
  return `${dia} ${doisDigitos(hora)}:00`;
}

export function lerHorario(h: string): { dia: DiaSemana; hora: number } | null {
  const m = /^(\S+) (\d{2}):00$/.exec(h);
  if (!m || !DIAS_SEMANA.includes(m[1] as DiaSemana)) return null;
  const hora = Number(m[2]);
  if (hora < HORA_MIN || hora > HORA_MAX) return null;
  return { dia: m[1] as DiaSemana, hora };
}

/** "07:00–08:00" */
export function faixaDaAula(hora: number): string {
  return `${doisDigitos(hora)}:00–${doisDigitos(hora + 1)}:00`;
}

/** "Seg 07:00, Qua 07:00 e Sex 09:00" na ordem da semana. */
export function ordenarHorarios(horarios: string[]): string[] {
  const posicao = (h: string) => {
    const l = lerHorario(h);
    return l ? DIAS_SEMANA.indexOf(l.dia) * 100 + l.hora : 9999;
  };
  return [...horarios].sort((a, b) => posicao(a) - posicao(b));
}

export function diasLivres(disp: Disponibilidade): DiaSemana[] {
  return DIAS_SEMANA.filter((d) => (disp[d]?.length ?? 0) > 0);
}

/** Quantas aulas por semana a agenda comporta (um horário por dia). */
export function maximoPorSemana(disp: Disponibilidade): number {
  return diasLivres(disp).length;
}

export function estaLivre(disp: Disponibilidade, h: string): boolean {
  const l = lerHorario(h);
  return !!l && (disp[l.dia] ?? []).includes(l.hora);
}

/**
 * Confere os horários escolhidos no pedido: quantidade igual ao plano, um por dia
 * e todos livres na agenda do personal. Vazia = tudo certo.
 */
export function problemasDosHorarios(horarios: unknown, vezes: number, disp: Disponibilidade): string[] {
  if (!Array.isArray(horarios) || horarios.some((h) => typeof h !== "string" || !lerHorario(h)))
    return ["horários válidos"];
  const dias = new Set(horarios.map((h) => lerHorario(h)!.dia));
  if (dias.size !== horarios.length) return ["um horário por dia"];
  if (horarios.some((h) => !estaLivre(disp, h))) return ["horários que estejam livres na agenda"];
  if (horarios.length !== vezes) return [`${vezes} ${vezes === 1 ? "horário" : "horários"}, um por dia`];
  return [];
}

// ─── Filtro da busca: "Quando você pode treinar" ───────────────────────────

export interface FiltroQuando {
  /** Dias em que o aluno pode treinar (vazio = qualquer dia). */
  dias: DiaSemana[];
  /** Faixa de horário: a aula precisa começar e terminar dentro dela. */
  de: number;
  ate: number;
}

export const QUANDO_PADRAO = { de: HORA_MIN, ate: HORA_MAX + 1 };

export function quandoAtivo(f: FiltroQuando): boolean {
  return f.dias.length > 0 || f.de !== QUANDO_PADRAO.de || f.ate !== QUANDO_PADRAO.ate;
}

/** Em quantos dos dias pedidos o personal tem horário livre dentro da faixa. */
export function compatibilidade(disp: Disponibilidade, f: FiltroQuando): { livres: number; total: number } {
  const dias = f.dias.length > 0 ? f.dias : [...DIAS_SEMANA];
  const livres = dias.filter((d) => (disp[d] ?? []).some((h) => h >= f.de && h + 1 <= f.ate)).length;
  return { livres, total: dias.length };
}
