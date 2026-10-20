"use server";

// Questionários de acompanhamento (alunos online e híbridos). Roda só no servidor.
// As regras ficam no banco (salvar_questionario, salvar_programacao, gerar_checkins,
// responder_checkin…), que conferem quem está logado.

import { frase } from "@/lib/formato";
import {
  limparPerguntas,
  problemasDoQuestionario,
  type Frequencia,
  type Pergunta,
  type Programacao,
  type Respostas,
} from "@/lib/questionario";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import { listarMeusAlunos } from "./convites";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /questionário|pergunta|responda|resposta|aluno|frequência|programação|início|nome/i.test(m) ? m : padrao;
}

export interface Questionario {
  id: string;
  nome: string;
  perguntas: Pergunta[];
}

export interface Checkin {
  id: string;
  vinculoId: string;
  titulo: string;
  perguntas: Pergunta[];
  disponivelEm: string;
  enviadoEm: string | null;
  respondidoEm: string | null;
  respostas: Respostas | null;
}

const CAMPOS_CHECKIN = "id, vinculo_id, titulo, perguntas, disponivel_em, enviado_em, respondido_em, respostas";
type LinhaCheckin = {
  id: string;
  vinculo_id: string;
  titulo: string;
  perguntas: Pergunta[];
  disponivel_em: string;
  enviado_em: string | null;
  respondido_em: string | null;
  respostas: Respostas | null;
};
const paraCheckin = (l: LinhaCheckin): Checkin => ({
  id: l.id,
  vinculoId: l.vinculo_id,
  titulo: l.titulo,
  perguntas: l.perguntas,
  disponivelEm: l.disponivel_em,
  enviadoEm: l.enviado_em,
  respondidoEm: l.respondido_em,
  respostas: l.respostas,
});

// ─── Modelos ───────────────────────────────────────────────────────────────

/** Modelos do personal logado. Na primeira vez, cria o "Check-in semanal" pronto. */
export async function listarQuestionarios(): Promise<Questionario[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const consulta = () =>
    supabase.from("questionarios").select("id, nome, perguntas").eq("personal_id", id).eq("arquivado", false).order("criado_em");
  let { data } = await consulta();
  if (!data?.length) {
    await supabase.rpc("criar_questionario_padrao");
    ({ data } = await consulta());
  }
  return (data ?? []).map((q) => ({ id: q.id, nome: q.nome, perguntas: q.perguntas as Pergunta[] }));
}

export async function lerQuestionario(questionarioId: string): Promise<Questionario | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data } = await supabase
    .from("questionarios")
    .select("id, nome, perguntas")
    .eq("id", questionarioId)
    .eq("personal_id", id)
    .maybeSingle();
  return data ? { id: data.id, nome: data.nome, perguntas: data.perguntas as Pergunta[] } : null;
}

export async function salvarQuestionario(
  questionarioId: string | null,
  nome: string,
  perguntas: Pergunta[],
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const limpas = limparPerguntas(perguntas);
  const problemas = problemasDoQuestionario(nome, limpas);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("salvar_questionario", {
    p_id: questionarioId,
    p_nome: nome.trim(),
    p_perguntas: limpas,
  });
  return error || !data
    ? { ok: false, erro: erroDoBanco(error?.message, "Não foi possível salvar o questionário.") }
    : { ok: true, id: data as string };
}

export async function arquivarQuestionario(questionarioId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("arquivar_questionario", { p_id: questionarioId });
  return error ? { ok: false, erro: "Não foi possível apagar o questionário." } : { ok: true };
}

// ─── Programação por aluno ─────────────────────────────────────────────────

export async function listarProgramacoes(vinculoId: string): Promise<Programacao[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("programacoes_questionario")
    .select("id, questionario_id, frequencia, dia_semana, dia_mes, hora_min, inicio, ativa, questionarios (nome)")
    .eq("personal_id", id)
    .eq("vinculo_id", vinculoId)
    .order("criada_em");
  return (data ?? []).map((p) => ({
    id: p.id,
    questionarioId: p.questionario_id,
    nomeQuestionario: (p.questionarios as unknown as { nome: string } | null)?.nome ?? "Questionário",
    frequencia: p.frequencia as Frequencia,
    diaSemana: p.dia_semana,
    diaMes: p.dia_mes,
    horaMin: p.hora_min,
    inicio: p.inicio,
    ativa: p.ativa,
  }));
}

export interface NovaProgramacao {
  id: string | null;
  questionarioId: string;
  frequencia: Frequencia;
  diaSemana: number;
  diaMes: number;
  horaMin: number;
  inicio: string;
  ativa: boolean;
}

export async function salvarProgramacao(vinculoId: string, p: NovaProgramacao): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_programacao", {
    p_id: p.id,
    p_questionario: p.questionarioId,
    p_vinculo: vinculoId,
    p_frequencia: p.frequencia,
    p_dia_semana: p.diaSemana,
    p_dia_mes: p.diaMes,
    p_hora_min: p.horaMin,
    p_inicio: p.inicio,
    p_ativa: p.ativa,
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível salvar a programação.") } : { ok: true };
}

export async function excluirProgramacao(programacaoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("excluir_programacao", { p_id: programacaoId });
  return error ? { ok: false, erro: "Não foi possível apagar a programação." } : { ok: true };
}

export async function enviarQuestionarioAgora(questionarioId: string, vinculoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("enviar_questionario_agora", { p_questionario: questionarioId, p_vinculo: vinculoId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível enviar agora.") } : { ok: true };
}

export async function marcarCheckinEnviado(checkinId: string): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.rpc("marcar_checkin_enviado", { p_checkin: checkinId });
}

// ─── Check-ins (personal) ──────────────────────────────────────────────────

/** Check-ins de um aluno, do mais novo para o mais antigo. */
export async function listarCheckins(vinculoId: string, quantos = 20): Promise<Checkin[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("checkins")
    .select(CAMPOS_CHECKIN)
    .eq("personal_id", id)
    .eq("vinculo_id", vinculoId)
    .order("disponivel_em", { ascending: false })
    .limit(quantos);
  return ((data ?? []) as LinhaCheckin[]).map(paraCheckin);
}

export type CheckinComAluno = Checkin & { nome: string; whatsapp: string | null };

/** Os check-ins mais recentes de todos os alunos do personal (para a lista de alunos online). */
export async function checkinsRecentes(): Promise<CheckinComAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("checkins")
      .select(CAMPOS_CHECKIN)
      .eq("personal_id", id)
      .gt("disponivel_em", new Date(Date.now() - 45 * 86_400_000).toISOString())
      .order("disponivel_em", { ascending: false })
      .limit(300),
    listarMeusAlunos(),
  ]);
  const porVinculo = new Map(alunos.map((a) => [a.vinculoId, a]));
  return ((data ?? []) as LinhaCheckin[]).map((l) => ({
    ...paraCheckin(l),
    nome: porVinculo.get(l.vinculo_id)?.nome ?? "Aluno",
    whatsapp: porVinculo.get(l.vinculo_id)?.whatsapp ?? null,
  }));
}

// ─── Aluno ─────────────────────────────────────────────────────────────────

/** Questionários pendentes do aluno logado com um personal. */
export async function checkinsPendentesDoAluno(vinculoId: string): Promise<Checkin[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("checkins")
    .select(CAMPOS_CHECKIN)
    .eq("aluno_id", id)
    .eq("vinculo_id", vinculoId)
    .is("respondido_em", null)
    .order("disponivel_em", { ascending: false });
  return ((data ?? []) as LinhaCheckin[]).map(paraCheckin);
}

/** Um questionário do aluno logado. */
export async function lerCheckinDoAluno(checkinId: string): Promise<Checkin | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data } = await supabase.from("checkins").select(CAMPOS_CHECKIN).eq("id", checkinId).eq("aluno_id", id).maybeSingle();
  return data ? paraCheckin(data as LinhaCheckin) : null;
}

export async function responderCheckin(checkinId: string, respostas: Respostas): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("responder_checkin", { p_checkin: checkinId, p_respostas: respostas });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível enviar as respostas. Tente de novo.") } : { ok: true };
}
