export const NOME_DO_PLANO: Record<number, string> = { 1: "Mensal", 3: "Trimestral", 6: "Semestral", 12: "Anual" };

/** "AAAA-MM-DD" + n meses (o dia fica no último dia do mês quando não existe). */
function somarMeses(data: string, n: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/**
 * Último dia do período atual de um plano de N meses que começou em `inicio` ("AAAA-MM-DD"). O plano
 * se renova sozinho: se o período já passou, conta o seguinte. Plano mensal não tem fim: null.
 */
export function fimDoPlano(meses: number, inicio: string | null, hoje: string): string | null {
  if (meses <= 1 || !inicio) return null;
  let k = 1;
  while (somarMeses(inicio, k * meses) <= hoje) k++;
  const fim = new Date(`${somarMeses(inicio, k * meses)}T12:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() - 1);
  return fim.toISOString().slice(0, 10);
}

/** Matrícula com personal: a data de término, se houver; senão o fim do ciclo de 3, 6 ou 12 meses. */
export function fimDaMatricula(m: { cicloMeses: number; inicio: string; fim: string | null }, hoje: string): string | null {
  const ciclo = fimDoPlano(m.cicloMeses, m.inicio, hoje);
  if (m.fim && (!ciclo || m.fim < ciclo)) return m.fim;
  return ciclo;
}

export const dataCompleta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
