import type { Local, Personal } from "@/data/personais";

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;
export type Dia = (typeof DIAS)[number];

export const PERIODOS = ["Manhã, 6h–9h", "Almoço", "Noite"] as const;
export type Periodo = (typeof PERIODOS)[number];

/** A mensagem pode ter informações de saúde e o personal a lê antes de aceitar. */
export const LIMITE_MENSAGEM = 200;

/**
 * O que o aluno preenche ao clicar em "Tenho interesse".
 * Primeiro nome, objetivo, nível, bairro e as restrições declaradas vêm do perfil
 * guardado no banco. As restrições vão em TODO pedido (obrigatório desde 14/10/2026);
 * o aluno só confirma que estão atualizadas (`confirmoRestricoes`). A cópia é feita
 * pelo próprio banco, a partir do perfil (função enviar_pedido).
 */
export interface Pedido {
  slug: string;
  vezesPorSemana: number;
  dias: Dia[];
  periodos: Periodo[];
  locais: Local[];
  mensagem: string;
  confirmoRestricoes: boolean;
}

function listaValida<T>(valor: unknown, permitidos: readonly T[]): valor is T[] {
  return (
    Array.isArray(valor) && valor.length > 0 && valor.every((v) => permitidos.includes(v as T))
  );
}

/**
 * Lista o que ainda falta para o pedido poder ser enviado (vazia = tudo certo).
 * Usada na tela, para avisar o aluno, e no servidor, para não aceitar pedidos inválidos.
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
  if (pedido.confirmoRestricoes !== true) falta.push("a confirmação das suas restrições");

  return falta;
}
