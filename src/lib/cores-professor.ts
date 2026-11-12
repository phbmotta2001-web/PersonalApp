// Cor suave de cada professor na agenda da coordenação (decisão 64). A cor vem da ordem do
// professor na equipe, então fica a mesma em todas as telas. Vermelho fica de fora: é a cor
// de "sem professor". As cores são translúcidas para funcionar no modo claro e no escuro.

const MATIZES = [265, 205, 145, 30, 320, 180, 50, 230, 95, 290, 15, 160];

export interface CorDoProfessor {
  /** Fundo do turno (bem claro). */
  turno: string;
  /** Fundo da aula. */
  aula: string;
  /** Borda e bolinha da legenda. */
  forte: string;
}

export function corDoProfessor(indice: number): CorDoProfessor {
  const h = MATIZES[((indice % MATIZES.length) + MATIZES.length) % MATIZES.length];
  return {
    turno: `hsl(${h} 75% 60% / 0.16)`,
    aula: `hsl(${h} 75% 62% / 0.32)`,
    forte: `hsl(${h} 55% 48%)`,
  };
}

/** Mapa professor → cor, na ordem da equipe. */
export function coresDaEquipe(equipe: { personalId: string }[]): Map<string, CorDoProfessor> {
  return new Map(equipe.map((m, i) => [m.personalId, corDoProfessor(i)]));
}
