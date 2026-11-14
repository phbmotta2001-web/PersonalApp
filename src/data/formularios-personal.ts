"use server";

// ParQ e anamnese do personal (decisão 105, migração 67), como no estúdio: os dois vêm prontos
// (editáveis), o aluno que entra pelo convite recebe para preencher e o personal pode enviar de
// novo. As respostas ficam na ficha do aluno.

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { limparPerguntas, type Pergunta, type Respostas } from "@/lib/questionario";
import type { Resposta } from "./conta";
import { listarMeusAlunos } from "./convites";
import type { EnvioDeFormulario, FormularioDoEstudio, RespostaDeFormulario } from "./formularios-estudio";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

/** ParQ e anamnese do personal logado, com quantos responderam e quantos faltam. */
export async function lerFormulariosDoPersonal(): Promise<FormularioDoEstudio[]> {
  const supabase = await criarClienteSupabase();
  const [{ data: forms }, { data: respostas }] = await Promise.all([
    supabase.from("personal_formularios").select("id, tipo, nome, perguntas"),
    supabase.from("personal_respostas").select("formulario_id, respondido_em"),
  ]);
  return (forms ?? [])
    .map((f) => {
      const deste = (respostas ?? []).filter((r) => r.formulario_id === f.id);
      return {
        id: f.id as string,
        tipo: f.tipo as "parq" | "anamnese",
        nome: f.nome as string,
        perguntas: f.perguntas as Pergunta[],
        respondidos: deste.filter((r) => r.respondido_em).length,
        pendentes: deste.filter((r) => !r.respondido_em).length,
      };
    })
    .sort((a, b) => (a.tipo === "parq" ? 0 : 1) - (b.tipo === "parq" ? 0 : 1));
}

export async function salvarFormularioDoPersonal(id: string, nome: string, perguntas: Pergunta[]): Promise<Resposta> {
  const limpas = limparPerguntas(perguntas);
  if (limpas.length === 0) return { ok: false, erro: "Escreva pelo menos uma pergunta." };
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_formulario_personal", { p_id: id, p_nome: nome, p_perguntas: limpas });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o formulário.") } : { ok: true };
}

/** Envia para os alunos com o app (todos ou os escolhidos, por vínculo). Devolve quem recebeu. */
export async function enviarFormularioDoPersonal(
  formularioId: string,
  vinculos: string[] | null,
): Promise<{ ok: true; enviados: EnvioDeFormulario[] } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("enviar_formulario_personal", { p_formulario: formularioId, p_vinculos: vinculos });
  if (error) return { ok: false, erro: doBanco(error.message, "Não foi possível enviar o formulário.") };
  const alunos = new Map((await listarMeusAlunos()).map((a) => [a.vinculoId, a]));
  return {
    ok: true,
    enviados: ((data ?? []) as { resposta_id: string; vinculo_id: string }[])
      .map((r) => {
        const a = alunos.get(r.vinculo_id);
        return { respostaId: r.resposta_id, nome: a?.nome ?? "Aluno", whatsapp: a?.whatsapp ?? null, comApp: true };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

/** Respostas que já chegaram de um formulário do personal. */
export async function respostasDoFormularioDoPersonal(formularioId: string): Promise<RespostaDeFormulario[]> {
  const supabase = await criarClienteSupabase();
  const [{ data }, alunos] = await Promise.all([
    supabase
      .from("personal_respostas")
      .select("id, tipo, titulo, perguntas, respostas, enviado_em, respondido_em, vinculo_id")
      .eq("formulario_id", formularioId)
      .not("respondido_em", "is", null)
      .order("respondido_em", { ascending: false }),
    listarMeusAlunos(),
  ]);
  const nomes = new Map(alunos.map((a) => [a.vinculoId, a.nome]));
  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as "parq" | "anamnese",
    titulo: r.titulo,
    aluno: nomes.get(r.vinculo_id) ?? "Aluno",
    perguntas: r.perguntas as Pergunta[],
    respostas: r.respostas as Respostas | null,
    enviadoEm: r.enviado_em,
    respondidoEm: r.respondido_em,
  }));
}

/** ParQ e anamnese de um aluno (ficha do aluno no app do personal). */
export async function formulariosDoVinculo(vinculoId: string): Promise<RespostaDeFormulario[]> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase
    .from("personal_respostas")
    .select("id, tipo, titulo, perguntas, respostas, enviado_em, respondido_em")
    .eq("vinculo_id", vinculoId)
    .order("enviado_em", { ascending: false });
  // O mais recente de cada formulário, ParQ primeiro.
  const vistos = new Set<string>();
  return (data ?? [])
    .filter((r) => (vistos.has(r.tipo) ? false : (vistos.add(r.tipo), true)))
    .sort((a, b) => (a.tipo === "parq" ? 0 : 1) - (b.tipo === "parq" ? 0 : 1))
    .map((r) => ({
      id: r.id,
      tipo: r.tipo as "parq" | "anamnese",
      titulo: r.titulo,
      perguntas: r.perguntas as Pergunta[],
      respostas: r.respostas as Respostas | null,
      enviadoEm: r.enviado_em,
      respondidoEm: r.respondido_em,
    }));
}

/** Aluno responde um formulário do personal. */
export async function responderFormularioDoPersonal(id: string, respostas: Respostas): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("responder_formulario_personal", { p_resposta: id, p_respostas: respostas });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível enviar as respostas.") } : { ok: true };
}

/** Ficha do aluno: envia o ParQ e a anamnese (os que ele ainda não tem para responder). */
export async function enviarParqEAnamnese(vinculoId: string): Promise<{ ok: true; enviados: number } | { ok: false; erro: string }> {
  const formularios = await lerFormulariosDoPersonal();
  let enviados = 0;
  for (const f of formularios) {
    const r = await enviarFormularioDoPersonal(f.id, [vinculoId]);
    if (!r.ok) return r;
    enviados += r.enviados.length;
  }
  return { ok: true, enviados };
}
