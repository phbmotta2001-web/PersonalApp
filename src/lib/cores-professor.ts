// Cor suave de cada professor na agenda da coordenação (decisão 64). A coordenação pode escolher
// a cor de cada um (decisão 112); sem escolha, a cor vem da ordem do professor na equipe, então
// fica a mesma em todas as telas. Vermelho fica de fora: é a cor
// de "sem professor". As cores são translúcidas para funcionar no modo claro e no escuro.

const MATIZES = [265, 205, 145, 30, 320, 180, 50, 230, 95, 290, 15, 160];
/** Quantas cores a coordenação tem para escolher (posições 0 a 11). */
export const TOTAL_DE_CORES = MATIZES.length;

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

/** Posição da cor de cada professor: a escolhida pela coordenação ou, sem escolha, a ordem na equipe. */
export function indiceDaCor(equipe: { personalId: string; cor?: number | null }[], personalId: string): number {
  const i = equipe.findIndex((m) => m.personalId === personalId);
  return equipe[i]?.cor ?? i;
}

/** Mapa professor → cor. */
export function coresDaEquipe(equipe: { personalId: string; cor?: number | null }[]): Map<string, CorDoProfessor> {
  return new Map(equipe.map((m, i) => [m.personalId, corDoProfessor(m.cor ?? i)]));
}
