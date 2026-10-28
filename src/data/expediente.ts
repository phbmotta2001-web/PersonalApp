"use server";

// Horários de trabalho e bloqueios do personal logado (Fase 1, etapa 1).
// Roda só no servidor. O banco só deixa cada personal ler e mudar os próprios.

import {
  DURACOES,
  periodoDoBloqueio,
  problemasDasFaixas,
  problemasDoBloqueio,
  type Bloqueio,
  type Duracao,
  type Faixa,
  type NovoBloqueio,
} from "@/lib/expediente";
import { frase } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";
import { contarAulasNoPeriodo } from "./matriculas";

export interface Expediente {
  duracao: Duracao;
  faixas: Faixa[];
}

/** Duração padrão e faixas de trabalho do personal logado (null se não for personal). */
export async function lerExpediente(): Promise<Expediente | null> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return null;

  const [personal, faixas] = await Promise.all([
    supabase.from("personais").select("duracao_aula_min").eq("id", id).maybeSingle(),
    supabase.from("horarios_trabalho").select("dia_semana, inicio_min, fim_min").eq("personal_id", id),
  ]);
  if (!personal.data) return null;

  return {
    duracao: personal.data.duracao_aula_min as Duracao,
    faixas: (faixas.data ?? [])
      .map((f) => ({ dia: f.dia_semana, inicioMin: f.inicio_min, fimMin: f.fim_min }))
      .sort((a, b) => a.dia - b.dia || a.inicioMin - b.inicioMin),
  };
}

export async function salvarExpediente(duracao: number, faixas: Faixa[]): Promise<Resposta> {
  if (!DURACOES.includes(duracao as Duracao)) return { ok: false, erro: "Escolha a duração da aula." };
  if (!Array.isArray(faixas)) return { ok: false, erro: "Lista de horários inválida." };
  const problemas = problemasDasFaixas(faixas);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { error } = await supabase.rpc("salvar_horarios_trabalho", {
    p_duracao: duracao,
    p_faixas: faixas.map((f) => ({ dia: f.dia, inicio_min: f.inicioMin, fim_min: f.fimMin })),
  });
  return error ? { ok: false, erro: "Não foi possível salvar os horários. Tente de novo." } : { ok: true };
}

/** Bloqueios que ainda não terminaram, do mais próximo para o mais distante. */
/** Bloqueios que ainda não acabaram. semFeriados: só os que o personal criou (os de feriado o Pienel cria). */
export async function listarBloqueios(semFeriados = false): Promise<Required<Bloqueio>[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  let consulta = supabase
    .from("bloqueios")
    .select("id, inicio, fim, dia_inteiro, motivo")
    .eq("personal_id", id)
    .gt("fim", new Date().toISOString());
  if (semFeriados) consulta = consulta.is("feriado", null);
  const { data } = await consulta.order("inicio");
  return (data ?? []).map((b) => ({
    id: b.id,
    inicio: b.inicio,
    fim: b.fim,
    diaInteiro: b.dia_inteiro,
    motivo: b.motivo,
  }));
}

/** Cria o bloqueio e conta as aulas marcadas que caem nele (elas continuam marcadas). */
export async function criarBloqueio(novo: NovoBloqueio): Promise<{ ok: true; aulas: number } | { ok: false; erro: string }> {
  const problemas = problemasDoBloqueio(novo);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { inicio, fim } = periodoDoBloqueio(novo);
  const { error } = await supabase.from("bloqueios").insert({
    personal_id: id,
    inicio,
    fim,
    dia_inteiro: novo.diaInteiro,
    motivo: novo.motivo.trim(),
  });
  if (error) return { ok: false, erro: "Não foi possível criar o bloqueio. Tente de novo." };
  return { ok: true, aulas: await contarAulasNoPeriodo(inicio, fim) };
}

export async function apagarBloqueio(idBloqueio: string): Promise<Resposta> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };
  const { error } = await supabase.from("bloqueios").delete().eq("id", idBloqueio).eq("personal_id", id);
  return error ? { ok: false, erro: "Não foi possível apagar o bloqueio." } : { ok: true };
}
