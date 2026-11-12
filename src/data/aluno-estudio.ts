"use server";

// Aluno do estúdio (decisão 61, migração 38): convite, agenda com vagas, falta e reposição.
// Leituras devolvem vazio se a migração ainda não foi rodada.

import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";
import type { Funcionamento } from "@/lib/funcionamento";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export interface EstudioDoAluno {
  id: string;
  nome: string;
  faltaH: number;
  marcarH: number;
  validadeDias: number;
  funcionamento: Funcionamento;
}

export interface AulaNaAgendaDoAluno {
  id: string;
  inicio: string;
  fim: string;
  modalidade: string;
  professor: string | null;
  vagas: number;
  ocupadas: number;
  /** "fixa": a turma é dele; "reposicao": marcou reposição nela. */
  minha: "fixa" | "reposicao" | null;
  aviseiFalta: boolean;
  cancelada: boolean;
}

export interface ReposicaoDoAluno {
  id: string;
  modalidade: string;
  validoAte: string;
}

export async function meusEstudiosComoAluno(): Promise<EstudioDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("meus_estudios_aluno");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((e) => {
    const funcionamento: Funcionamento = {};
    for (const f of (e.funcionamento as { dia: number; inicio_min: number; fim_min: number }[]) ?? [])
      funcionamento[f.dia] = { inicio: f.inicio_min, fim: f.fim_min };
    return {
      id: e.estudio_id as string,
      nome: e.nome as string,
      faltaH: Number(e.falta_h),
      marcarH: Number(e.marcar_h),
      validadeDias: Number(e.validade_dias),
      funcionamento,
    };
  });
}

/** Turmas do estúdio entre duas datas ("AAAA-MM-DD"), com ocupação e sem nomes de alunos. */
export async function agendaDoAlunoNoEstudio(estudioId: string, de: string, ate: string): Promise<AulaNaAgendaDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("agenda_aluno_estudio", { p_estudio: estudioId, p_de: de, p_ate: ate });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.aula_id as string,
    inicio: a.inicio as string,
    fim: a.fim as string,
    modalidade: a.modalidade as string,
    professor: (a.professor as string | null) || null,
    vagas: Number(a.vagas ?? 0),
    ocupadas: Number(a.ocupadas ?? 0),
    minha: a.minha === "fixa" || a.minha === "reposicao" ? a.minha : null,
    aviseiFalta: a.avisei_falta === true,
    cancelada: a.cancelada === true,
  }));
}

export async function minhasReposicoesNoEstudio(estudioId: string): Promise<ReposicaoDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("minhas_reposicoes_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { id: string; modalidade: string; valido_ate: string }[]).map((r) => ({
    id: r.id,
    modalidade: r.modalidade,
    validoAte: r.valido_ate,
  }));
}

/** Avisar a falta. Sem `alunoId`: o próprio aluno; com ele: o professor da aula ou a coordenação. */
export async function avisarFaltaNoEstudio(
  aulaId: string,
  alunoId?: string,
): Promise<{ ok: true; credito: boolean; fixo: boolean; prazoH: number } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("avisar_falta_estudio", { p_aula: aulaId, p_aluno: alunoId ?? null });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível avisar a falta.") };
  const r = data as { credito: boolean; fixo: boolean; prazo_h: number };
  return { ok: true, credito: r.credito, fixo: r.fixo, prazoH: r.prazo_h };
}

export async function desfazerFaltaNoEstudio(aulaId: string, alunoId?: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("desfazer_falta_estudio", { p_aula: aulaId, p_aluno: alunoId ?? null });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível desfazer.") } : { ok: true };
}

export async function marcarReposicaoNoEstudio(aulaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_reposicao_estudio", { p_aula: aulaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível marcar a reposição.") } : { ok: true };
}

// ─── Convite do aluno ───────────────────────────────────────────────────────

/** Link de convite para o aluno do estúdio entrar no app (só a coordenação). */
export async function gerarConviteDoAluno(estudioAlunoId: string): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("convite_aluno_estudio", { p_estudio_aluno: estudioAlunoId });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível criar o convite. Se continuar, avise a equipe do P-Bell.") };
  return { ok: true, link: `${await origemDoSite()}/estudio/aluno/${data}` };
}

export async function verConviteDoAluno(codigo: string): Promise<{ situacao: string; estudio?: string; aluno?: string }> {
  if (!/^[a-f0-9]{16,64}$/.test(codigo ?? "")) return { situacao: "inexistente" };
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ver_convite_aluno_estudio", { p_codigo: codigo });
  return (data as { situacao: string; estudio?: string; aluno?: string } | null) ?? { situacao: "inexistente" };
}

export async function aceitarConviteDoAluno(codigo: string): Promise<{ ok: true; estudio: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("aceitar_convite_aluno_estudio", { p_codigo: codigo });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível aceitar o convite.") };
  return { ok: true, estudio: data as string };
}

// ─── Regras (coordenação) ───────────────────────────────────────────────────

export async function salvarRegrasDosAlunos(estudioId: string, faltaH: number, marcarH: number, validadeDias: number): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_regras_alunos_estudio", {
    p_estudio: estudioId,
    p_falta_h: faltaH,
    p_marcar_h: marcarH,
    p_validade: validadeDias,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar as regras.") } : { ok: true };
}

/** Antecedência para marcar reposição (null: migração 38 ainda não rodada). */
export async function lerAntecedenciaParaMarcar(estudioId: string): Promise<number | null> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.from("estudios").select("antecedencia_marcar_h").eq("id", estudioId).maybeSingle();
  return error || !data ? null : data.antecedencia_marcar_h;
}

/** O treino de cada dia escrito pelo professor (decisão 73). Vazio se a migração 42 não rodou. */
export async function meuTreinoNoEstudio(estudioId: string): Promise<{ dia: number; texto: string }[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("meu_treino_no_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { dia_semana: number; texto: string }[]).map((t) => ({ dia: Number(t.dia_semana), texto: t.texto }));
}
