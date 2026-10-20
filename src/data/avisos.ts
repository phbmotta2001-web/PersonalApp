"use server";

// Avisos para o personal: o que os alunos fizeram pelo app (Fase 1, etapa 6).

import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import { listarMeusAlunos } from "./convites";

export type TipoAviso =
  | "cancelou_com_reposicao"
  | "cancelou_em_cima"
  | "marcou_reposicao"
  | "remarcou"
  | "pediu_reposicao"
  | "pediu_remarcacao"
  | "aceitou_sugestao"
  | "recusou_sugestao"
  | "avisou_pagamento"
  | "respondeu_checkin";

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  nome: string;
  vinculoId: string | null;
  /** Início (ISO) da aula atingida e da aula nova, quando houver. */
  aula: { id: string; inicio: string } | null;
  aulaNova: { id: string; inicio: string } | null;
  /** Aviso de pagamento: a cobrança. */
  cobrancaId: string | null;
  /** Questionário respondido. */
  checkinId: string | null;
  criadoEm: string;
  lido: boolean;
}

export async function contarAvisosNaoLidos(): Promise<number> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return 0;
  const { count } = await supabase
    .from("avisos")
    .select("id", { count: "exact", head: true })
    .eq("personal_id", id)
    .is("lido_em", null);
  return count ?? 0;
}

/** Os 50 avisos mais recentes do personal logado. */
export async function listarAvisos(): Promise<Aviso[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("avisos")
      .select("id, tipo, vinculo_id, criado_em, lido_em, aula_id, aula_nova_id, cobranca_id, checkin_id")
      .eq("personal_id", id)
      .order("criado_em", { ascending: false })
      .limit(50),
    listarMeusAlunos(),
  ]);
  const linhas = data ?? [];
  const ids = [...new Set(linhas.flatMap((a) => [a.aula_id, a.aula_nova_id]).filter((x): x is string => !!x))];
  const { data: aulas } = ids.length
    ? await supabase.from("aulas").select("id, inicio").in("id", ids)
    : { data: [] as { id: string; inicio: string }[] };
  const inicios = new Map((aulas ?? []).map((a) => [a.id, a.inicio]));
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  const aula = (aulaId: string | null) => (aulaId && inicios.has(aulaId) ? { id: aulaId, inicio: inicios.get(aulaId)! } : null);
  return linhas.map((a) => ({
    id: a.id,
    tipo: a.tipo as TipoAviso,
    nome: (a.vinculo_id && nomes.get(a.vinculo_id)) || "Aluno",
    vinculoId: a.vinculo_id,
    aula: aula(a.aula_id),
    aulaNova: aula(a.aula_nova_id),
    cobrancaId: a.cobranca_id,
    checkinId: a.checkin_id,
    criadoEm: a.criado_em,
    lido: a.lido_em != null,
  }));
}

export async function marcarAvisosLidos(): Promise<void> {
  const supabase = await criarClienteSupabase();
  await supabase.rpc("marcar_avisos_lidos");
}
