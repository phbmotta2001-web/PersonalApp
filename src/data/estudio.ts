"use server";

// P-Bell Estúdio (decisão 54): estúdio, equipe, turmas, alunos do estúdio e chamada.
// Roda só no servidor. Gravar passa pelas funções do banco, que conferem o papel de quem
// está logado (coordenação ou professor). Nada aqui toca na agenda particular do personal.

import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";
import { funcionamentoParaBanco, problemasDoFuncionamento, type Funcionamento } from "@/lib/funcionamento";
import type { Resposta } from "./conta";

export type PapelNoEstudio = "coordenacao" | "professor";

export interface MeuEstudio {
  id: string;
  nome: string;
  papel: PapelNoEstudio;
}

/** Estúdios em que o personal logado trabalha. */
export async function meusEstudios(): Promise<MeuEstudio[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase.from("estudio_membros").select("papel, estudios(id, nome)").eq("personal_id", id);
  return (data ?? [])
    .map((m) => {
      const e = m.estudios as unknown as { id: string; nome: string } | null;
      return e ? { id: e.id, nome: e.nome, papel: m.papel as PapelNoEstudio } : null;
    })
    .filter((m): m is MeuEstudio => m !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export interface AulaDeTurma {
  id: string;
  inicio: string;
  fim: string;
  estudioId: string;
  estudioNome: string;
  turmaId: string;
  modalidade: string;
  vagas: number;
  alunos: number;
  chamadaEm: string | null;
  cancelada: boolean;
  /** Turno de trabalho (sem alunos nem chamada). */
  turno: boolean;
}

/** Aulas de turma que o personal logado dá entre dois instantes (ISO). */
export async function aulasDeTurmaParaMim(de: string, ate: string): Promise<AulaDeTurma[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("aulas_turma")
    .select("id, inicio, fim, estudio_id, turma_id, chamada_em, situacao, turmas(modalidade, vagas, tipo), estudios(nome)")
    .eq("professor_id", id)
    .lt("inicio", ate)
    .gt("fim", de)
    .order("inicio");
  const aulas = data ?? [];
  const turmas = [...new Set(aulas.map((a) => a.turma_id))];
  const { data: matriculas } = turmas.length
    ? await supabase.from("turma_alunos").select("turma_id").in("turma_id", turmas)
    : { data: [] };
  const porTurma = new Map<string, number>();
  for (const m of matriculas ?? []) porTurma.set(m.turma_id, (porTurma.get(m.turma_id) ?? 0) + 1);
  return aulas.map((a) => {
    const t = a.turmas as unknown as { modalidade: string; vagas: number | null; tipo: string };
    const e = a.estudios as unknown as { nome: string };
    return {
      id: a.id,
      inicio: a.inicio,
      fim: a.fim,
      estudioId: a.estudio_id,
      estudioNome: e?.nome ?? "Estúdio",
      turmaId: a.turma_id,
      modalidade: t?.modalidade ?? "Turma",
      vagas: t?.vagas ?? 0,
      alunos: porTurma.get(a.turma_id) ?? 0,
      chamadaEm: a.chamada_em,
      cancelada: a.situacao === "cancelada",
      turno: t?.tipo === "turno",
    };
  });
}

export interface ValoresDePagamento {
  valorHora: number | null;
  valorAula: number | null;
  valorPorAluno: number | null;
  percentual: number | null;
}

export interface MembroDaEquipe {
  personalId: string;
  nome: string;
  papel: PapelNoEstudio;
  /** Valor próprio do professor (vazio: usa o padrão do estúdio). */
  valores: ValoresDePagamento;
}

export type TipoDeEstudio = "estudio" | "academia";
export type ModeloDePagamento = "hora" | "aula_comissao" | "percentual";

export interface ConfigDoEstudio {
  tipo: TipoDeEstudio;
  pagamentoModelo: ModeloDePagamento;
  valores: ValoresDePagamento;
  maxAlunosTurma: number;
  pix: { tipo: string; chave: string; nome: string; cidade: string } | null;
  /** Mensalidade por vezes na semana (1 a 7), em centavos. */
  precos: Partial<Record<number, number>>;
  /** Dias e horários de funcionamento (vazio: ainda não definido). */
  funcionamento: Funcionamento;
}

export type TipoDeHorario = "turma" | "turno";

export interface TurmaDoEstudio {
  id: string;
  tipo: TipoDeHorario;
  modalidade: string;
  diaSemana: number;
  inicioMin: number;
  duracaoMin: number;
  vagas: number;
  professorId: string | null;
  alunos: string[];
}

export interface AlunoDoEstudio {
  id: string;
  nome: string;
  whatsapp: string | null;
  comApp: boolean;
  turmas: string[];
  /** Exceção à tabela, em centavos. */
  valorMensal: number | null;
  diaVencimento: number | null;
}

export interface EstudioCompleto {
  id: string;
  nome: string;
  papel: PapelNoEstudio;
  antecedenciaFaltaH: number;
  validadeReposicaoDias: number;
  config: ConfigDoEstudio;
  equipe: MembroDaEquipe[];
  turmas: TurmaDoEstudio[];
  /** Aulas extras de hoje em diante (uma data só). */
  extras: ExtraDoEstudio[];
  alunos: AlunoDoEstudio[];
}

export interface ExtraDoEstudio {
  id: string;
  tipo: TipoDeHorario;
  modalidade: string;
  data: string;
  inicioMin: number;
  duracaoMin: number;
  professorId: string | null;
}

/** O estúdio com equipe, turmas ativas e alunos ativos (só para quem é do estúdio). */
export async function lerEstudio(estudioId: string): Promise<EstudioCompleto | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const [{ data: e }, { data: papel }, { data: equipe }, { data: turmas }, { data: alunos }, { data: matriculas }, { data: membros }, { data: precos }, { data: funcionamento }, { data: extras }] = await Promise.all([
    supabase
      .from("estudios")
      .select(
        "id, nome, antecedencia_falta_h, validade_reposicao_dias, tipo, pagamento_modelo, valor_hora_centavos, valor_aula_centavos, valor_por_aluno_centavos, percentual, max_alunos_turma, pix_tipo, pix_chave, pix_nome, pix_cidade",
      )
      .eq("id", estudioId)
      .maybeSingle(),
    supabase.rpc("papel_no_estudio", { p_estudio: estudioId }),
    supabase.rpc("equipe_do_estudio", { p_estudio: estudioId }),
    supabase
      .from("turmas")
      .select("id, tipo, modalidade, dia_semana, inicio_min, duracao_min, vagas, professor_id")
      .eq("estudio_id", estudioId)
      .eq("ativa", true)
      .is("avulsa", null)
      .order("dia_semana")
      .order("inicio_min"),
    supabase
      .from("estudio_alunos")
      .select("id, nome, whatsapp, aluno_id, valor_mensal_centavos, dia_vencimento")
      .eq("estudio_id", estudioId)
      .eq("situacao", "ativo")
      .order("nome"),
    supabase.from("turma_alunos").select("turma_id, estudio_aluno_id"),
    supabase
      .from("estudio_membros")
      .select("personal_id, valor_hora_centavos, valor_aula_centavos, valor_por_aluno_centavos, percentual")
      .eq("estudio_id", estudioId),
    supabase.from("estudio_precos").select("vezes, valor_centavos").eq("estudio_id", estudioId),
    supabase.from("estudio_funcionamento").select("dia_semana, inicio_min, fim_min").eq("estudio_id", estudioId),
    supabase
      .from("turmas")
      .select("id, tipo, modalidade, avulsa, inicio_min, duracao_min, professor_id")
      .eq("estudio_id", estudioId)
      .eq("ativa", true)
      .gte("avulsa", new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10))
      .order("avulsa")
      .order("inicio_min"),
  ]);
  const valoresDe = (v: { valor_hora_centavos: number | null; valor_aula_centavos: number | null; valor_por_aluno_centavos: number | null; percentual: number | string | null } | undefined): ValoresDePagamento => ({
    valorHora: v?.valor_hora_centavos ?? null,
    valorAula: v?.valor_aula_centavos ?? null,
    valorPorAluno: v?.valor_por_aluno_centavos ?? null,
    percentual: v?.percentual == null ? null : Number(v.percentual),
  });
  if (!e || !papel) return null;
  const doAluno = (alunoId: string) => (matriculas ?? []).filter((m) => m.estudio_aluno_id === alunoId).map((m) => m.turma_id);
  const daTurma = (turmaId: string) => (matriculas ?? []).filter((m) => m.turma_id === turmaId).map((m) => m.estudio_aluno_id);
  return {
    id: e.id,
    nome: e.nome,
    papel: papel as PapelNoEstudio,
    antecedenciaFaltaH: e.antecedencia_falta_h,
    validadeReposicaoDias: e.validade_reposicao_dias,
    config: {
      tipo: e.tipo as TipoDeEstudio,
      pagamentoModelo: e.pagamento_modelo as ModeloDePagamento,
      valores: valoresDe(e),
      maxAlunosTurma: e.max_alunos_turma,
      pix: e.pix_tipo && e.pix_chave ? { tipo: e.pix_tipo, chave: e.pix_chave, nome: e.pix_nome ?? "", cidade: e.pix_cidade ?? "" } : null,
      precos: Object.fromEntries((precos ?? []).map((p) => [p.vezes, p.valor_centavos])),
      funcionamento: Object.fromEntries((funcionamento ?? []).map((f) => [f.dia_semana, { inicio: f.inicio_min, fim: f.fim_min }])),
    },
    equipe: ((equipe ?? []) as { personal_id: string; nome: string; papel: string }[]).map((m) => ({
      personalId: m.personal_id,
      nome: m.nome,
      papel: m.papel as PapelNoEstudio,
      valores: valoresDe((membros ?? []).find((x) => x.personal_id === m.personal_id)),
    })),
    turmas: (turmas ?? []).map((t) => ({
      id: t.id,
      tipo: t.tipo as TipoDeHorario,
      modalidade: t.modalidade,
      diaSemana: t.dia_semana,
      inicioMin: t.inicio_min,
      duracaoMin: t.duracao_min,
      vagas: t.vagas ?? 0,
      professorId: t.professor_id,
      alunos: daTurma(t.id),
    })),
    extras: (extras ?? []).map((t) => ({
      id: t.id,
      tipo: t.tipo as TipoDeHorario,
      modalidade: t.modalidade,
      data: t.avulsa as string,
      inicioMin: t.inicio_min,
      duracaoMin: t.duracao_min,
      professorId: t.professor_id,
    })),
    alunos: (alunos ?? []).map((a) => ({
      id: a.id,
      nome: a.nome,
      whatsapp: a.whatsapp,
      comApp: a.aluno_id != null,
      turmas: doAluno(a.id),
      valorMensal: a.valor_mensal_centavos,
      diaVencimento: a.dia_vencimento,
    })),
  };
}

export interface AlunoNaChamada {
  id: string;
  nome: string;
  situacao: "presente" | "falta" | "falta_avisada" | null;
  /** Veio repor (não é da turma). */
  reposicao?: boolean;
}

export interface AulaParaChamada {
  id: string;
  inicio: string;
  fim: string;
  estudioId: string;
  estudioNome: string;
  modalidade: string;
  vagas: number;
  chamadaEm: string | null;
  cancelada: boolean;
  souProfessor: boolean;
  professorId: string | null;
  diaSemana: number;
  turno: boolean;
  alunos: AlunoNaChamada[];
}

/** Uma aula de turma com a lista de alunos e a chamada já feita. */
export async function lerAulaParaChamada(aulaId: string): Promise<AulaParaChamada | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data: a } = await supabase
    .from("aulas_turma")
    .select("id, inicio, fim, estudio_id, turma_id, professor_id, chamada_em, situacao, turmas(modalidade, vagas, tipo, dia_semana, inicio_min), estudios(nome)")
    .eq("id", aulaId)
    .maybeSingle();
  if (!a) return null;
  const [{ data: matriculas }, { data: presencas }] = await Promise.all([
    supabase.from("turma_alunos").select("estudio_alunos(id, nome, situacao)").eq("turma_id", a.turma_id),
    supabase.from("presencas").select("estudio_aluno_id, situacao, origem, estudio_alunos(id, nome)").eq("aula_turma_id", a.id),
  ]);
  const marcas = new Map((presencas ?? []).map((p) => [p.estudio_aluno_id, p.situacao as AlunoNaChamada["situacao"]]));
  const alunos = new Map<string, AlunoNaChamada>();
  for (const m of matriculas ?? []) {
    const x = m.estudio_alunos as unknown as { id: string; nome: string; situacao: string } | null;
    if (x && x.situacao === "ativo") alunos.set(x.id, { id: x.id, nome: x.nome, situacao: marcas.get(x.id) ?? null });
  }
  // Quem já tem marca na aula (ex.: reposição) entra na lista mesmo sem estar na turma.
  for (const p of presencas ?? []) {
    const x = p.estudio_alunos as unknown as { id: string; nome: string } | null;
    if (x && !alunos.has(x.id)) alunos.set(x.id, { id: x.id, nome: x.nome, situacao: marcas.get(x.id) ?? null, reposicao: p.origem === "reposicao" });
  }
  const t = a.turmas as unknown as { modalidade: string; vagas: number | null; tipo: string; dia_semana: number; inicio_min: number };
  const e = a.estudios as unknown as { nome: string };
  return {
    turno: t?.tipo === "turno",
    id: a.id,
    inicio: a.inicio,
    fim: a.fim,
    estudioId: a.estudio_id,
    estudioNome: e?.nome ?? "Estúdio",
    modalidade: t?.modalidade ?? "Turma",
    vagas: t?.vagas ?? 0,
    chamadaEm: a.chamada_em,
    cancelada: a.situacao === "cancelada",
    souProfessor: a.professor_id === id,
    professorId: a.professor_id,
    diaSemana: t?.dia_semana ?? 0,
    alunos: [...alunos.values()].sort((x, y) => x.nome.localeCompare(y.nome)),
  };
}

/** Alunos das turmas que o personal logado dá, por estúdio (para a aba Alunos). */
export async function alunosDasMinhasTurmas(): Promise<{ estudio: string; alunos: { id: string; nome: string; turmas: string[] }[] }[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, modalidade, dia_semana, inicio_min, estudios(nome)")
    .eq("professor_id", id)
    .eq("ativa", true);
  if (!turmas?.length) return [];
  const { data: matriculas } = await supabase
    .from("turma_alunos")
    .select("turma_id, estudio_alunos(id, nome, situacao)")
    .in(
      "turma_id",
      turmas.map((t) => t.id),
    );
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const rotulo = new Map(
    turmas.map((t) => [
      t.id,
      `${DIAS[t.dia_semana]} ${String(Math.floor(t.inicio_min / 60)).padStart(2, "0")}:${String(t.inicio_min % 60).padStart(2, "0")}`,
    ]),
  );
  const estudioDa = new Map(turmas.map((t) => [t.id, (t.estudios as unknown as { nome: string })?.nome ?? "Estúdio"]));
  const grupos = new Map<string, Map<string, { id: string; nome: string; turmas: string[] }>>();
  for (const m of matriculas ?? []) {
    const x = m.estudio_alunos as unknown as { id: string; nome: string; situacao: string } | null;
    if (!x || x.situacao !== "ativo") continue;
    const estudio = estudioDa.get(m.turma_id)!;
    const g = grupos.get(estudio) ?? new Map();
    const atual = g.get(x.id) ?? { id: x.id, nome: x.nome, turmas: [] };
    atual.turmas.push(rotulo.get(m.turma_id)!);
    g.set(x.id, atual);
    grupos.set(estudio, g);
  }
  return [...grupos.entries()].map(([estudio, g]) => ({
    estudio,
    alunos: [...g.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
  }));
}

// ─── Gravações ──────────────────────────────────────────────────────────────

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export async function criarEstudio(
  nome: string,
  tipo: TipoDeEstudio = "estudio",
  funcionamento?: Funcionamento,
  /** Aulas lançadas em todo o funcionamento (decisão 63); null: não lançar. */
  grade?: { duracao: number; modalidade: string } | null,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("criar_estudio", { p_nome: typeof nome === "string" ? nome : "" });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível criar o estúdio.") };
  if (tipo === "academia") {
    await supabase.rpc("salvar_config_estudio", { p_estudio: data, p: { tipo: "academia", pagamento_modelo: "hora" } });
  }
  if (funcionamento && problemasDoFuncionamento(funcionamento).length === 0) {
    const { error: erroFuncionamento } = await supabase.rpc("salvar_funcionamento_estudio", { p_estudio: data, p: funcionamentoParaBanco(funcionamento) });
    if (!erroFuncionamento && grade) await gerarGrade(data as string, grade.duracao, grade.modalidade);
  }
  return { ok: true, id: data as string };
}

/** Lança aulas de X minutos em todo o funcionamento, sem professor, só nos horários vazios. */
export async function gerarGrade(estudioId: string, duracao: number, modalidade: string): Promise<{ ok: true; criadas: number } | { ok: false; erro: string }> {
  if (!Number.isInteger(duracao) || duracao < 15 || duracao > 240) return { ok: false, erro: "Escolha a duração das aulas." };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("gerar_grade_estudio", { p_estudio: estudioId, p_duracao: duracao, p_modalidade: (modalidade ?? "").trim() });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível lançar as aulas (falta atualizar o banco: migração 39).") } : { ok: true, criadas: data as number };
}

export type AlcanceDaAula = "dia" | "semana" | "horario";

/**
 * Altera ou remove uma aula da grade: só nesta data (exceção), toda semana neste dia e
 * horário, ou todos os dias neste horário (vira o padrão do estúdio).
 */
export async function alterarAula(
  aulaId: string,
  alcance: AlcanceDaAula,
  acao: "alterar" | "remover" | "reativar",
  mudancas: { modalidade?: string | null; vagas?: number | null; professor?: { id: string | null } } = {},
): Promise<{ ok: true; n: number } | { ok: false; erro: string }> {
  if (mudancas.vagas != null && (!Number.isInteger(mudancas.vagas) || mudancas.vagas < 1 || mudancas.vagas > 100)) return { ok: false, erro: "Vagas de 1 a 100." };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("alterar_aula_estudio", {
    p_aula: aulaId,
    p_alcance: alcance,
    p_acao: acao,
    p_modalidade: mudancas.modalidade?.trim() || null,
    p_vagas: mudancas.vagas ?? null,
    p_troca_professor: mudancas.professor !== undefined,
    p_professor: mudancas.professor?.id ?? null,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível alterar a aula (falta atualizar o banco: migração 39).") } : { ok: true, n: data as number };
}

/** Link de convite para um professor entrar na equipe. */
export async function convidarProfessor(estudioId: string): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("convidar_para_estudio", { p_estudio: estudioId, p_papel: "professor" });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível criar o convite.") };
  return { ok: true, link: `${await origemDoSite()}/estudio/convite/${data}` };
}

export async function verConviteEstudio(codigo: string): Promise<{ estudio: string; situacao: string }> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ver_convite_estudio", { p_codigo: codigo });
  const c = (data ?? {}) as { estudio?: string; situacao?: string };
  return { estudio: c.estudio ?? "", situacao: c.situacao ?? "inexistente" };
}

export async function aceitarConviteEstudio(codigo: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("aceitar_convite_estudio", { p_codigo: codigo });
  return error || !data ? { ok: false, erro: doBanco(error?.message, "Não foi possível entrar no estúdio.") } : { ok: true, id: data as string };
}

export async function removerDaEquipe(estudioId: string, personalId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("remover_do_estudio", { p_estudio: estudioId, p_personal: personalId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível remover.") } : { ok: true };
}

export interface DadosTurma {
  id: string | null;
  tipo: TipoDeHorario;
  modalidade: string;
  diaSemana: number;
  inicioMin: number;
  duracaoMin: number;
  vagas: number;
  professorId: string | null;
}

export async function salvarTurma(estudioId: string, t: DadosTurma): Promise<Resposta> {
  const turno = t.tipo === "turno";
  if (!t.modalidade?.trim()) return { ok: false, erro: turno ? "Informe a função (ex.: Musculação)." : "Informe a modalidade (ex.: Funcional)." };
  if (!turno && (!Number.isInteger(t.vagas) || t.vagas < 1 || t.vagas > 100)) return { ok: false, erro: "Vagas de 1 a 100." };
  const supabase = await criarClienteSupabase();
  const { data: est } = await supabase.from("estudios").select("max_alunos_turma").eq("id", estudioId).maybeSingle();
  if (!turno && est && t.vagas > est.max_alunos_turma) return { ok: false, erro: `O máximo do estúdio é ${est.max_alunos_turma} alunos por turma.` };
  const { error } = await supabase.rpc("salvar_horario", {
    p_estudio: estudioId,
    p_turma: t.id,
    p_tipo: turno ? "turno" : "turma",
    p_modalidade: t.modalidade.trim(),
    p_dia: t.diaSemana,
    p_inicio_min: t.inicioMin,
    p_duracao: t.duracaoMin,
    p_vagas: turno ? null : t.vagas,
    p_professor: t.professorId,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar a turma.") } : { ok: true };
}

export interface NovosHorariosDoEstudio {
  tipo: TipoDeHorario;
  modalidade: string;
  professorId: string | null;
  vagas: number | null;
  /** Duração de cada aula da turma (o turno ocupa o intervalo inteiro). */
  duracao: number | null;
  /** Padrão: os dias da semana. */
  dias: number[] | null;
  /** Aula extra: a data ("AAAA-MM-DD"). */
  data: string | null;
  intervalos: { de: number; ate: number }[];
}

/**
 * Cria de uma vez (decisão 66): um ou mais intervalos "das … às …", em vários dias toda semana
 * ou numa data só (aula extra). Na turma, o intervalo vira aulas seguidas da duração escolhida.
 */
export async function criarHorarios(estudioId: string, h: NovosHorariosDoEstudio): Promise<Resposta> {
  const turno = h.tipo === "turno";
  if (!h.modalidade?.trim()) return { ok: false, erro: turno ? "Informe a função (ex.: Musculação)." : "Informe a modalidade (ex.: Pilates)." };
  if (!Array.isArray(h.intervalos) || h.intervalos.length === 0) return { ok: false, erro: "Informe pelo menos um horário." };
  if (h.data != null && !/^\d{4}-\d{2}-\d{2}$/.test(h.data)) return { ok: false, erro: "Escolha a data da aula extra." };
  if (h.data == null && !h.dias?.length) return { ok: false, erro: "Escolha pelo menos um dia." };
  const supabase = await criarClienteSupabase();
  if (!turno) {
    const { data: est } = await supabase.from("estudios").select("max_alunos_turma").eq("id", estudioId).maybeSingle();
    if (est && (h.vagas ?? 0) > est.max_alunos_turma) return { ok: false, erro: `O máximo do estúdio é ${est.max_alunos_turma} alunos por turma.` };
  }
  const { error } = await supabase.rpc("criar_horarios_estudio", {
    p_estudio: estudioId,
    p_tipo: h.tipo,
    p_modalidade: h.modalidade.trim(),
    p_professor: h.professorId,
    p_vagas: turno ? null : h.vagas,
    p_duracao: turno ? null : h.duracao,
    p_dias: h.data != null ? null : h.dias,
    p_data: h.data,
    p_intervalos: h.intervalos.map((i) => ({ de: i.de, ate: i.ate })),
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar (falta atualizar o banco: migração 40).") } : { ok: true };
}

/**
 * O mesmo horário em vários dias de uma vez (ex.: João, seg, qua e sex das 6h às 10h): cria
 * uma turma ou um turno por dia. Diz em quais dias não deu certo.
 */
export async function salvarTurmaNosDias(estudioId: string, t: DadosTurma, dias: number[]): Promise<Resposta> {
  const lista = [...new Set(Array.isArray(dias) ? dias : [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (lista.length === 0) return { ok: false, erro: "Escolha pelo menos um dia." };
  const falhas: string[] = [];
  for (const d of lista) {
    const r = await salvarTurma(estudioId, { ...t, id: null, diaSemana: d });
    if (!r.ok) falhas.push(`${NOMES_DIAS[d]}: ${r.erro}`);
  }
  if (falhas.length === lista.length) return { ok: false, erro: falhas.length === 1 ? falhas[0].split(": ").slice(1).join(": ") : falhas.join(" ") };
  if (falhas.length) return { ok: false, erro: `Salvo nos outros dias. Não deu em ${falhas.join(" ")}` };
  return { ok: true };
}

const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Função ainda não criada no banco (migração 41 não rodou). */
const semFuncao = (e: { code?: string; message: string }) => e.code === "PGRST202" || /could not find the function/i.test(e.message);

/** Roda em paralelo, 8 por vez; para no primeiro erro. */
async function emParalelo<T>(itens: T[], fazer: (x: T) => Promise<string | null>): Promise<string | null> {
  let erro: string | null = null;
  for (let k = 0; k < itens.length && !erro; k += 8) {
    const r = await Promise.all(itens.slice(k, k + 8).map(fazer));
    erro = r.find((x) => x) ?? null;
  }
  return erro;
}

/** Passa vários horários do padrão para um professor (ou deixa sem), de uma vez (decisões 68 e 69). */
export async function atribuirProfessor(estudioId: string, turmaIds: string[], professorId: string | null): Promise<Resposta> {
  if (!Array.isArray(turmaIds) || turmaIds.length === 0) return { ok: false, erro: "Nenhum horário escolhido." };
  if (turmaIds.length > 1000) return { ok: false, erro: "No máximo 1000 horários de uma vez." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("atribuir_professor_turmas", { p_estudio: estudioId, p_turmas: turmaIds, p_professor: professorId });
  if (!error) return { ok: true };
  if (!semFuncao(error)) return { ok: false, erro: doBanco(error.message, "Não foi possível salvar.") };
  // Sem a migração 41: um por vez, em paralelo.
  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, tipo, modalidade, dia_semana, inicio_min, duracao_min, vagas")
    .eq("estudio_id", estudioId)
    .eq("ativa", true)
    .is("avulsa", null)
    .in("id", turmaIds);
  const erro = await emParalelo(turmas ?? [], async (t) => {
    const { error: e } = await supabase.rpc("salvar_horario", {
      p_estudio: estudioId,
      p_turma: t.id,
      p_tipo: t.tipo,
      p_modalidade: t.modalidade,
      p_dia: t.dia_semana,
      p_inicio_min: t.inicio_min,
      p_duracao: t.duracao_min,
      p_vagas: t.vagas,
      p_professor: professorId,
    });
    return e ? doBanco(e.message, "Não foi possível salvar.") : null;
  });
  return erro ? { ok: false, erro } : { ok: true };
}

/** Remove de uma vez vários horários (decisões 67 e 69). */
export async function encerrarTurmas(turmaIds: string[]): Promise<Resposta> {
  if (!Array.isArray(turmaIds) || turmaIds.length === 0) return { ok: false, erro: "Nada para remover." };
  if (turmaIds.length > 1000) return { ok: false, erro: "Remova no máximo 1000 horários de uma vez." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_turmas", { p_turmas: turmaIds });
  if (!error) return { ok: true };
  if (!semFuncao(error)) return { ok: false, erro: doBanco(error.message, "Não foi possível remover.") };
  const erro = await emParalelo(turmaIds, async (id) => {
    const { error: e } = await supabase.rpc("encerrar_turma", { p_turma: id });
    return e ? doBanco(e.message, "Não foi possível remover.") : null;
  });
  return erro ? { ok: false, erro } : { ok: true };
}

export async function encerrarTurma(turmaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_turma", { p_turma: turmaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível encerrar a turma.") } : { ok: true };
}

/**
 * Lista colada de uma planilha: um aluno por linha, nome e (opcional) WhatsApp separados por
 * vírgula, ponto e vírgula ou tabulação. Devolve quantos entraram.
 */
export async function importarAlunos(estudioId: string, texto: string): Promise<{ ok: true; criados: number; linhas: number } | { ok: false; erro: string }> {
  const linhas = (typeof texto === "string" ? texto : "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length === 0) return { ok: false, erro: "Cole pelo menos um nome." };
  const lista = linhas.map((l) => {
    const [nome, ...resto] = l.split(/\t|;|,/).map((p) => p.trim());
    return { nome, whatsapp: resto.join(" ") };
  });
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("importar_alunos_estudio", { p_estudio: estudioId, p_lista: lista });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível cadastrar a lista.") } : { ok: true, criados: data as number, linhas: linhas.length };
}

export async function salvarTurmasDoAluno(alunoId: string, turmas: string[]): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_turmas_do_aluno", { p_aluno: alunoId, p_turmas: turmas });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar as turmas.") } : { ok: true };
}

export async function encerrarAlunoEstudio(alunoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_aluno_estudio", { p_aluno: alunoId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível encerrar o aluno.") } : { ok: true };
}

export async function fazerChamada(aulaId: string, marcas: { aluno: string; situacao: "presente" | "falta" }[]): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("fazer_chamada", { p_aula: aulaId, p_marcas: marcas });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar a chamada.") } : { ok: true };
}

export interface AulaNaAgendaDoEstudio {
  id: string;
  inicio: string;
  fim: string;
  turmaId: string;
  modalidade: string;
  vagas: number;
  alunos: number;
  professorId: string | null;
  chamadaEm: string | null;
  cancelada: boolean;
  tipo: TipoDeHorario;
  /** Aula extra (uma data só, não repete). */
  extra?: boolean;
}

/** Aulas de todas as turmas do estúdio entre dois instantes (ISO), para a agenda da coordenação. */
export async function aulasDoEstudio(estudioId: string, de: string, ate: string): Promise<AulaNaAgendaDoEstudio[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data: aulas }, { data: matriculas }] = await Promise.all([
    supabase
      .from("aulas_turma")
      .select("id, inicio, fim, turma_id, professor_id, chamada_em, situacao, turmas(modalidade, vagas, tipo, avulsa)")
      .eq("estudio_id", estudioId)
      .gte("inicio", de)
      .lt("inicio", ate)
      .order("inicio"),
    supabase.from("turma_alunos").select("turma_id, turmas!inner(estudio_id)").eq("turmas.estudio_id", estudioId),
  ]);
  const porTurma = new Map<string, number>();
  for (const m of matriculas ?? []) porTurma.set(m.turma_id, (porTurma.get(m.turma_id) ?? 0) + 1);
  // Quem vai de fato: os da turma, menos quem avisou falta, mais quem vem repor.
  const ajuste = new Map<string, number>();
  const ids = (aulas ?? []).map((a) => a.id);
  if (ids.length > 0 && ids.length <= 400) {
    const { data: presencas } = await supabase.from("presencas").select("aula_turma_id, situacao, origem").in("aula_turma_id", ids);
    for (const p of presencas ?? []) {
      const d = p.origem === "reposicao" ? (p.situacao === "falta_avisada" ? 0 : 1) : p.situacao === "falta_avisada" ? -1 : 0;
      if (d) ajuste.set(p.aula_turma_id, (ajuste.get(p.aula_turma_id) ?? 0) + d);
    }
  }
  return (aulas ?? []).map((a) => {
    const t = a.turmas as unknown as { modalidade: string; vagas: number | null; tipo: string; avulsa: string | null } | null;
    return {
      extra: t?.avulsa != null,
      tipo: (t?.tipo === "turno" ? "turno" : "turma") as TipoDeHorario,
      id: a.id,
      inicio: a.inicio,
      fim: a.fim,
      turmaId: a.turma_id,
      modalidade: t?.modalidade ?? "Turma",
      vagas: t?.vagas ?? 0,
      alunos: Math.max(0, (porTurma.get(a.turma_id) ?? 0) + (ajuste.get(a.id) ?? 0)),
      professorId: a.professor_id,
      chamadaEm: a.chamada_em,
      cancelada: a.situacao === "cancelada",
    };
  });
}

/** Dias e horários de funcionamento do estúdio (só a coordenação). */
export async function salvarFuncionamento(estudioId: string, f: Funcionamento): Promise<Resposta> {
  const problemas = problemasDoFuncionamento(f);
  if (problemas.length) return { ok: false, erro: problemas[0][0].toUpperCase() + problemas[0].slice(1) + "." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_funcionamento_estudio", { p_estudio: estudioId, p: funcionamentoParaBanco(f) });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o horário.") } : { ok: true };
}
