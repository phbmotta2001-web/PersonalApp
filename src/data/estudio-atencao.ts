"use server";

// Decisão 101: alunos que precisam de atenção (reposição vencendo, faltando seguido) e o resumo
// do mês, para a coordenação. Quem confere se é a coordenação são as funções do banco.

import { usuarioAtual } from "@/lib/supabase/servidor";

export interface AlunoEmAtencao {
  id: string;
  nome: string;
  whatsapp: string | null;
  comApp: boolean;
  /** "sumindo": faltou às últimas aulas; "reposicao": tem reposição vencendo. */
  tipo: "sumindo" | "reposicao";
  /** Faltas seguidas, ou quantas reposições vencem. */
  quantidade: number;
  /** Até quando vale a reposição que vence primeiro ("AAAA-MM-DD"). */
  ate: string | null;
}

export async function alunosEmAtencao(estudioId: string): Promise<AlunoEmAtencao[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("atencao_alunos_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { estudio_aluno_id: string; nome: string; whatsapp: string | null; com_app: boolean; tipo: string; quantidade: number; ate: string | null }[]).map(
    (x) => ({
      id: x.estudio_aluno_id,
      nome: x.nome,
      whatsapp: x.whatsapp,
      comApp: x.com_app,
      tipo: x.tipo === "sumindo" ? "sumindo" : "reposicao",
      quantidade: Number(x.quantidade),
      ate: x.ate,
    }),
  );
}

export interface ResumoDoMes {
  novos: number;
  saidas: number;
  ativos: number;
  experimentais: number;
  matricularam: number;
  recebidoCentavos: number;
  atrasadas: number;
  atrasadoCentavos: number;
  presencas: number;
  faltas: number;
  reposicoesVencidas: number;
}

/** Resumo do mês ("AAAA-MM"). Nulo se o banco ainda não tem a migração 63. */
export async function resumoDoMes(estudioId: string, mes: string): Promise<ResumoDoMes | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}$/.test(mes)) return null;
  const { data, error } = await supabase.rpc("resumo_mes_estudio", { p_estudio: estudioId, p_mes: `${mes}-01` });
  if (error || !data) return null;
  const r = data as Record<string, number | string>;
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    novos: n("novos"),
    saidas: n("saidas"),
    ativos: n("ativos"),
    experimentais: n("experimentais"),
    matricularam: n("matricularam"),
    recebidoCentavos: n("recebido_centavos"),
    atrasadas: n("atrasadas"),
    atrasadoCentavos: n("atrasado_centavos"),
    presencas: n("presencas"),
    faltas: n("faltas"),
    reposicoesVencidas: n("reposicoes_vencidas"),
  };
}
