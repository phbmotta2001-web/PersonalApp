// Perfil do aluno: o que ele tem e quais valores são aceitos.
// Usado na tela "Meu perfil" e no servidor.
//
// O perfil tem duas partes:
// - PÚBLICA (nome, objetivos, restrições, nível): vai para o personal junto com cada pedido.
// - PRIVADA (medidas, fotos, exames): só o aluno vê. O personal só poderá ver depois
//   de aceitar o pedido (essa etapa ainda não existe).
//
// ATENÇÃO (LGPD): restrições, medidas, fotos e exames são dados de saúde, tratados
// pela lei como dados sensíveis. Antes do lançamento, exigem login, armazenamento
// protegido e consentimento do aluno.

export type NivelAluno = "iniciante" | "intermediario" | "avancado";

export interface DadosPrivados {
  pesoKg: number | null;
  alturaCm: number | null;
  outrasMedidas: string;
  // Fotos e exames entram junto com o banco de dados.
}

export interface Aluno {
  nome: string;
  objetivos: string;
  restricoes: string;
  nivel: NivelAluno;
  privado: DadosPrivados;
}

/** A parte do perfil que o personal vê junto com o pedido. */
export type PerfilPublico = Omit<Aluno, "privado">;

export function perfilPublico(aluno: Aluno): PerfilPublico {
  return {
    nome: aluno.nome,
    objetivos: aluno.objetivos,
    restricoes: aluno.restricoes,
    nivel: aluno.nivel,
  };
}

// O nível é pela experiência com treinamento (há quanto tempo treina), não pela
// frequência semanal.
export const NIVEIS_ALUNO: { valor: NivelAluno; rotulo: string; descricao: string }[] = [
  { valor: "iniciante", rotulo: "Iniciante", descricao: "Nunca treinei ou treino há menos de 6 meses" },
  { valor: "intermediario", rotulo: "Intermediário", descricao: "Treino há 6 meses a 2 anos" },
  { valor: "avancado", rotulo: "Avançado", descricao: "Treino há mais de 2 anos" },
];

export const LIMITES = {
  nome: 60,
  texto: 300, // objetivos, restrições e outras medidas
  peso: { min: 20, max: 300 },
  altura: { min: 100, max: 250 },
};

export function rotuloNivel(nivel: NivelAluno): string {
  return NIVEIS_ALUNO.find((n) => n.valor === nivel)?.rotulo ?? nivel;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" ? valor.trim() : null;
}

function numeroOuVazio(valor: unknown, faixa: { min: number; max: number }): boolean {
  return valor === null || (typeof valor === "number" && valor >= faixa.min && valor <= faixa.max);
}

/** Lista o que está errado no perfil (vazia = tudo certo). */
export function problemasDoAluno(dados: Partial<Aluno> | null | undefined): string[] {
  const problemas: string[] = [];
  const nome = texto(dados?.nome) ?? "";
  const objetivos = texto(dados?.objetivos) ?? "";
  const restricoes = texto(dados?.restricoes);
  const privado = dados?.privado;
  const outras = texto(privado?.outrasMedidas);

  if (nome.length < 2) problemas.push("escreva seu nome");
  else if (nome.length > LIMITES.nome) problemas.push(`use até ${LIMITES.nome} letras no nome`);
  if (objetivos.length < 3) problemas.push("conte seus objetivos");
  else if (objetivos.length > LIMITES.texto)
    problemas.push(`use até ${LIMITES.texto} caracteres nos objetivos`);
  if (restricoes === null || restricoes.length > LIMITES.texto)
    problemas.push(`use até ${LIMITES.texto} caracteres nas restrições`);
  if (!NIVEIS_ALUNO.some((n) => n.valor === dados?.nivel)) problemas.push("escolha seu nível");
  if (!numeroOuVazio(privado?.pesoKg, LIMITES.peso))
    problemas.push(`informe um peso entre ${LIMITES.peso.min} e ${LIMITES.peso.max} kg`);
  if (!numeroOuVazio(privado?.alturaCm, LIMITES.altura))
    problemas.push(`informe uma altura entre ${LIMITES.altura.min} e ${LIMITES.altura.max} cm`);
  if (outras === null || outras.length > LIMITES.texto)
    problemas.push(`use até ${LIMITES.texto} caracteres em outras medidas`);

  return problemas;
}

/** Deixa o perfil limpo para guardar (sem espaços sobrando, só os campos conhecidos). */
export function limparAluno(dados: Aluno): Aluno {
  return {
    nome: dados.nome.trim(),
    objetivos: dados.objetivos.trim(),
    restricoes: dados.restricoes.trim(),
    nivel: dados.nivel,
    privado: {
      pesoKg: dados.privado.pesoKg,
      alturaCm: dados.privado.alturaCm,
      outrasMedidas: dados.privado.outrasMedidas.trim(),
    },
  };
}
