// Perfil do aluno: o que ele tem e quais valores são aceitos.
// Usado nas telas e no servidor. O banco (supabase/migrations) repete estas regras.
//
// Quem vê o quê (ver docs/plano-perfil-e-privacidade.md):
// - Antes do aceite, o personal vê: primeiro nome, objetivo, nível, bairro, a
//   mensagem do pedido e, se o aluno autorizar no pedido, as restrições.
// - Depois do aceite: nome completo, idade, gênero, endereço, peso, altura e medidas.
// - Nunca: e-mail, senha, data de nascimento (o personal vê só a idade).
//
// ATENÇÃO (LGPD): restrições, peso, altura, medidas e exames são dados de saúde
// (dados sensíveis). Só são guardados com consentimento (src/lib/consentimento.ts).

export type Genero = "feminino" | "masculino" | "outro" | "prefiro_nao_informar";
export type NivelAluno = "iniciante" | "intermediario" | "avancado";

export const GENEROS: { valor: Genero; rotulo: string }[] = [
  { valor: "feminino", rotulo: "Feminino" },
  { valor: "masculino", rotulo: "Masculino" },
  { valor: "outro", rotulo: "Outro" },
  { valor: "prefiro_nao_informar", rotulo: "Prefiro não informar" },
];

// O nível é pela experiência com treinamento (há quanto tempo treina), não pela
// frequência semanal.
export const NIVEIS_ALUNO: { valor: NivelAluno; rotulo: string; descricao: string }[] = [
  { valor: "iniciante", rotulo: "Iniciante", descricao: "Nunca treinei ou treino há menos de 6 meses" },
  { valor: "intermediario", rotulo: "Intermediário", descricao: "Treino há 6 meses a 2 anos" },
  { valor: "avancado", rotulo: "Avançado", descricao: "Treino há mais de 2 anos" },
];

export const LIMITES = {
  nome: { min: 2, max: 120 },
  senha: 8,
  objetivo: 300,
  restricoes: 300,
  outrasMedidas: 300,
  endereco: 200,
  bairro: 80,
  cidade: 80,
  peso: { min: 20, max: 300 },
  altura: { min: 100, max: 250 },
  idadeMinima: 18,
};

/** Dados que vêm do cadastro. Nome completo e data de nascimento ficam fixos depois. */
export interface PerfilAluno {
  email: string;
  nomeCompleto: string;
  /** "AAAA-MM-DD" */
  dataNascimento: string;
  genero: Genero | null;
  objetivo: string;
  nivel: NivelAluno | null;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
}

/** O que o aluno pode mudar a qualquer momento na tela "Meu perfil". */
export type PerfilEditavel = Pick<
  PerfilAluno,
  "genero" | "objetivo" | "nivel" | "cep" | "endereco" | "bairro" | "cidade"
>;

export interface DadosSaude {
  /**
   * Declaração obrigatória para enviar pedidos: true = tem restrições (descritas em
   * `restricoes`), false = declarou não ter, null = ainda não declarou.
   */
  temRestricoes: boolean | null;
  restricoes: string;
  pesoKg: number | null;
  alturaCm: number | null;
  outrasMedidas: string;
  /** Quando declarou ou atualizou as restrições (só leitura, vem do banco). */
  restricoesDeclaradasEm: string | null;
}

export interface ContaAluno {
  perfil: PerfilAluno;
  consentimentoSaude: boolean;
  saude: DadosSaude;
}

export const SAUDE_VAZIA: DadosSaude = {
  temRestricoes: null,
  restricoes: "",
  pesoKg: null,
  alturaCm: null,
  outrasMedidas: "",
  restricoesDeclaradasEm: null,
};

/** Pode enviar pedidos: autorizou os dados de saúde e já declarou as restrições. */
export function restricoesDeclaradas(conta: Pick<ContaAluno, "consentimentoSaude" | "saude">): boolean {
  return conta.consentimentoSaude && conta.saude.restricoesDeclaradasEm !== null;
}

export function rotuloNivel(nivel: NivelAluno | null): string {
  return NIVEIS_ALUNO.find((n) => n.valor === nivel)?.rotulo ?? "Não informado";
}

export function rotuloGenero(genero: Genero | null): string {
  return GENEROS.find((g) => g.valor === genero)?.rotulo ?? "Não informado";
}

export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? "";
}

/** Idade completa em anos numa data (padrão: hoje). */
export function idadeEm(dataNascimento: string, hoje = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const nascimento = new Date(ano, mes - 1, dia);
  if (nascimento.getFullYear() !== ano || nascimento.getMonth() !== mes - 1 || nascimento.getDate() !== dia)
    return null; // data que não existe, como 31/02
  let idade = hoje.getFullYear() - ano;
  if (hoje.getMonth() < mes - 1 || (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)) idade--;
  return idade;
}

/** O perfil tem o mínimo para enviar pedidos (objetivo e nível). */
export function perfilProntoParaPedido(perfil: Pick<PerfilAluno, "objetivo" | "nivel">): boolean {
  return perfil.objetivo.trim().length > 0 && perfil.nivel !== null;
}

// ─── Conferências ──────────────────────────────────────────────────────────

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : null);
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

function conferirTexto(problemas: string[], valor: unknown, limite: number, rotulo: string, obrigatorio = false) {
  const t = texto(valor);
  if (t === null) problemas.push(`confira ${rotulo}`);
  else if (obrigatorio && t.length === 0) problemas.push(`preencha ${rotulo}`);
  else if (t.length > limite) problemas.push(`use até ${limite} caracteres em ${rotulo}`);
}

export interface DadosCadastro {
  email: string;
  senha: string;
  nomeCompleto: string;
  dataNascimento: string;
  genero: Genero | null;
  consentimentoSaude: boolean;
}

export function problemasDoCadastro(d: Partial<DadosCadastro> | null | undefined, hoje = new Date()): string[] {
  const problemas: string[] = [];
  const email = texto(d?.email) ?? "";
  const nome = texto(d?.nomeCompleto) ?? "";

  if (!emailValido(email)) problemas.push("informe um e-mail válido");
  if (typeof d?.senha !== "string" || d.senha.length < LIMITES.senha)
    problemas.push(`crie uma senha com pelo menos ${LIMITES.senha} caracteres`);
  else if (d.senha.length > 72) problemas.push("use uma senha com até 72 caracteres");
  if (nome.length < LIMITES.nome.min || nome.length > LIMITES.nome.max || !nome.includes(" "))
    problemas.push("escreva seu nome completo");

  const idade = idadeEm(typeof d?.dataNascimento === "string" ? d.dataNascimento : "", hoje);
  if (idade === null || idade > 120) problemas.push("informe uma data de nascimento válida");
  else if (idade < LIMITES.idadeMinima) problemas.push("o cadastro é só para maiores de 18 anos");

  if (d?.genero != null && !GENEROS.some((g) => g.valor === d.genero)) problemas.push("escolha um gênero da lista");
  if (typeof d?.consentimentoSaude !== "boolean") problemas.push("confira o consentimento");
  return problemas;
}

export function problemasDoPerfil(d: Partial<PerfilEditavel> | null | undefined): string[] {
  const problemas: string[] = [];
  conferirTexto(problemas, d?.objetivo, LIMITES.objetivo, "seu objetivo", true);
  if (!NIVEIS_ALUNO.some((n) => n.valor === d?.nivel)) problemas.push("escolha seu nível");
  if (d?.genero != null && !GENEROS.some((g) => g.valor === d.genero)) problemas.push("escolha um gênero da lista");
  const cep = texto(d?.cep);
  if (cep === null || (cep !== "" && !/^\d{5}-?\d{3}$/.test(cep))) problemas.push("confira o CEP (8 números)");
  conferirTexto(problemas, d?.endereco, LIMITES.endereco, "o endereço");
  conferirTexto(problemas, d?.bairro, LIMITES.bairro, "o bairro");
  conferirTexto(problemas, d?.cidade, LIMITES.cidade, "a cidade");
  return problemas;
}

const numeroOuVazio = (v: unknown, f: { min: number; max: number }) =>
  v === null || (typeof v === "number" && v >= f.min && v <= f.max);

export function problemasDaSaude(d: Partial<DadosSaude> | null | undefined): string[] {
  const problemas: string[] = [];
  if (d?.temRestricoes !== null && typeof d?.temRestricoes !== "boolean")
    problemas.push("responda se você tem restrições");
  else if (d?.temRestricoes === true && (texto(d.restricoes) ?? "").length < 3)
    problemas.push("descreva suas restrições e limitações");
  else if (d?.temRestricoes !== true && (texto(d?.restricoes) ?? "") !== "")
    problemas.push("marque que tem restrições para descrevê-las");
  conferirTexto(problemas, d?.restricoes, LIMITES.restricoes, "as restrições");
  if (!numeroOuVazio(d?.pesoKg, LIMITES.peso))
    problemas.push(`informe um peso entre ${LIMITES.peso.min} e ${LIMITES.peso.max} kg`);
  if (!numeroOuVazio(d?.alturaCm, LIMITES.altura))
    problemas.push(`informe uma altura entre ${LIMITES.altura.min} e ${LIMITES.altura.max} cm`);
  conferirTexto(problemas, d?.outrasMedidas, LIMITES.outrasMedidas, "outras medidas");
  return problemas;
}
