"use server";

// Treino do aluno do personal, só por texto (decisão 81, migração 45).

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import type { Exercicio, MedidaDaSerie, PontoDeTreino, SerieFeita, TreinoCompleto, TreinoDaAula, Unidade } from "@/lib/treino";
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

// ─── Treino com exercícios (decisões 114 e 117, migrações 71 e 74) ───────────────────────────

const unidade = (u: unknown): Unidade => (u === "lb" || u === "placas" ? u : "kg");
const medida = (m: unknown): MedidaDaSerie => (m === "segundos" ? "segundos" : "reps");
const lerSeries = (x: unknown): SerieFeita[] =>
  Array.isArray(x)
    ? x.map((s: { c?: number | string | null; r?: number | string | null }) => ({
        carga: s?.c == null ? null : Number(s.c),
        reps: s?.r == null ? null : Number(s.r),
      }))
    : [];
const erroDoBanco = (msg: string, padrao: string) => (/function|column|schema|relation|uuid|syntax/i.test(msg) ? padrao : msg);

/** Foco de cada dia e exercícios. Vazio se não houver ou se a migração 71 ainda não rodou. */
export async function treinoCompleto(vinculoId: string): Promise<TreinoCompleto> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("treino_completo", { p_vinculo: vinculoId });
  const vazio: TreinoCompleto = { focos: {}, exercicios: {} };
  if (error || !data) return vazio;
  const d = data as {
    dias: { dia: number; foco: string | null }[];
    exercicios: {
      id: string;
      dia: number;
      nome: string;
      series: number | null;
      repeticoes: string | null;
      carga: number | string | null;
      descanso: number | null;
      unidade?: string;
      medida?: string;
      obs?: string | null;
    }[];
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
      unidade: unidade(e.unidade),
      medida: medida(e.medida),
      obs: e.obs ?? null,
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
  if (exercicios.some((e) => (e.obs ?? "").trim().length > 200)) return { ok: false, erro: "A observação de cada exercício pode ter até 200 letras." };
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
      unidade: e.unidade,
      medida: e.medida,
      obs: e.obs?.trim() || null,
    })),
  });
  if (!error) return { ok: true };
  return { ok: false, erro: erroDoBanco(error.message, "Não foi possível salvar o treino.") };
}

/** O treino da aula: dia escolhido, início, fim e o que já foi marcado (vazio se não for aula do usuário). */
export async function treinoDaAula(aulaId: string): Promise<TreinoDaAula> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("treino_da_aula", { p_aula: aulaId });
  const vazio: TreinoDaAula = { dia: null, iniciado: null, encerrado: null, registros: [] };
  if (error || !data) return vazio;
  const d = data as { dia: number | null; iniciado: string | null; encerrado: string | null; registros: { exercicio: string; feito: boolean; series: unknown }[] };
  return {
    dia: d.dia ?? null,
    iniciado: d.iniciado ?? null,
    encerrado: d.encerrado ?? null,
    registros: (d.registros ?? []).filter((r) => r.exercicio).map((r) => ({ exercicioId: r.exercicio, feito: r.feito, series: lerSeries(r.series) })),
  };
}

export async function registrarSeries(aulaId: string, exercicioId: string, feito: boolean, series: SerieFeita[]): Promise<Resposta> {
  if (series.length > 20) return { ok: false, erro: "Use no máximo 20 séries." };
  if (series.some((s) => s.carga != null && (Number.isNaN(s.carga) || s.carga < 0 || s.carga > 2000))) return { ok: false, erro: "Confira a carga." };
  if (series.some((s) => s.reps != null && (!Number.isInteger(s.reps) || s.reps < 0 || s.reps > 3600))) return { ok: false, erro: "Confira as repetições." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("registrar_series", {
    p_aula: aulaId,
    p_exercicio: exercicioId,
    p_feito: feito,
    p_series: series.map((s) => ({ c: s.carga, r: s.reps })),
  });
  if (!error) return { ok: true };
  return { ok: false, erro: erroDoBanco(error.message, "Não foi possível registrar.") };
}

/** Troca o treino da aula pelo de outro dia (null: volta ao do dia da semana). */
export async function escolherTreinoDaAula(aulaId: string, dia: number | null): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("escolher_treino_da_aula", { p_aula: aulaId, p_dia: dia });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível trocar o treino.") } : { ok: true };
}

export async function iniciarTreino(aulaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("iniciar_treino", { p_aula: aulaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível começar o treino.") } : { ok: true };
}

export async function encerrarTreino(aulaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_treino", { p_aula: aulaId });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível encerrar o treino.") } : { ok: true };
}

/** Exercícios feitos nas aulas, do mais antigo ao mais novo. */
export async function evolucaoDoTreino(vinculoId: string): Promise<PontoDeTreino[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("evolucao_do_treino", { p_vinculo: vinculoId });
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      exercicio: string | null;
      nome: string;
      aula?: string | null;
      data: string;
      carga: number | string | null;
      repeticoes: number | null;
      series?: unknown;
      unidade?: string;
      medida?: string;
    }[]
  ).map((p) => {
    const series = lerSeries(p.series);
    const cargaKg = p.carga == null ? null : Number(p.carga);
    return {
      exercicioId: p.exercicio,
      nome: p.nome,
      aulaId: p.aula ?? null,
      data: p.data,
      cargaKg,
      repeticoes: p.repeticoes,
      // Registros antigos (antes da migração 74) têm só uma carga e repetições.
      series: series.length > 0 ? series : cargaKg != null || p.repeticoes != null ? [{ carga: cargaKg, reps: p.repeticoes }] : [],
      unidade: unidade(p.unidade),
      medida: medida(p.medida),
    };
  });
}

// ─── Relatório do mês (decisão 117) ───────────────────────────────────────────────────────────

/** Personal: alunos ativos com o número de aulas com treino registrado no mês e se já enviou. mes: "AAAA-MM". */
export async function relatoriosDoMes(mes: string): Promise<{ vinculoId: string; aulas: number; enviadoEm: string | null }[]> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return [];
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("relatorios_do_mes", { p_mes: `${mes}-01` });
  if (error || !Array.isArray(data)) return [];
  return (data as { vinculo_id: string; aulas: number; enviado_em: string | null }[]).map((r) => ({
    vinculoId: r.vinculo_id,
    aulas: r.aulas,
    enviadoEm: r.enviado_em,
  }));
}

export async function enviarRelatorioDoMes(vinculoId: string, mes: string): Promise<Resposta> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, erro: "Escolha o mês." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("enviar_relatorio_mes", { p_vinculo: vinculoId, p_mes: `${mes}-01` });
  return error ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível enviar o relatório.") } : { ok: true };
}

/** Aluno: relatórios recebidos, do mais novo ao mais antigo. mes: "AAAA-MM". */
export async function meusRelatorios(): Promise<{ vinculoId: string; mes: string; enviadoEm: string; vistoEm: string | null }[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("meus_relatorios");
  if (error || !Array.isArray(data)) return [];
  return (data as { vinculo_id: string; mes: string; enviado_em: string; visto_em: string | null }[]).map((r) => ({
    vinculoId: r.vinculo_id,
    mes: r.mes.slice(0, 7),
    enviadoEm: r.enviado_em,
    vistoEm: r.visto_em,
  }));
}

export async function marcarRelatorioVisto(vinculoId: string, mes: string): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(mes)) return;
  const supabase = await criarClienteSupabase();
  await supabase.rpc("marcar_relatorio_visto", { p_vinculo: vinculoId, p_mes: `${mes}-01` });
}
