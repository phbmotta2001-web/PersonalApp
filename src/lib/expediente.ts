// Horários de trabalho, bloqueios e horários livres do personal (Fase 1, etapa 1).
// Ver docs/plano-fase-1-agenda.md.
//
// Regras (decisões de 15/10/2026):
// - Segunda a domingo; horas de 30 em 30 minutos.
// - Uma duração padrão de aula por personal: 30, 45, 60 ou 90 minutos.
// - Os horários livres são cortados no tamanho da aula a partir do início de cada
//   faixa (06:00–12:00 com 60 min = 06:00, 07:00 … 11:00).
// - Um horário só é livre se a aula inteira cabe na faixa, não encosta em nenhum
//   bloqueio e ainda não passou.
// - Tudo no horário de Brasília (UTC−3; o Brasil não tem horário de verão desde 2019).

export const DURACOES = [30, 45, 60, 90] as const;
export type Duracao = (typeof DURACOES)[number];
export const DURACAO_PADRAO: Duracao = 60;

/** Dias na ordem da semana brasileira. `valor` segue o JavaScript: 0 = domingo. */
export const DIAS = [
  { valor: 1, curto: "Seg", nome: "Segunda" },
  { valor: 2, curto: "Ter", nome: "Terça" },
  { valor: 3, curto: "Qua", nome: "Quarta" },
  { valor: 4, curto: "Qui", nome: "Quinta" },
  { valor: 5, curto: "Sex", nome: "Sexta" },
  { valor: 6, curto: "Sáb", nome: "Sábado" },
  { valor: 0, curto: "Dom", nome: "Domingo" },
] as const;

export const nomeDoDia = (dia: number) => DIAS.find((d) => d.valor === dia)?.nome ?? "";
export const curtoDoDia = (dia: number) => DIAS.find((d) => d.valor === dia)?.curto ?? "";

/** Uma faixa de trabalho: segunda (1) das 360 (06:00) às 720 (12:00) minutos. */
export interface Faixa {
  dia: number;
  inicioMin: number;
  fimMin: number;
}

export interface Bloqueio {
  id?: string;
  /** Data e hora em formato ISO, com fuso. */
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  motivo: string;
}

export const MAX_FAIXAS_POR_DIA = 4;

/** Faixa sugerida para cada dia ligado: 06:00 às 21:00. */
export const FAIXA_PADRAO = { inicioMin: 360, fimMin: 1260 } as const;

/**
 * Ponto de partida de quem ainda não configurou nada: TODOS os dias ligados
 * (decisão de 15/10/2026). O personal desliga os dias em que não trabalha.
 */
export function expedientePadrao(): Faixa[] {
  return DIAS.map((d) => ({ dia: d.valor, ...FAIXA_PADRAO }));
}
export const LIMITE_MOTIVO = 80;

// ─── Horas ─────────────────────────────────────────────────────────────────

/** 390 → "06:30" (1440 vira "24:00", o fim do dia). */
export function minParaHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "06:30" → 390 */
export function horaParaMin(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min <= 1440 && Number(m[2]) < 60 ? min : null;
}

/** Opções de 30 em 30 minutos, de `de` a `ate` (inclusive), em minutos. */
export function opcoesDeHora(de = 0, ate = 1440): number[] {
  const lista: number[] = [];
  for (let m = de; m <= ate; m += 30) lista.push(m);
  return lista;
}

// ─── Datas no horário de Brasília ──────────────────────────────────────────

const FUSO_MIN = -180; // UTC−3
const MS_DIA = 86_400_000;

/** "Agora" como data de Brasília: { data: "2026-10-15", min: minutos desde 00:00 }. */
export function agoraEmBrasilia(agora = new Date()): { data: string; min: number } {
  const local = new Date(agora.getTime() + FUSO_MIN * 60_000);
  return {
    data: local.toISOString().slice(0, 10),
    min: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** "2026-10-15" + 390 min → instante (Date) às 06:30 de Brasília. */
export function instante(data: string, min: number): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) + (min - FUSO_MIN) * 60_000);
}

/** Soma dias a uma data "AAAA-MM-DD". */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD". */
export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** "2026-10-15" → "15/10" */
export const dataCurta = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** Instante ISO → { data, hora } em Brasília (para mostrar bloqueios). */
export function emBrasilia(iso: string): { data: string; hora: string } {
  const { data, min } = agoraEmBrasilia(new Date(iso));
  return { data, hora: minParaHora(min) };
}

// ─── Conferências ──────────────────────────────────────────────────────────

/** Lista o que está errado nas faixas de trabalho (vazia = tudo certo). */
export function problemasDasFaixas(faixas: Faixa[]): string[] {
  const problemas = new Set<string>();
  for (const f of faixas) {
    const valido =
      Number.isInteger(f.dia) && f.dia >= 0 && f.dia <= 6 &&
      Number.isInteger(f.inicioMin) && Number.isInteger(f.fimMin) &&
      f.inicioMin >= 0 && f.fimMin <= 1440 && f.inicioMin % 30 === 0 && f.fimMin % 30 === 0;
    if (!valido) problemas.add("use horários de 30 em 30 minutos");
    else if (f.fimMin <= f.inicioMin) problemas.add(`em ${nomeDoDia(f.dia).toLowerCase()}, o fim tem que ser depois do início`);
  }
  for (const d of DIAS) {
    const doDia = faixas.filter((f) => f.dia === d.valor).sort((a, b) => a.inicioMin - b.inicioMin);
    if (doDia.length > MAX_FAIXAS_POR_DIA) problemas.add(`use no máximo ${MAX_FAIXAS_POR_DIA} faixas por dia`);
    for (let i = 1; i < doDia.length; i++)
      if (doDia[i].inicioMin < doDia[i - 1].fimMin)
        problemas.add(`em ${d.nome.toLowerCase()}, as faixas se sobrepõem`);
  }
  return [...problemas];
}

export interface NovoBloqueio {
  diaInteiro: boolean;
  /** "AAAA-MM-DD" */
  dataInicio: string;
  /** Só para dia inteiro: último dia bloqueado (inclusive). */
  dataFim: string;
  /** Só para "algumas horas": em minutos. */
  inicioMin: number;
  fimMin: number;
  motivo: string;
}

const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/** Converte o formulário em início e fim reais (ISO) do bloqueio. */
export function periodoDoBloqueio(b: NovoBloqueio): { inicio: string; fim: string } {
  return b.diaInteiro
    ? { inicio: instante(b.dataInicio, 0).toISOString(), fim: instante(somarDias(b.dataFim, 1), 0).toISOString() }
    : { inicio: instante(b.dataInicio, b.inicioMin).toISOString(), fim: instante(b.dataInicio, b.fimMin).toISOString() };
}

export function problemasDoBloqueio(b: NovoBloqueio, agora = new Date()): string[] {
  const problemas: string[] = [];
  if (!dataValida(b.dataInicio) || (b.diaInteiro && !dataValida(b.dataFim))) return ["escolha as datas"];
  if (b.diaInteiro && b.dataFim < b.dataInicio) problemas.push("a data final tem que ser igual ou depois da inicial");
  if (!b.diaInteiro && !(b.fimMin > b.inicioMin)) problemas.push("o fim tem que ser depois do início");
  if (b.diaInteiro && Date.parse(b.dataFim) - Date.parse(b.dataInicio) > 365 * MS_DIA)
    problemas.push("bloqueie no máximo 1 ano de cada vez");
  if (typeof b.motivo !== "string" || b.motivo.trim().length > LIMITE_MOTIVO)
    problemas.push(`use até ${LIMITE_MOTIVO} caracteres no motivo`);
  if (problemas.length === 0 && new Date(periodoDoBloqueio(b).fim) <= agora) problemas.push("esse período já passou");
  return problemas;
}

// ─── Horários livres ───────────────────────────────────────────────────────

export interface DiaLivre {
  /** "AAAA-MM-DD" */
  data: string;
  diaSemana: number;
  /** Horários de início livres, em minutos (ex.: 360 = 06:00). */
  livres: number[];
  /** O personal trabalha nesse dia da semana (para diferenciar "folga" de "tudo bloqueado"). */
  trabalha: boolean;
  /** Motivos dos bloqueios que pegam esse dia (só o personal vê). */
  bloqueios: string[];
}

/**
 * Horários livres de `dias` dias a partir de `de` (padrão: hoje, em Brasília), cortados
 * no tamanho da aula a partir do início de cada faixa, sem bloqueios, sem aulas
 * marcadas (etapa 3) e sem horários que já passaram.
 */
export function horariosLivres(
  faixas: Faixa[],
  bloqueios: Pick<Bloqueio, "inicio" | "fim" | "motivo">[],
  duracao: number,
  dias = 7,
  agora = new Date(),
  aulas: { inicio: string; fim: string }[] = [],
  de?: string,
): DiaLivre[] {
  const hoje = de ?? agoraEmBrasilia(agora).data;
  const periodos = bloqueios.map((b) => ({ ini: Date.parse(b.inicio), fim: Date.parse(b.fim), motivo: b.motivo }));
  const ocupados = aulas.map((a) => ({ ini: Date.parse(a.inicio), fim: Date.parse(a.fim) }));
  const resultado: DiaLivre[] = [];

  for (let i = 0; i < dias; i++) {
    const data = somarDias(hoje, i);
    const diaSemana = diaDaSemana(data);
    const doDia = faixas.filter((f) => f.dia === diaSemana).sort((a, b) => a.inicioMin - b.inicioMin);
    const inicioDoDia = instante(data, 0).getTime();
    const fimDoDia = inicioDoDia + MS_DIA;
    const bloqueiosDoDia = periodos.filter((p) => p.ini < fimDoDia && p.fim > inicioDoDia);

    const livres: number[] = [];
    for (const f of doDia) {
      for (let m = f.inicioMin; m + duracao <= f.fimMin; m += duracao) {
        const ini = instante(data, m).getTime();
        const fim = ini + duracao * 60_000;
        if (ini <= agora.getTime()) continue;
        if (bloqueiosDoDia.some((p) => p.ini < fim && p.fim > ini)) continue;
        if (ocupados.some((a) => a.ini < fim && a.fim > ini)) continue;
        livres.push(m);
      }
    }
    resultado.push({
      data,
      diaSemana,
      livres,
      trabalha: doDia.length > 0,
      bloqueios: bloqueiosDoDia.map((p) => p.motivo.trim()).filter(Boolean),
    });
  }
  return resultado;
}
