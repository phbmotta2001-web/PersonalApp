"use server";

// Contrato do personal (decisão 126): o personal escreve; o aluno assina no app (junto das regras).

import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

export async function lerContrato(): Promise<string> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return "";
  const { data } = await supabase.from("personais").select("contrato_texto").eq("id", id).maybeSingle();
  return (data?.contrato_texto as string | null) ?? "";
}

export async function salvarContrato(texto: string): Promise<Resposta> {
  if (typeof texto !== "string" || texto.length > 20000) return { ok: false, erro: "O contrato pode ter até 20.000 caracteres." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_contrato", { p_texto: texto });
  return error ? { ok: false, erro: "Não foi possível salvar o contrato. Tente de novo." } : { ok: true };
}

/** Na ficha do aluno: quando assinou o contrato atual (null: ainda não assinou; "sem": o personal não tem contrato). */
export async function assinaturaDoContrato(vinculoId: string): Promise<{ assinadoEm: string | null } | "sem"> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return "sem";
  const { data: p } = await supabase.from("personais").select("contrato_versao").eq("id", id).maybeSingle();
  if (!p?.contrato_versao) return "sem";
  const { data } = await supabase
    .from("contratos_assinados")
    .select("assinado_em")
    .eq("vinculo_id", vinculoId)
    .eq("versao", p.contrato_versao)
    .maybeSingle();
  return { assinadoEm: (data?.assinado_em as string | null) ?? null };
}
