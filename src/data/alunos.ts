"use server";

// Porta de entrada dos dados do aluno logado. Roda só no servidor.
// Os dados ficam no Supabase (tabelas alunos, alunos_saude e consentimentos).
// O banco só deixa cada pessoa ler e mudar os PRÓPRIOS dados (regras de segurança
// por linha em supabase/migrations), mesmo que este código tenha algum erro.

import {
  problemasDaSaude,
  problemasDoPerfil,
  SAUDE_VAZIA,
  type ContaAluno,
  type DadosSaude,
  type Genero,
  type NivelAluno,
  type PerfilEditavel,
} from "@/lib/aluno";
import { VERSAO_CONSENTIMENTO_SAUDE } from "@/lib/consentimento";
import { frase } from "@/lib/formato";
import { usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const numero = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Perfil completo do aluno logado, ou null se ninguém estiver logado. */
export async function lerContaAtual(): Promise<ContaAluno | null> {
  const { supabase, id, email } = await usuarioAtual();
  if (!id) return null;

  const [aluno, saude, consentimento] = await Promise.all([
    supabase
      .from("alunos")
      .select("nome_completo, data_nascimento, genero, objetivo, nivel, cep, endereco, bairro, cidade")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("alunos_saude")
      .select("restricoes, peso_kg, altura_cm, outras_medidas, restricoes_declaradas_em")
      .eq("aluno_id", id)
      .maybeSingle(),
    supabase
      .from("consentimentos")
      .select("id")
      .eq("aluno_id", id)
      .eq("tipo", "dados_saude")
      .is("revogado_em", null)
      .maybeSingle(),
  ]);

  const a = aluno.data;
  if (aluno.error || !a) return null;
  const s = saude.data;

  return {
    perfil: {
      email,
      nomeCompleto: texto(a.nome_completo),
      dataNascimento: texto(a.data_nascimento),
      genero: (a.genero as Genero | null) ?? null,
      objetivo: texto(a.objetivo),
      nivel: (a.nivel as NivelAluno | null) ?? null,
      cep: texto(a.cep),
      endereco: texto(a.endereco),
      bairro: texto(a.bairro),
      cidade: texto(a.cidade),
    },
    consentimentoSaude: !!consentimento.data,
    saude: s
      ? {
          temRestricoes: s.restricoes_declaradas_em ? texto(s.restricoes).trim() !== "" : null,
          restricoes: texto(s.restricoes),
          pesoKg: numero(s.peso_kg),
          alturaCm: numero(s.altura_cm),
          outrasMedidas: texto(s.outras_medidas),
          restricoesDeclaradasEm: s.restricoes_declaradas_em ? texto(s.restricoes_declaradas_em) : null,
        }
      : SAUDE_VAZIA,
  };
}

const vazioViraNulo = (v: string) => (v.trim() === "" ? null : v.trim());

export async function salvarPerfil(dados: PerfilEditavel): Promise<Resposta> {
  const problemas = problemasDoPerfil(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  // Nome completo e data de nascimento não estão aqui: só o suporte altera.
  const { error } = await supabase
    .from("alunos")
    .update({
      genero: dados.genero,
      objetivo: dados.objetivo.trim(),
      nivel: dados.nivel,
      cep: vazioViraNulo(dados.cep),
      endereco: vazioViraNulo(dados.endereco),
      bairro: vazioViraNulo(dados.bairro),
      cidade: vazioViraNulo(dados.cidade),
    })
    .eq("id", id);

  return error ? { ok: false, erro: "Não foi possível salvar o perfil. Tente de novo." } : { ok: true };
}

export async function salvarSaude(
  dados: DadosSaude,
): Promise<{ ok: true; declaradasEm: string | null } | { ok: false; erro: string }> {
  const problemas = problemasDaSaude(dados);
  if (problemas.length > 0) return { ok: false, erro: frase(problemas) };

  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  // A data da declaração só muda quando a resposta ou o texto das restrições mudam
  // (mexer só no peso não conta como "atualizei minhas restrições").
  const { data: atual } = await supabase
    .from("alunos_saude")
    .select("restricoes, restricoes_declaradas_em")
    .eq("aluno_id", id)
    .maybeSingle();
  const restricoes = dados.temRestricoes ? dados.restricoes.trim() : "";
  const declarouAntes = !!atual?.restricoes_declaradas_em;
  const declaradasEm =
    dados.temRestricoes === null
      ? (atual?.restricoes_declaradas_em ?? null)
      : !declarouAntes || atual?.restricoes !== restricoes
        ? new Date().toISOString()
        : atual.restricoes_declaradas_em;

  // Sem consentimento ativo, o próprio banco recusa a gravação.
  const { error } = await supabase.from("alunos_saude").upsert(
    {
      aluno_id: id,
      restricoes,
      restricoes_declaradas_em: declaradasEm,
      peso_kg: dados.pesoKg,
      altura_cm: dados.alturaCm,
      outras_medidas: dados.outrasMedidas.trim(),
    },
    { onConflict: "aluno_id" },
  );

  return error
    ? { ok: false, erro: "Não foi possível salvar os dados de saúde. Confira se a autorização está ativa." }
    : { ok: true, declaradasEm };
}

export async function darConsentimentoSaude(): Promise<Resposta> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { error } = await supabase
    .from("consentimentos")
    .insert({ aluno_id: id, tipo: "dados_saude", versao_texto: VERSAO_CONSENTIMENTO_SAUDE });

  // 23505 = já existe uma autorização ativa (o que também está certo).
  return error && error.code !== "23505"
    ? { ok: false, erro: "Não foi possível registrar a autorização. Tente de novo." }
    : { ok: true };
}

/** Retirar a autorização APAGA os dados de saúde (feito pelo próprio banco). */
export async function retirarConsentimentoSaude(): Promise<Resposta> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return { ok: false, erro: "Entre na sua conta de novo." };

  const { error } = await supabase
    .from("consentimentos")
    .update({ revogado_em: new Date().toISOString() })
    .eq("aluno_id", id)
    .eq("tipo", "dados_saude")
    .is("revogado_em", null);

  return error ? { ok: false, erro: "Não foi possível retirar a autorização. Tente de novo." } : { ok: true };
}
