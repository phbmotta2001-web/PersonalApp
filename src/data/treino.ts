"use server";

// Treino do aluno do personal, só por texto (decisão 81, migração 45).

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Exercicio, PontoDeTreino, RegistroDoExercicio, TreinoCompleto } from "@/lib/treino";
import type { Resposta } from "./conta";

/** Treino de cada dia (0 = domingo). Vazio se não houver ou se a migração 45 ainda não rodou. */
export async function treinoDoVinculo(vinculoId: string): Promise<Record<number, string>> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("treino_do_vinculo", { p_vinculo: vinculoId });
  if (error || !Array.isArray(data)) return {};
  return Object.fromEntries((data as { dia: number; texto: string }[]).map((t) => [t.dia, t.texto]));
}

export async function salvarTreinoDoVinculo(vinculoId: string, dia: number, texto: string): Promise<Resposta> {
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) return { ok: false, erro: "Escolha o dia." };
  if ((texto ?? "").length > 1000) return { ok: false, erro: "Até 1000 letras por dia." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_treino_vinculo", { p_vinculo: vinculoId, p_dia: dia, p_texto: texto ?? "" });
  if (!error) return { ok: true };
  return { ok: false, erro: /treino|dia|letras/i.test(error.message) && !/function|column/i.test(error.message) ? error.message : "Não foi possível salvar o treino." };
}

// ─── Treino com exercícios (decisão 114, migração 71) ────────────────────────────────────────

/** Foco de cada dia e exercícios. Vazio se não houver ou se a migração 71 ainda não rodou. */
export async function treinoCompleto(vinculoId: string): Promise<TreinoCompleto> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("treino_completo", { p_vinculo: vinculoId });
  const vazio: TreinoCompleto = { focos: {}, exercicios: {} };
  if (error || !data) return vazio;
  const d = data as {
    dias: { dia: number; foco: string | null }[];
    exercicios: { id: string; dia: number; nome: string; series: number | null; repeticoes: string | null; carga: number | string | null; descanso: number | null }[];
  };
  const t = vazio;
  for (const x of d.dias ?? []) t.focos[x.dia] = x.foco;
  for (const e of d.exercicios ?? []) {
    (t.exercicios[e.dia] ??= []).push({
      id: e.id,
      nome: e.nome,
      series: e.series,
      repeticoes: e.repeticoes,
      cargaKg: e.carga == null ? null : Number(e.carga),
      descansoSeg: e.descanso,
    });
  }
  return t;
}

export async function salvarTreinoDoDia(vinculoId: string, dia: number, foco: string, exercicios: Exercicio[]): Promise<Resposta> {
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) return { ok: false, erro: "Escolha o dia." };
  if (foco.trim().length > 120) return { ok: false, erro: "O que será trabalhado pode ter até 120 letras." };
  if (exercicios.length > 40) return { ok: false, erro: "Use no máximo 40 exercícios por dia." };
  if (exercicios.some((e) => !e.nome.trim())) return { ok: false, erro: "Escreva o nome de cada exercício." };
  if (exercicios.some((e) => e.cargaKg != null && (Number.isNaN(e.cargaKg) || e.cargaKg < 0 || e.cargaKg > 2000)))
    return { ok: false, erro: "Confira as cargas." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_treino_do_dia", {
    p_vinculo: vinculoId,
    p_dia: dia,
    p_foco: foco,
    p_exercicios: exercicios.map((e) => ({
      id: e.id ?? null,
      nome: e.nome.trim().slice(0, 80),
      series: e.series,
      repeticoes: e.repeticoes?.trim().slice(0, 20) || null,
      carga: e.cargaKg,
      descanso: e.descansoSeg,
    })),
  });
  if (!error) return { ok: true };
  return { ok: false, erro: /function|column|schema|relation/i.test(error.message) ? "Não foi possível salvar o treino." : error.message };
}

/** O que já foi marcado na aula (vazio se não for aula do usuário). */
export async function registrosDaAula(aulaId: string): Promise<RegistroDoExercicio[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("registros_da_aula", { p_aula: aulaId });
  if (error || !Array.isArray(data)) return [];
  return (data as { exercicio: string; feito: boolean; carga: number | string | null; repeticoes: number | null }[])
    .filter((r) => r.exercicio)
    .map((r) => ({ exercicioId: r.exercicio, feito: r.feito, cargaKg: r.carga == null ? null : Number(r.carga), repeticoes: r.repeticoes }));
}

export async function registrarExercicio(
  aulaId: string,
  exercicioId: string,
  feito: boolean,
  cargaKg: number | null,
  repeticoes: number | null,
): Promise<Resposta> {
  if (cargaKg != null && (Number.isNaN(cargaKg) || cargaKg < 0 || cargaKg > 2000)) return { ok: false, erro: "Confira a carga." };
  if (repeticoes != null && (!Number.isInteger(repeticoes) || repeticoes < 0 || repeticoes > 500)) return { ok: false, erro: "Confira as repetições." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("registrar_exercicio", {
    p_aula: aulaId,
    p_exercicio: exercicioId,
    p_feito: feito,
    p_carga: cargaKg,
    p_repeticoes: repeticoes,
  });
  if (!error) return { ok: true };
  return { ok: false, erro: /function|column|schema|relation/i.test(error.message) ? "Não foi possível registrar." : error.message };
}

/** Exercícios feitos nas aulas, do mais antigo ao mais novo. */
export async function evolucaoDoTreino(vinculoId: string): Promise<PontoDeTreino[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("evolucao_do_treino", { p_vinculo: vinculoId });
  if (error || !Array.isArray(data)) return [];
  return (data as { exercicio: string | null; nome: string; data: string; carga: number | string | null; repeticoes: number | null }[]).map((p) => ({
    exercicioId: p.exercicio,
    nome: p.nome,
    data: p.data,
    cargaKg: p.carga == null ? null : Number(p.carga),
    repeticoes: p.repeticoes,
  }));
}
