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
  modalidade: Matricula["modalidade"];
  intervalo_semanas: number;
  ciclo_meses: number;
  duracao_min: number;
  local: string | null;
  valor_centavos: number | null;
  valor_fora_do_padrao: boolean;
  dia_vencimento: number | null;
  inicio: string;
  fim: string | null;
  suspender_se_atrasar: boolean;
  matricula_horarios: { dia_semana: number; inicio_min: number }[];
}

const CAMPOS_MATRICULA =
  "id, vinculo_id, modalidade, intervalo_semanas, ciclo_meses, duracao_min, local, valor_centavos, valor_fora_do_padrao, dia_vencimento, inicio, fim, suspender_se_atrasar, matricula_horarios (dia_semana, inicio_min)";

const paraMatricula = (l: LinhaMatricula): Matricula => ({
  id: l.id,
  vinculoId: l.vinculo_id,
  modalidade: l.modalidade,
  intervaloSemanas: l.intervalo_semanas,
  cicloMeses: l.ciclo_meses as Matricula["cicloMeses"],
  horarios: l.matricula_horarios.map((h) => ({ dia: h.dia_semana, inicioMin: h.inicio_min })),
  duracao: l.duracao_min as Duracao,
  local: l.local,
  valorCentavos: l.valor_centavos,
  valorForaDoPadrao: l.valor_fora_do_padrao,
  diaVencimento: l.dia_vencimento,
  inicio: l.inicio,
  fim: l.fim,
  suspenderSeAtrasar: l.suspender_se_atrasar,
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

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /horário|duração|data|matrícula|aluno|meia-noite/i.test(m) ? m : padrao;
}

/**
 * Cria a matrícula ou altera a ativa. Ao alterar, os horários novos valem a partir
 * de agora: só as aulas futuras ainda agendadas são refeitas; o histórico fica como está.
 */
export async function salvarMatricula(vinculoId: string, dados: DadosMatricula): Promise<Resposta> {
  const problemas = problemasDaMatricula(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { error } = await supabase.rpc("salvar_matricula", {
    p_vinculo: vinculoId,
    p_dados: {
      modalidade: dados.modalidade,
      horarios: dados.modalidade === "online" ? [] : dados.horarios.map((h) => ({ dia: h.dia, inicio_min: h.inicioMin })),
      intervalo_semanas: dados.intervaloSemanas,
      duracao: dados.duracao,
      local: dados.local.trim(),
      ciclo_meses: dados.modalidade === "presencial" ? 1 : dados.cicloMeses,
      valor_fora_do_padrao: dados.valorForaDoPadrao,
      valor_centavos: dados.valorForaDoPadrao ? reaisParaCentavos(dados.valor) : null,
      dia_vencimento: dados.diaVencimento,
      inicio: dados.inicio,
      fim: dados.fim || null,
    },
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
  origem: string;
  vinculoId: string | null;
  nome: string;
  /** Pedido pendente: quem propôs o horário (o aluno pediu ou o personal sugeriu). */
  propostaPor: "aluno" | "personal" | null;
  /** Pedido de remarcação: a aula que seria trocada. */
  aulaOriginalId: string | null;
  /** Pedido recusado: o motivo. */
  resposta: string | null;
}

/** Aulas do personal logado entre dois instantes (ISO), com o nome de cada aluno. */
export async function listarAulas(de: string, ate: string): Promise<AulaDaAgenda[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("aulas")
      .select("id, inicio, fim, local, situacao, origem, vinculo_id, nome_avulso, proposta_por, aula_original_id, resposta")
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
    origem: a.origem,
    vinculoId: a.vinculo_id,
    nome: (a.vinculo_id && nomes.get(a.vinculo_id)) || a.nome_avulso || "Aluno",
    propostaPor: a.proposta_por as AulaDaAgenda["propostaPor"],
    aulaOriginalId: a.aula_original_id,
    resposta: a.resposta,
  }));
}

/** Próximas aulas do aluno logado com um personal (pelo vínculo). */
export async function proximasAulasDoAluno(vinculoId: string, quantas = 6): Promise<AulaDaAgenda[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("aulas")
    .select("id, inicio, fim, local, situacao, origem, vinculo_id, nome_avulso, proposta_por, aula_original_id, resposta")
    .eq("aluno_id", id)
    .eq("vinculo_id", vinculoId)
    .gt("inicio", new Date().toISOString())
    .in("situacao", ["agendada", "confirmada", "pendente"])
    .order("inicio")
    .limit(quantas);
  return (data ?? []).map((a) => ({
    id: a.id,
    inicio: a.inicio,
    fim: a.fim,
    local: a.local,
    situacao: a.situacao,
    origem: a.origem,
    vinculoId: a.vinculo_id,
    nome: "",
    propostaPor: a.proposta_por as AulaDaAgenda["propostaPor"],
    aulaOriginalId: a.aula_original_id,
    resposta: a.resposta,
  }));
}

/** Pedidos do aluno logado recusados (ou expirados) nos últimos 7 dias. */
export async function pedidosRecusadosDoAluno(vinculoId: string): Promise<{ id: string; inicio: string; resposta: string | null; origem: string }[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data } = await supabase
    .from("aulas")
    .select("id, inicio, resposta, origem")
    .eq("aluno_id", id)
    .eq("vinculo_id", vinculoId)
    .eq("situacao", "recusada")
    .gt("atualizada_em", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("atualizada_em", { ascending: false })
    .limit(5);
  return data ?? [];
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

/** Próxima aula marcada de cada aluno do personal logado, por vínculo. */
export async function proximaAulaPorAluno(): Promise<Record<string, { inicio: string; local: string | null }>> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return {};
  const { data } = await supabase
    .from("aulas")
    .select("vinculo_id, inicio, local")
    .eq("personal_id", id)
    .gt("inicio", new Date().toISOString())
    .in("situacao", ["agendada", "confirmada"])
    .order("inicio")
    .limit(1000);
  const proximas: Record<string, { inicio: string; local: string | null }> = {};
  for (const a of data ?? []) if (a.vinculo_id && !proximas[a.vinculo_id]) proximas[a.vinculo_id] = { inicio: a.inicio, local: a.local };
  return proximas;
}

export interface AlunoOnline {
  vinculoId: string;
  nome: string;
  modalidade: "online" | "hibrido";
  matricula: Matricula;
}

/** Alunos online e híbridos do personal logado (matrícula ativa). */
export async function listarAlunosOnline(): Promise<AlunoOnline[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("matriculas")
      .select(CAMPOS_MATRICULA)
      .eq("personal_id", id)
      .eq("situacao", "ativa")
      .in("modalidade", ["online", "hibrido"]),
    listarMeusAlunos(),
  ]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return ((data ?? []) as LinhaMatricula[])
    .map((l) => ({
      vinculoId: l.vinculo_id,
      nome: nomes.get(l.vinculo_id) ?? "Aluno",
      modalidade: l.modalidade as AlunoOnline["modalidade"],
      matricula: paraMatricula(l),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ─── Matrícula suspensa (mensalidade vencida sem pagamento) ───────────────

/** Matrículas suspensas que o usuário logado vê (personal ou aluno): vínculo → desde ("AAAA-MM-DD"). */
export async function matriculasSuspensas(): Promise<Record<string, string>> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("matriculas_suspensas");
  return Object.fromEntries(((data ?? []) as { vinculo_id: string; desde: string }[]).map((s) => [s.vinculo_id, s.desde]));
}

export async function definirSuspensaoAutomatica(vinculoId: string, ligada: boolean): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("definir_suspensao_automatica", { p_vinculo: vinculoId, p_ligada: ligada });
  return error ? { ok: false, erro: "Não foi possível mudar agora." } : { ok: true };
}
