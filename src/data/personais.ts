// Porta de entrada dos dados dos personais.
//
// As telas pegam os personais SÓ pelas funções `listarPersonais` e
// `buscarPersonal` (no fim deste arquivo). Hoje elas leem os dados de exemplo de
// `src/data/exemplos/personais-exemplo.ts`. Quando houver banco de dados, basta
// mudar o conteúdo dessas duas funções: as telas continuam iguais.
//
// O resto do arquivo descreve o formato de um personal (que informações ele tem).

import type { Disponibilidade } from "@/lib/agenda";
import { PERSONAIS_EXEMPLO } from "./exemplos/personais-exemplo";

export type Genero = "f" | "m";
export type Nivel = "ouro" | "prata" | "bronze" | "elite";
export type Local = "casa" | "ar-livre" | "academia" | "online";
export type Objetivo =
  | "Fortalecimento"
  | "Emagrecimento"
  | "Pilates"
  | "Mobilidade"
  | "Corrida"
  | "Pós-parto"
  | "50+";
/** Para quem o personal monta treinos: todos, ou especializado em treino feminino/masculino. */
export type PublicoAtendido = "todos" | "feminino" | "masculino";
export type CorAvatar ="av1" | "av2" | "av3" | "av4" | "av5" | "av6";

export const OBJETIVOS: Objetivo[] = [
  "Fortalecimento",
  "Emagrecimento",
  "Pilates",
  "Mobilidade",
  "Corrida",
  "Pós-parto",
  "50+",
];

export const LOCAIS: { valor: Local; rotulo: string }[] = [
  { valor: "casa", rotulo: "Em casa ou condomínio" },
  { valor: "ar-livre", rotulo: "Ao ar livre" },
  { valor: "academia", rotulo: "Academia" },
  { valor: "online", rotulo: "Online" },
];

export interface Plano {
  vezesPorSemana: number;
  precoAula: number;
  mensalidade: number;
  maisEscolhido?: boolean;
}

export interface Perfil {
  cref: string;
  selo?: string;
  alunosAtivos: number;
  tempoResposta: string;
  sobre: string;
  ondeAtende: { local: Local; rotulo: string; regioes: string }[];
  planos: Plano[];
  depoimentos: { autora: string; tempo: string; texto: string }[];
  politicaCancelamento: string;
}

export interface Personal {
  slug: string;
  nome: string;
  genero: Genero;
  publico: PublicoAtendido;
  /** Horários livres que se repetem toda semana (aulas de 1 h). */
  disponibilidade: Disponibilidade;
  cor: CorAvatar;
  nivel?: Nivel;
  bairro: string;
  distancia: string;
  /** Etiquetas mostradas no cartão da busca. */
  especialidades: string[];
  /** Usados pelo filtro "Objetivo". */
  objetivos: Objetivo[];
  locais: Local[];
  precoAula: number;
  nota: number;
  avaliacoes: number;
  /** Porcentagem de alunos que renovam o plano. */
  renovacao: number;
  perfil: Perfil;
}

// ─── De onde vêm os dados ──────────────────────────────────────────────────
// Hoje: da lista de exemplo. Para usar dados reais, troque só o que está
// dentro destas duas funções (ex.: uma consulta ao banco de dados).
//
// Observação técnica: com um banco de dados de verdade, o Next.js vai pedir
// `"use cache"` nestas funções ou `<Suspense>` nas telas. Veja
// node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md.

/** Todos os personais que aparecem na busca. */
export async function listarPersonais(): Promise<Personal[]> {
  return PERSONAIS_EXEMPLO;
}

/** Um personal pelo endereço do perfil (ex.: "camila-duarte"), ou nada se não existir. */
export async function buscarPersonal(slug: string): Promise<Personal | undefined> {
  return PERSONAIS_EXEMPLO.find((p) => p.slug === slug);
}