import type { Genero, Local, Objetivo, Personal } from "@/data/personais";

export type FaixaPreco = "ate-110" | "110-150" | "acima-150";
export type NotaMinima = 4.5 | 4.8;

export interface Filtros {
  genero: Genero | null;
  objetivos: Objetivo[];
  locais: Local[];
  preco: FaixaPreco | null;
  notaMinima: NotaMinima | null;
}

export const FILTROS_VAZIOS: Filtros = {
  genero: null,
  objetivos: [],
  locais: [],
  preco: null,
  notaMinima: null,
};

export const FAIXAS_PRECO: { valor: FaixaPreco; rotulo: string }[] = [
  { valor: "ate-110", rotulo: "Até R$ 110" },
  { valor: "110-150", rotulo: "R$ 110 a 150" },
  { valor: "acima-150", rotulo: "Acima de R$ 150" },
];

export const NOTAS_MINIMAS: { valor: NotaMinima; rotulo: string }[] = [
  { valor: 4.5, rotulo: "4,5 ou mais" },
  { valor: 4.8, rotulo: "4,8 ou mais" },
];

function cabeNaFaixa(preco: number, faixa: FaixaPreco): boolean {
  if (faixa === "ate-110") return preco <= 110;
  if (faixa === "110-150") return preco > 110 && preco <= 150;
  return preco > 150;
}

/**
 * Regra da busca: dentro de um mesmo grupo basta combinar com uma das opções
 * marcadas (ex.: "Em casa" ou "Online"); entre grupos, precisa combinar com todos.
 */
export function filtrarPersonais(personais: Personal[], f: Filtros): Personal[] {
  return personais.filter(
    (p) =>
      (!f.genero || p.genero === f.genero) &&
      (f.objetivos.length === 0 || f.objetivos.some((o) => p.objetivos.includes(o))) &&
      (f.locais.length === 0 || f.locais.some((l) => p.locais.includes(l))) &&
      (!f.preco || cabeNaFaixa(p.precoAula, f.preco)) &&
      (!f.notaMinima || p.nota >= f.notaMinima),
  );
}

export function temFiltroAtivo(f: Filtros): boolean {
  return (
    f.genero !== null ||
    f.objetivos.length > 0 ||
    f.locais.length > 0 ||
    f.preco !== null ||
    f.notaMinima !== null
  );
}

/** Marca o item se não estiver na lista, desmarca se estiver. */
export function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}
