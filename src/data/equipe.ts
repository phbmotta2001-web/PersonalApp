"use server";

// Painel da beta, só para quem está na tabela "equipe" (função public.painel_beta).
// Traz contagens e datas por personal; nada de dados de saúde ou de alunos.

import { usuarioAtual } from "@/lib/supabase/servidor";

export interface PersonalNoPainel {
  nome: string;
  email: string;
  whatsapp: string;
  criadoEm: string;
  configurado: boolean;
  ultimoAcesso: string | null;
  alunosAtivos: number;
  alunosComApp: number;
  convitesPendentes: number;
  aulas7Dias: number;
  aulasProximos7Dias: number;
  cobrancasPagas30Dias: number;
}

export interface PainelBeta {
  totais: {
    personais: number;
    personaisConfigurados: number;
    alunosComConta: number;
    alunosAtivos: number;
    alunosSemApp: number;
    convitesPendentes: number;
    aulas7Dias: number;
    cobrancasPagas30Dias: number;
    entraram7Dias: number;
  };
  personais: PersonalNoPainel[];
}

/** Quem está logado é da equipe do P-Bell (conta de administração)? */
export async function souDaEquipe(): Promise<boolean> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return false;
  const { data } = await supabase.rpc("sou_da_equipe");
  return data === true;
}

/** null: ninguém logado ou quem está logado não é da equipe. */
export async function lerPainelBeta(): Promise<PainelBeta | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;
  const { data, error } = await supabase.rpc("painel_beta");
  if (error || !data) return null;
  const t = data.totais;
  return {
    totais: {
      personais: t.personais,
      personaisConfigurados: t.personais_configurados,
      alunosComConta: t.alunos_com_conta,
      alunosAtivos: t.alunos_ativos,
      alunosSemApp: t.alunos_sem_app,
      convitesPendentes: t.convites_pendentes,
      aulas7Dias: t.aulas_7_dias,
      cobrancasPagas30Dias: t.cobrancas_pagas_30_dias,
      entraram7Dias: t.entraram_7_dias,
    },
    personais: (data.personais as Record<string, never>[]).map((p) => ({
      nome: p.nome,
      email: p.email,
      whatsapp: p.whatsapp,
      criadoEm: p.criado_em,
      configurado: p.configurado,
      ultimoAcesso: p.ultimo_acesso,
      alunosAtivos: p.alunos_ativos,
      alunosComApp: p.alunos_com_app,
      convitesPendentes: p.convites_pendentes,
      aulas7Dias: p.aulas_7_dias,
      aulasProximos7Dias: p.aulas_proximos_7_dias,
      cobrancasPagas30Dias: p.cobrancas_pagas_30_dias,
    })),
  };
}
