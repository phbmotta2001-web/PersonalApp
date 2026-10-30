// Feriados que o Kout mostra (decisão de 28/10/2026): os nacionais + Carnaval (segunda e
// terça) e Corpus Christi. A mesma lista existe no banco (public.feriados_do_ano): mudou
// aqui, muda lá. Feriados da cidade o personal marca em Bloqueios.

export interface Feriado {
  /** "AAAA-MM-DD" */
  data: string;
  nome: string;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const dataDe = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return dataDe(ano, Math.floor(n / 31), (n % 31) + 1);
}

/** Data somada de alguns dias (datas "AAAA-MM-DD", sem fuso). */
function somar(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function feriadosDoAno(ano: number): Feriado[] {
  const p = pascoa(ano);
  return [
    { data: dataDe(ano, 1, 1), nome: "Confraternização Universal" },
    { data: somar(p, -48), nome: "Carnaval" },
    { data: somar(p, -47), nome: "Carnaval" },
    { data: somar(p, -2), nome: "Sexta-feira Santa" },
    { data: dataDe(ano, 4, 21), nome: "Tiradentes" },
    { data: dataDe(ano, 5, 1), nome: "Dia do Trabalho" },
    { data: somar(p, 60), nome: "Corpus Christi" },
    { data: dataDe(ano, 9, 7), nome: "Independência do Brasil" },
    { data: dataDe(ano, 10, 12), nome: "Nossa Senhora Aparecida" },
    { data: dataDe(ano, 11, 2), nome: "Finados" },
    { data: dataDe(ano, 11, 15), nome: "Proclamação da República" },
    { data: dataDe(ano, 11, 20), nome: "Consciência Negra" },
    { data: dataDe(ano, 12, 25), nome: "Natal" },
  ].sort((x, y) => x.data.localeCompare(y.data));
}

/** Feriados entre duas datas (inclusive). */
export function feriadosEntre(de: string, ate: string): Feriado[] {
  const lista: Feriado[] = [];
  for (let ano = Number(de.slice(0, 4)); ano <= Number(ate.slice(0, 4)); ano++)
    lista.push(...feriadosDoAno(ano).filter((f) => f.data >= de && f.data <= ate));
  return lista;
}

/** O feriado desta data, se houver. */
export function feriadoDoDia(data: string): Feriado | null {
  return feriadosDoAno(Number(data.slice(0, 4))).find((f) => f.data === data) ?? null;
}

/** Regra do personal: geral + exceções (feriados em que faz o contrário). */
export interface RegraDeFeriados {
  trabalha: boolean;
  excecoes: string[];
}

export function trabalhaNoFeriado(regra: RegraDeFeriados, data: string): boolean {
  return regra.trabalha !== regra.excecoes.includes(data);
}
