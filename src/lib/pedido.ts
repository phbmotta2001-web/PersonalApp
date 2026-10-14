import type { Local, Personal } from "@/data/personais";

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
export type Dia = (typeof DIAS)[number];

export const PERIODOS = ["Manhã, 6h–9h", "Almoço", "Noite"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const LIMITE_MENSAGEM = 500;

/**
 * O que a aluna preenche ao clicar em "Tenho interesse".
 * Nome, objetivos, restrições e nível não entram aqui: vêm da parte pública do perfil
 * do aluno (src/data/alunos.ts), que o servidor junta ao pedido. Medidas, fotos e
 * exames nunca vão junto: só ficam visíveis depois que o personal aceita.
 */
export interface Pedido {
  slug: string;
  vezesPorSemana: number;
  dias: Dia[];
  periodos: Periodo[];
  locais: Local[];
  mensagem: string;
}

function listaValida<T>(valor: unknown, permitidos: readonly T[]): valor is T[] {
  return (
    Array.isArray(valor) && valor.length > 0 && valor.every((v) => permitidos.includes(v as T))
  );
}

/**
 * Lista o que ainda falta para o pedido poder ser enviado (vazia = tudo certo).
 * Usada na tela, para avisar a aluna, e no servidor, para não aceitar pedidos inválidos.
 */
export function oQueFalta(pedido: Pedido, personal: Personal): string[] {
  const falta: string[] = [];
  const planos = personal.perfil.planos.map((pl) => pl.vezesPorSemana);

  if (!planos.includes(pedido.vezesPorSemana)) falta.push("quantas vezes por semana");
  if (!listaValida(pedido.dias, DIAS) || pedido.dias.length < pedido.vezesPorSemana)
    falta.push(`pelo menos ${pedido.vezesPorSemana} dias`);
  if (!listaValida(pedido.periodos, PERIODOS)) falta.push("um horário");
  if (!listaValida(pedido.locais, personal.locais)) falta.push("um local");
  if (typeof pedido.mensagem !== "string" || pedido.mensagem.length > LIMITE_MENSAGEM)
    falta.push(`uma mensagem com até ${LIMITE_MENSAGEM} caracteres`);

  return falta;
}

/** ["a", "b", "c"] → "a, b e c" */
export function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}
