"use server";

// Convites e vínculos personal ↔ aluno (Fase 1, etapa 2). Roda só no servidor.
// Todas as regras importantes ficam no banco (funções criar_convite, ver_convite,
// aceitar_convite, encerrar_vinculo, meus_alunos, aluno_do_personal, meus_personais),
// que conferem quem está logado. Este arquivo só traduz para o site.

import type { Genero, NivelAluno } from "@/lib/aluno";
import { problemasDoConvite, type AlunoDaLista, type Convite, type SituacaoConvite } from "@/lib/convite";
import { frase } from "@/lib/formato";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /convite|perfil|conta de aluno|vínculo|personais/i.test(m) ? m : padrao;
}

// ─── Personal ──────────────────────────────────────────────────────────────

export async function criarConvite(
  nome: string,
  whatsapp: string,
): Promise<{ ok: true; codigo: string } | { ok: false; erro: string }> {
  const problemas = problemasDoConvite(nome, whatsapp);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { data, error } = await supabase.rpc("criar_convite", { p_nome: nome.trim(), p_whatsapp: whatsapp });
  if (error || !data) return { ok: false, erro: erroDoBanco(error?.message, "Não foi possível criar o convite.") };
  return { ok: true, codigo: (data as { codigo: string }).codigo };
}

export async function cancelarConvite(vinculoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("cancelar_convite", { p_vinculo: vinculoId });
  return error ? { ok: false, erro: "Não foi possível cancelar o convite." } : { ok: true };
}

export async function listarMeusAlunos(): Promise<AlunoDaLista[]> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("meus_alunos");
  return ((data ?? []) as Record<string, string | null>[]).map((l) => ({
    vinculoId: l.vinculo_id as string,
    situacao: l.situacao as AlunoDaLista["situacao"],
    nome: l.nome ?? "",
    whatsapp: l.whatsapp,
    codigo: l.codigo,
    criadoEm: l.criado_em as string,
    expiraEm: l.expira_em as string,
    aceitoEm: l.aceito_em,
    encerradoPor: l.encerrado_por as AlunoDaLista["encerradoPor"],
  }));
}

export interface FichaDoAluno {
  vinculoId: string;
  aceitoEm: string;
  nomeCompleto: string;
  idade: number;
  genero: Genero | null;
  whatsapp: string | null;
  avisosWhatsapp: boolean;
  objetivo: string;
  nivel: NivelAluno | null;
  bairro: string | null;
  cep: string | null;
  endereco: string | null;
  cidade: string | null;
  restricoes: string | null;
  semRestricoes: boolean | null;
  restricoesDeclaradasEm: string | null;
  pesoKg: number | null;
  alturaCm: number | null;
  outrasMedidas: string | null;
  /** Quando cada dado foi informado (o valor atual): peso_kg, altura_cm, outras_medidas, objetivo. */
  datas: Partial<Record<"peso_kg" | "altura_cm" | "outras_medidas" | "objetivo", string>>;
}

/** Ficha completa do aluno. Só sai com vínculo ATIVO com o personal logado. */
export async function lerFichaDoAluno(vinculoId: string): Promise<FichaDoAluno | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("aluno_do_personal", { p_vinculo: vinculoId });
  if (!data) return null;
  const f = data as Record<string, unknown>;
  return {
    vinculoId: f.vinculo_id as string,
    aceitoEm: f.aceito_em as string,
    nomeCompleto: f.nome_completo as string,
    idade: f.idade as number,
    genero: (f.genero as Genero | null) ?? null,
    whatsapp: (f.whatsapp as string | null) ?? null,
    avisosWhatsapp: !!f.avisos_whatsapp,
    objetivo: (f.objetivo as string) ?? "",
    nivel: (f.nivel as NivelAluno | null) ?? null,
    bairro: (f.bairro as string | null) ?? null,
    cep: (f.cep as string | null) ?? null,
    endereco: (f.endereco as string | null) ?? null,
    cidade: (f.cidade as string | null) ?? null,
    restricoes: (f.restricoes as string | null) ?? null,
    semRestricoes: (f.sem_restricoes as boolean | null) ?? null,
    restricoesDeclaradasEm: (f.restricoes_declaradas_em as string | null) ?? null,
    pesoKg: f.peso_kg == null ? null : Number(f.peso_kg),
    alturaCm: f.altura_cm == null ? null : Number(f.altura_cm),
    outrasMedidas: (f.outras_medidas as string | null) ?? null,
    datas: (f.datas as FichaDoAluno["datas"] | null) ?? {},
  };
}

export async function encerrarVinculo(vinculoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("encerrar_vinculo", { p_vinculo: vinculoId });
  return error ? { ok: false, erro: "Não foi possível encerrar o vínculo." } : { ok: true };
}

// ─── Quem abre o link ──────────────────────────────────────────────────────

export async function verConvite(codigo: string): Promise<Convite> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ver_convite", { p_codigo: codigo });
  const c = (data ?? {}) as Record<string, unknown>;
  return {
    situacao: ((c.situacao as SituacaoConvite) ?? "inexistente"),
    nomeConvite: (c.nome_convite as string) ?? "",
    personalNome: (c.personal_nome as string) ?? "",
    personalCref: (c.personal_cref as string) ?? "",
    jaAceitoPorMim: !!c.ja_aceito_por_mim,
  };
}

export async function aceitarConvite(codigo: string): Promise<Resposta> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de aluno para aceitar." };
  const { error } = await supabase.rpc("aceitar_convite", { p_codigo: codigo });
  return error
    ? { ok: false, erro: erroDoBanco(error.message, "Não foi possível aceitar o convite. Tente de novo.") }
    : { ok: true };
}

// ─── Aluno ─────────────────────────────────────────────────────────────────

export interface MeuPersonal {
  vinculoId: string;
  nome: string;
  cref: string;
  whatsapp: string;
  aceitoEm: string;
}

export async function listarMeusPersonais(): Promise<MeuPersonal[]> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("meus_personais");
  return ((data ?? []) as Record<string, string>[]).map((p) => ({
    vinculoId: p.vinculo_id,
    nome: p.personal_nome,
    cref: p.personal_cref,
    whatsapp: p.personal_whatsapp,
    aceitoEm: p.aceito_em,
  }));
}

export interface Aniversariante {
  vinculoId: string;
  nome: string;
  /** Dia do mês do aniversário. */
  dia: number;
  /** Idade que completa no ano. */
  fazAnos: number;
}

/** Alunos ativos que fazem aniversário no mês da data "AAAA-MM-DD" (padrão: este mês). */
export async function aniversariantesDoMes(data?: string): Promise<Aniversariante[]> {
  const supabase = await criarClienteSupabase();
  const { data: linhas } = await supabase.rpc("aniversariantes_do_mes", { p_data: data ?? null });
  return ((linhas ?? []) as { vinculo_id: string; nome: string; dia: number; faz_anos: number }[]).map((l) => ({
    vinculoId: l.vinculo_id,
    nome: l.nome,
    dia: l.dia,
    fazAnos: l.faz_anos,
  }));
}
