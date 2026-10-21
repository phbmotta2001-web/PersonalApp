"use server";

// Convites e vínculos personal ↔ aluno (Fase 1, etapa 2). Roda só no servidor.
// Todas as regras importantes ficam no banco (funções criar_convite, ver_convite,
// aceitar_convite, encerrar_vinculo, meus_alunos, aluno_do_personal, meus_personais),
// que conferem quem está logado. Este arquivo só traduz para o site.

import type { Genero, NivelAluno } from "@/lib/aluno";
import {
  problemasDoAlunoSemConta,
  problemasDoConvite,
  type AlunoDaLista,
  type Convite,
  type DadosAlunoSemConta,
  type FichaSemConta,
  type SituacaoConvite,
} from "@/lib/convite";
import { agoraEmBrasilia } from "@/lib/expediente";
import { frase } from "@/lib/formato";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value/i;

/** Mensagens que o próprio banco escreve em português e podem ir direto para a tela. */
function erroDoBanco(mensagem: string | undefined, padrao: string): string {
  const m = mensagem ?? "";
  // Erro técnico do banco (em inglês) nunca vai para a tela.
  if (TECNICO.test(m)) return padrao;
  return /convite|perfil|conta de aluno|vínculo|personais|aluno|nascimento|responsável|WhatsApp|observações/i.test(m) ? m : padrao;
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
    semConta: (l.sem_conta as unknown as boolean) === true,
    menor: (l.menor as unknown as boolean) === true,
    responsavelNome: l.responsavel_nome,
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
  /** Aluno sem conta (etapa 5b): os dados que o personal cadastrou. */
  semConta?: FichaSemConta;
}

/** Ficha completa do aluno. Só sai com vínculo ATIVO com o personal logado. */
export async function lerFichaDoAluno(vinculoId: string): Promise<FichaDoAluno | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("aluno_do_personal", { p_vinculo: vinculoId });
  if (!data) {
    // Aluno sem conta: a ficha vem do que o personal cadastrou.
    const s = await lerFichaSemConta(vinculoId);
    return s
      ? {
          vinculoId: s.vinculoId,
          aceitoEm: s.aceitoEm,
          nomeCompleto: s.nome,
          idade: s.idade,
          genero: null,
          whatsapp: s.menor ? s.responsavelWhatsapp : s.whatsapp,
          avisosWhatsapp: true,
          objetivo: "",
          nivel: null,
          bairro: null,
          cep: null,
          endereco: null,
          cidade: null,
          restricoes: s.observacoes,
          semRestricoes: null,
          restricoesDeclaradasEm: null,
          pesoKg: null,
          alturaCm: null,
          outrasMedidas: null,
          datas: {},
          semConta: s,
        }
      : null;
  }
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

// ─── Aluno sem conta (etapa 5b) ────────────────────────────────────────────

/** Cria (vinculoId nulo) ou altera o aluno sem conta. */
export async function salvarAlunoSemConta(
  vinculoId: string | null,
  dados: DadosAlunoSemConta,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const problemas = problemasDoAlunoSemConta(dados, agoraEmBrasilia().data);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("salvar_aluno_sem_conta", {
    p_vinculo: vinculoId,
    p_dados: {
      nome: dados.nome.trim(),
      data_nascimento: dados.dataNascimento,
      whatsapp: dados.whatsapp,
      responsavel_nome: dados.responsavelNome.trim(),
      responsavel_whatsapp: dados.responsavelWhatsapp,
      responsavel_autorizou: dados.responsavelAutorizou,
      observacoes: dados.observacoes.trim(),
    },
  });
  return error || !data
    ? { ok: false, erro: erroDoBanco(error?.message, "Não foi possível salvar o aluno.") }
    : { ok: true, id: data as string };
}

/** Ficha do aluno sem conta (só o personal dele); null se não for aluno sem conta. */
export async function lerFichaSemConta(vinculoId: string): Promise<FichaSemConta | null> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ficha_sem_conta", { p_vinculo: vinculoId });
  if (!data) return null;
  const f = data as Record<string, unknown>;
  return {
    vinculoId: f.vinculo_id as string,
    aceitoEm: f.aceito_em as string,
    nome: f.nome as string,
    whatsapp: (f.whatsapp as string | null) ?? null,
    dataNascimento: f.data_nascimento as string,
    idade: f.idade as number,
    menor: f.menor === true,
    responsavelNome: (f.responsavel_nome as string | null) ?? null,
    responsavelWhatsapp: (f.responsavel_whatsapp as string | null) ?? null,
    observacoes: (f.observacoes as string | null) ?? null,
    consentimentoEm: (f.consentimento_responsavel_em as string | null) ?? null,
    conviteCodigo: (f.convite_codigo as string | null) ?? null,
    conviteExpiraEm: (f.convite_expira_em as string | null) ?? null,
  };
}

/** "Convidar para ter conta": link novo, válido por 14 dias. */
export async function convidarAlunoSemConta(
  vinculoId: string,
): Promise<{ ok: true; codigo: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("convidar_aluno_sem_conta", { p_vinculo: vinculoId });
  return error || !data
    ? { ok: false, erro: erroDoBanco(error?.message, "Não foi possível criar o convite.") }
    : { ok: true, codigo: (data as { codigo: string }).codigo };
}
