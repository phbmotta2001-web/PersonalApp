// Matrículas e aulas fixas (Fase 1, etapa 3). Ver docs/plano-fase-1-agenda.md.
//
// Regras (decisões de 16/10/2026):
// - Horário aceito por um aluno fica indisponível para os outros (o banco também confere).
// - Cada matrícula pode ter outra duração que não a padrão do personal.
// - Horário fixo fora do expediente pode, só com aviso.
// - Valor mensal e vencimento ficam anotados (opcionais); a cobrança é a etapa 7.

import { DIAS, DURACOES, curtoDoDia, diaDaSemana, emBrasilia, minParaHora, nomeDoDia, type Duracao, type Faixa } from "./expediente";
import { juntarComE } from "./formato";

export interface HorarioFixo {
  /** 0 = domingo */
  dia: number;
  inicioMin: number;
}

export interface DadosMatricula {
  horarios: HorarioFixo[];
  duracao: Duracao;
  local: string;
  /** false = mensalidade pela tabela de valores do personal (calculada ao salvar). */
  valorForaDoPadrao: boolean;
  /** Só com valor fora do padrão: como o personal digitou, "250" ou "250,00". Vazio = sem valor. */
  valor: string;
  /** 1 a 31, ou null. */
  diaVencimento: number | null;
  /** "AAAA-MM-DD" */
  inicio: string;
  /** "AAAA-MM-DD" ou "" (sem fim). */
  fim: string;
}

export interface Matricula {
  id: string;
  vinculoId: string;
  horarios: HorarioFixo[];
  duracao: Duracao;
  local: string | null;
  valorCentavos: number | null;
  valorForaDoPadrao: boolean;
  diaVencimento: number | null;
  inicio: string;
  fim: string | null;
}

/** Horário fixo de outra matrícula do personal (para avisar antes de salvar). */
export interface HorarioOcupado extends HorarioFixo {
  duracao: number;
  nome: string;
}

export const LIMITE_LOCAL = 80;
export const MAX_HORARIOS = 7;

/** "250", "250,5", "1.250,00", "R$ 250" → centavos; "" → null; inválido → NaN. */
export function reaisParaCentavos(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return NaN;
  const [inteiro, decimais = ""] = t.replace(/\./g, "").split(",");
  return Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
}

/** 25000 → "R$ 250,00" */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** 25000 → "250,00" (para o campo do formulário) */
export const centavosParaCampo = (centavos: number | null) =>
  centavos == null ? "" : (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const ordemDoDia = (dia: number) => DIAS.findIndex((d) => d.valor === dia);
export const ordenarHorarios = (h: HorarioFixo[]) =>
  [...h].sort((a, b) => ordemDoDia(a.dia) - ordemDoDia(b.dia) || a.inicioMin - b.inicioMin);

const choca = (a: HorarioFixo, duracaoA: number, b: HorarioFixo, duracaoB: number) =>
  a.dia === b.dia && a.inicioMin < b.inicioMin + duracaoB && b.inicioMin < a.inicioMin + duracaoA;

/** Lista o que impede salvar a matrícula (vazia = pode salvar). */
export function problemasDaMatricula(d: DadosMatricula): string[] {
  const p: string[] = [];
  if (d.horarios.length === 0) p.push("escolha pelo menos um horário fixo");
  if (d.horarios.length > MAX_HORARIOS) p.push(`use no máximo ${MAX_HORARIOS} horários`);
  if (!DURACOES.includes(d.duracao)) p.push("escolha a duração da aula");
  if (d.horarios.some((h) => h.inicioMin % 30 !== 0 || h.inicioMin < 0 || h.inicioMin + d.duracao > 1440))
    p.push("os horários têm que terminar até meia-noite");
  const repetidos = d.horarios.some((a, i) => d.horarios.some((b, j) => j > i && choca(a, d.duracao, b, d.duracao)));
  if (repetidos) p.push("dois horários se sobrepõem no mesmo dia");
  if (d.local.trim().length > LIMITE_LOCAL) p.push(`use até ${LIMITE_LOCAL} caracteres no local`);
  const valor = d.valorForaDoPadrao ? reaisParaCentavos(d.valor) : null;
  if (valor !== null && (Number.isNaN(valor) || valor < 1 || valor > 10_000_000)) p.push("confira o valor mensal");
  if (d.diaVencimento !== null && !(d.diaVencimento >= 1 && d.diaVencimento <= 31)) p.push("escolha o dia de vencimento");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.inicio)) p.push("escolha a data de início");
  else if (d.fim && d.fim < d.inicio) p.push("a data de fim tem que ser depois do início");
  return p;
}

/** Horários que já são de outro aluno: "segunda às 07:00 (Ana)". */
export function choquesComOutros(horarios: HorarioFixo[], duracao: number, ocupados: HorarioOcupado[]): string[] {
  return ordenarHorarios(horarios).flatMap((h) =>
    ocupados
      .filter((o) => choca(h, duracao, o, o.duracao))
      .map((o) => `${nomeDoDia(h.dia).toLowerCase()} às ${minParaHora(h.inicioMin)} (${o.nome.split(" ")[0]})`),
  );
}

/** Horários fixos que ficam fora do expediente (pode, mas o app avisa). */
export function foraDoExpediente(horarios: HorarioFixo[], duracao: number, faixas: Faixa[]): HorarioFixo[] {
  return ordenarHorarios(horarios).filter(
    (h) => !faixas.some((f) => f.dia === h.dia && f.inicioMin <= h.inicioMin && h.inicioMin + duracao <= f.fimMin),
  );
}

/**
 * Resumo para a tela: "Seg e Qui às 07:00" quando todos têm a mesma hora,
 * senão "Seg 07:00, Qua 18:30 e Sex 07:00".
 */
export function resumoDosHorarios(horarios: HorarioFixo[]): string {
  const h = ordenarHorarios(horarios);
  if (h.length === 0) return "";
  if (h.every((x) => x.inicioMin === h[0].inicioMin))
    return `${juntarComE(h.map((x) => curtoDoDia(x.dia)))} às ${minParaHora(h[0].inicioMin)}`;
  return juntarComE(h.map((x) => `${curtoDoDia(x.dia)} ${minParaHora(x.inicioMin)}`));
}

// ─── Vencimento (decisão de 16/10/2026) ─────────────────────────────────────
// A primeira mensalidade é paga no início da matrícula; as seguintes vencem um mês
// depois, todo mês no mesmo dia. O personal pode trocar o dia.

/** Dia do mês de uma data "AAAA-MM-DD". */
export const diaDoMes = (data: string) => Number(data.slice(8, 10));

/** Vencimento seguinte ao início: no mês seguinte, no dia escolhido (ou no último dia do mês, se não existir). */
export function proximoVencimento(inicio: string, dia: number): string {
  const [a, m] = inicio.split("-").map(Number);
  const ano = m === 12 ? a + 1 : a;
  const mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** Primeira data DEPOIS de `desde` que cai no dia `dia` do mês (ou no último dia, se o mês for curto). */
export function proximaDataNoDia(desde: string, dia: number): string {
  const [a, m] = desde.split("-").map(Number);
  for (let i = 0; i < 2; i++) {
    const ano = a + Math.floor((m - 1 + i) / 12);
    const mes = ((m - 1 + i) % 12) + 1;
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
    if (data > desde) return data;
  }
  return proximoVencimento(desde, dia);
}

/** "sexta, 17/10/2026 às 07:00 em Academia do Centro" (horário de Brasília). */
export function textoDaAula(inicio: string, local: string | null): string {
  const { data, hora } = emBrasilia(inicio);
  const dia = nomeDoDia(diaDaSemana(data)).toLowerCase();
  return `${dia}, ${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)} às ${hora}${local ? ` em ${local}` : ""}`;
}
