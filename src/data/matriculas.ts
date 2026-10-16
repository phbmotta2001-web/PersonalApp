"use server";

// Matrículas e aulas (Fase 1, etapa 3). Roda só no servidor.
// Gravar passa sempre pelas funções do banco (salvar_matricula, encerrar_matricula),
// que conferem quem está logado e impedem dois alunos no mesmo horário.
// Ler usa a segurança por linha: cada um só vê as próprias matrículas e aulas.

import type { Duracao } from "@/lib/expediente";
import { frase } from "@/lib/formato";
import {
  problemasDaMatricula,
  reaisParaCentavos,
  type DadosMatricula,
  type HorarioOcupado,
  type Matricula,
} from "@/lib/matricula";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import { listarMeusAlunos } from "./convites";

interface LinhaMatricula {
  id: string;
  vinculo_id: string;
  duracao_min: number;
  local: string | null;
  valor_centavos: number | null;
  valor_fora_do_padrao: boolean;
  dia_vencimento: number | null;
  inicio: string;
  fim: string | null;
  matricula_horarios: { dia_semana: number; inicio_min: number }[];
}

const CAMPOS_MATRICULA =
  "id, vinculo_id, duracao_min, local, valor_centavos, valor_fora_do_padrao, dia_vencimento, inicio, fim, matricula_horarios (dia_semana, inicio_min)";

const paraMatricula = (l: LinhaMatricula): Matricula => ({
  id: l.id,
  vinculoId: l.vinculo_id,
  horarios: l.matricula_horarios.map((h) => ({ dia: h.dia_semana, inicioMin: h.inicio_min })),
  duracao: l.duracao_min as Duracao,
  local: l.local,
  valorCentavos: l.valor_centavos,
  valorForaDoPadrao: l.valor_fora_do_padrao,
  diaVencimento: l.dia_vencimento,
  inicio: l.inicio,
  fim: l.fim,
});

/** Matrícula ativa de um vínculo (personal ou aluno daquele vínculo). */
export async function lerMatricula(vinculoId: string): Promise<Matricula | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase
    .from("matriculas")
    .select(CAMPOS_MATRICULA)
    .eq("vinculo_id", vinculoId)
    .eq("situacao", "ativa")
    .maybeSingle();
  return data ? paraMatricula(data as LinhaMatricula) : null;
}

/** Horários fixos dos OUTROS alunos do personal logado (para avisar antes de salvar). */
export async function horariosOcupados(excetoVinculo: string): Promise<HorarioOcupado[]> {
  const supabase = await criarClienteSupabase();
  const [{ data }, alunos] = await Promise.all([
    supabase.from("matriculas").select(CAMPOS_MATRICULA).eq("situacao", "ativa").neq("vinculo_id", excetoVinculo),
    listarMeusAlunos(),
  ]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return ((data ?? []) as LinhaMatricula[]).flatMap((l) =>
    l.matricula_horarios.map((h) => ({
      dia: h.dia_semana,
      inicioMin: h.inicio_min,
      duracao: l.duracao_min,
      nome: nomes.get(l.vinculo_id) ?? "outro aluno",
    })),
  );
}

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  return /horário|duração|data|matrícula|aluno|meia-noite/i.test(m) ? m : padrao;
}

/**
 * Cria a matrícula ou altera a ativa. Ao alterar, os horários novos valem a partir
 * de `aPartir` ("AAAA-MM-DD"); as aulas anteriores ficam como estão.
 */
export async function salvarMatricula(vinculoId: string, dados: DadosMatricula, aPartir?: string): Promise<Resposta> {
  const problemas = problemasDaMatricula(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { error } = await supabase.rpc("salvar_matricula", {
    p_vinculo: vinculoId,
    p_horarios: dados.horarios.map((h) => ({ dia: h.dia, inicio_min: h.inicioMin })),
    p_duracao: dados.duracao,
    p_local: dados.local.trim(),
    p_valor_fora_do_padrao: dados.valorForaDoPadrao,
    p_valor_centavos: dados.valorForaDoPadrao ? reaisParaCentavos(dados.valor) : null,
    p_dia_vencimento: dados.diaVencimento,
    p_inicio: dados.inicio,
    p_fim: dados.fim || null,
    p_a_partir: aPartir || null,
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível salvar a matrícula.") } : { ok: true };
}

export async function encerrarMatricula(matriculaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_matricula", { p_matricula: matriculaId });
  return error ? { ok: false, erro: "Não foi possível encerrar a matrícula." } : { ok: true };
}

// ─── Aulas ─────────────────────────────────────────────────────────────────

export interface AulaDaAgenda {
  id: string;
  /** ISO */
  inicio: string;
  fim: string;
  local: string | null;
  situacao: string;
  vinculoId: string | null;
  nome: string;
}

/** Aulas do personal logado entre dois instantes (ISO), com o nome de cada aluno. */
export async function listarAulas(de: string, ate: string): Promise<AulaDaAgenda[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("aulas")
      .select("id, inicio, fim, local, situacao, vinculo_id")
      .eq("personal_id", id)
      .lt("inicio", ate)
      .gt("fim", de)
      .order("inicio"),
    listarMeusAlunos(),
  ]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return (data ?? []).map((a) => ({
    id: a.id,
    inicio: a.inicio,
    fim: a.fim,
    local: a.local,
    situacao: a.situacao,
    vinculoId: a.vinculo_id,
    nome: (a.vinculo_id && nomes.get(a.vinculo_id)) || "Aluno",
  }));
}

/** Próximas aulas do aluno logado com um personal (pelo vínculo). */
export async function proximasAulasDoAluno(vinculoId: string, quantas = 6): Promise<AulaDaAgenda[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("aulas")
    .select("id, inicio, fim, local, situacao, vinculo_id")
    .eq("aluno_id", id)
    .eq("vinculo_id", vinculoId)
    .gt("inicio", new Date().toISOString())
    .in("situacao", ["agendada", "confirmada"])
    .order("inicio")
    .limit(quantas);
  return (data ?? []).map((a) => ({
    id: a.id,
    inicio: a.inicio,
    fim: a.fim,
    local: a.local,
    situacao: a.situacao,
    vinculoId: a.vinculo_id,
    nome: "",
  }));
}

/** Quantas aulas marcadas caem num período (para avisar ao criar um bloqueio). */
export async function contarAulasNoPeriodo(inicio: string, fim: string): Promise<number> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return 0;
  const { count } = await supabase
    .from("aulas")
    .select("id", { count: "exact", head: true })
    .eq("personal_id", id)
    .in("situacao", ["agendada", "confirmada"])
    .lt("inicio", fim)
    .gt("fim", inicio);
  return count ?? 0;
}
