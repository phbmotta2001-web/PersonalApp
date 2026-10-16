"use server";

// O dia a dia das aulas (Fase 1, etapa 5). Roda só no servidor.
// Gravar passa pelas funções do banco (marcar_aula, remarcar_aula, criar_aula,
// salvar_regras), que conferem quem está logado e impedem choque de horário.

import { SITUACOES_QUE_OCUPAM, type OrigemAula, type SituacaoAula } from "@/lib/aula";
import { agoraEmBrasilia, horariosLivres, instante, somarDias, type Duracao } from "@/lib/expediente";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import { listarMeusAlunos } from "./convites";
import { lerExpediente, listarBloqueios } from "./expediente";

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  return /aula|horário|reposição|aluno|cancelou|duração|antecedência|nome|local|situação/i.test(m) ? m : padrao;
}

export interface DetalheDaAula {
  id: string;
  inicio: string;
  fim: string;
  local: string | null;
  situacao: SituacaoAula;
  origem: OrigemAula;
  canceladaPor: "aluno" | "personal" | null;
  vinculoId: string | null;
  nome: string;
  /** Aula que foi remarcada para esta, e para qual aula esta foi remarcada. */
  remarcadaDe: { id: string; inicio: string } | null;
  remarcadaPara: { id: string; inicio: string } | null;
}

const CAMPOS_AULA = "id, inicio, fim, local, situacao, origem, cancelada_por, vinculo_id, nome_avulso, aula_original_id";

interface LinhaAula {
  id: string;
  inicio: string;
  fim: string;
  local: string | null;
  situacao: string;
  origem: string;
  cancelada_por: string | null;
  vinculo_id: string | null;
  nome_avulso: string | null;
  aula_original_id: string | null;
}

/** Uma aula do personal logado, com o nome do aluno e as remarcações ligadas a ela. */
export async function lerAula(aulaId: string): Promise<DetalheDaAula | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data } = await supabase.from("aulas").select(CAMPOS_AULA).eq("id", aulaId).eq("personal_id", id).maybeSingle();
  if (!data) return null;
  const a = data as LinhaAula;
  const [alunos, original, nova] = await Promise.all([
    listarMeusAlunos(),
    a.aula_original_id
      ? supabase.from("aulas").select("id, inicio").eq("id", a.aula_original_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("aulas").select("id, inicio").eq("aula_original_id", a.id).maybeSingle(),
  ]);
  return {
    id: a.id,
    inicio: a.inicio,
    fim: a.fim,
    local: a.local,
    situacao: a.situacao as SituacaoAula,
    origem: a.origem as OrigemAula,
    canceladaPor: a.cancelada_por as DetalheDaAula["canceladaPor"],
    vinculoId: a.vinculo_id,
    nome: (a.vinculo_id && alunos.find((x) => x.vinculoId === a.vinculo_id)?.nome) || a.nome_avulso || "Aluno",
    remarcadaDe: original.data ?? null,
    remarcadaPara: nova.data ?? null,
  };
}

export async function marcarAula(
  aulaId: string,
  situacao: "agendada" | "realizada" | "falta" | "cancelada_com_aviso" | "cancelada_em_cima",
  canceladaPor?: "aluno" | "personal",
): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_aula", {
    p_aula: aulaId,
    p_situacao: situacao,
    p_cancelada_por: canceladaPor ?? null,
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível salvar. Tente de novo.") } : { ok: true };
}

export async function remarcarAula(
  aulaId: string,
  data: string,
  inicioMin: number,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data: nova, error } = await supabase.rpc("remarcar_aula", { p_aula: aulaId, p_data: data, p_inicio_min: inicioMin });
  return error || !nova
    ? { ok: false, erro: erroDoBanco(error?.message, "Não foi possível remarcar. Tente de novo.") }
    : { ok: true, id: nova as string };
}

export interface NovaAula {
  /** Aluno (vínculo); vazio só na experimental de quem não é aluno. */
  vinculoId: string | null;
  nome: string;
  origem: "avulsa" | "reposicao" | "experimental";
  data: string;
  inicioMin: number;
  duracao: Duracao;
  local: string;
}

export async function criarAula(nova: NovaAula): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("criar_aula", {
    p_vinculo: nova.vinculoId,
    p_nome: nova.nome.trim(),
    p_origem: nova.origem,
    p_data: nova.data,
    p_inicio_min: nova.inicioMin,
    p_duracao: nova.duracao,
    p_local: nova.local.trim(),
  });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível marcar a aula. Tente de novo.") } : { ok: true };
}

/**
 * Horários livres do personal logado num dia, cortados no tamanho `duracao`
 * (descontando aulas e bloqueios). `ignorar` = aula que está sendo remarcada.
 */
export async function livresNoDia(data: string, duracao: number, ignorar?: string): Promise<number[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return [];
  const [expediente, bloqueios, { data: aulas }] = await Promise.all([
    lerExpediente(),
    listarBloqueios(),
    supabase
      .from("aulas")
      .select("id, inicio, fim, situacao")
      .eq("personal_id", id)
      .lt("inicio", instante(somarDias(data, 1), 0).toISOString())
      .gt("fim", instante(data, 0).toISOString()),
  ]);
  const ocupando = (aulas ?? []).filter(
    (a) => a.id !== ignorar && SITUACOES_QUE_OCUPAM.includes(a.situacao as SituacaoAula),
  );
  return horariosLivres(expediente?.faixas ?? [], bloqueios, duracao, 1, new Date(), ocupando, data)[0]?.livres ?? [];
}

// ─── Reposições ────────────────────────────────────────────────────────────

export interface Reposicao {
  id: string;
  validoAte: string;
}

/** Reposições ainda não usadas e dentro da validade (do vínculo, para o personal ou o aluno). */
export async function reposicoesDisponiveis(vinculoId: string): Promise<Reposicao[]> {
  const supabase = await criarClienteSupabase();
  const hoje = agoraEmBrasilia().data;
  const { data } = await supabase
    .from("creditos_reposicao")
    .select("id, valido_ate")
    .eq("vinculo_id", vinculoId)
    .is("usado_em_aula_id", null)
    .gte("valido_ate", hoje)
    .order("valido_ate");
  return (data ?? []).map((c) => ({ id: c.id, validoAte: c.valido_ate }));
}

/** Reposições disponíveis de todos os alunos do personal, por vínculo. */
export async function reposicoesPorAluno(): Promise<Record<string, Reposicao[]>> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return {};
  const hoje = agoraEmBrasilia().data;
  const { data } = await supabase
    .from("creditos_reposicao")
    .select("id, valido_ate, vinculo_id")
    .eq("personal_id", id)
    .is("usado_em_aula_id", null)
    .gte("valido_ate", hoje)
    .order("valido_ate");
  const r: Record<string, Reposicao[]> = {};
  for (const c of data ?? []) (r[c.vinculo_id] ??= []).push({ id: c.id, validoAte: c.valido_ate });
  return r;
}

/** Aulas do aluno no mês corrente (para o resumo da ficha). */
export async function aulasDoMes(vinculoId: string): Promise<{ situacao: string; fim: string; origem: string }[]> {
  const supabase = await criarClienteSupabase();
  const hoje = agoraEmBrasilia().data;
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const [a, m] = hoje.split("-").map(Number);
  const proximoMes = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const { data } = await supabase
    .from("aulas")
    .select("situacao, fim, origem")
    .eq("vinculo_id", vinculoId)
    .gte("inicio", instante(inicioMes, 0).toISOString())
    .lt("inicio", instante(proximoMes, 0).toISOString());
  return data ?? [];
}

// ─── Regras ────────────────────────────────────────────────────────────────

/** Antecedência mínima (em horas) para o aluno cancelar e ganhar reposição. */
export async function lerAntecedencia(): Promise<number> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return 12;
  const { data } = await supabase.from("personais").select("antecedencia_cancelamento_h").eq("id", id).maybeSingle();
  return data?.antecedencia_cancelamento_h ?? 12;
}

export async function salvarAntecedencia(horas: number): Promise<Resposta> {
  if (!Number.isInteger(horas) || horas < 0 || horas > 168) return { ok: false, erro: "Escolha de 0 a 168 horas." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_regras", { p_antecedencia_h: horas });
  return error ? { ok: false, erro: "Não foi possível salvar. Tente de novo." } : { ok: true };
}
