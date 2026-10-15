export function formatarNota(nota: number): string {
  return nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarReais(valor: number): string {
  return "R$ " + valor.toLocaleString("pt-BR");
}

/** Palavras que mudam conforme o personal: "a Camila… ela" ou "o Rafael… ele". */
export function tratamento(personal: { nome: string; genero: "f" | "m" }) {
  const f = personal.genero === "f";
  return {
    nome: personal.nome.split(" ")[0],
    artigo: f ? "a" : "o",
    pronome: f ? "ela" : "ele",
    avisado: f ? "avisada" : "avisado",
  };
}

export function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** ["a", "b", "c"] → "a, b e c" */
export function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return itens.slice(0, -1).join(", ") + " e " + itens[itens.length - 1];
}

/** ["escreva o nome", "escolha o nível"] → "Escreva o nome e escolha o nível." */
export function frase(itens: string[]): string {
  const t = juntarComE(itens);
  return t ? maiuscula(t) + "." : "";
}

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("");
}
