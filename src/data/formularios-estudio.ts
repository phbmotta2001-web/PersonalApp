"use server";

// Formulários do estúdio (decisão 97, migração 58): ParQ e anamnese padrão (editáveis) e
// pesquisas. Só a coordenação cria, edita e envia; o aluno responde no app; a coordenação e os
// professores do aluno veem as respostas.

import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { limparPerguntas, type Pergunta, type Respostas } from "@/lib/questionario";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export type TipoDeFormulario = "parq" | "anamnese" | "pesquisa";

export interface FormularioDoEstudio {
  id: string;
  tipo: TipoDeFormulario;
  nome: string;
  perguntas: Pergunta[];
  respondidos: number;
  pendentes: number;
}

const ORDEM: Record<TipoDeFormulario, number> = { parq: 0, anamnese: 1, pesquisa: 2 };

export async function lerFormulariosDoEstudio(estudioId: string): Promise<FormularioDoEstudio[]> {
  const supabase = await criarClienteSupabase();
  const [{ data: forms }, { data: respostas }] = await Promise.all([
    supabase.from("estudio_formularios").select("id, tipo, nome, perguntas, criado_em").eq("estudio_id", estudioId).eq("arquivado", false),
    supabase.from("estudio_respostas").select("formulario_id, respondido_em").eq("estudio_id", estudioId),
  ]);
  return (forms ?? [])
    .map((f) => {
      const deste = (respostas ?? []).filter((r) => r.formulario_id === f.id);
      return {
        id: f.id as string,
        tipo: f.tipo as TipoDeFormulario,
        nome: f.nome as string,
        perguntas: f.perguntas as Pergunta[],
        respondidos: deste.filter((r) => r.respondido_em).length,
        pendentes: deste.filter((r) => !r.respondido_em).length,
        criado: f.criado_em as string,
      };
    })
    .sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo] || b.criado.localeCompare(a.criado))
    .map((f) => ({ id: f.id, tipo: f.tipo, nome: f.nome, perguntas: f.perguntas, respondidos: f.respondidos, pendentes: f.pendentes }));
}

export async function salvarFormularioDoEstudio(
  estudioId: string,
  id: string | null,
  nome: string,
  perguntas: Pergunta[],
): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_formulario_estudio", {
    p_estudio: estudioId,
    p_id: id,
    p_nome: nome,
    p_perguntas: limparPerguntas(perguntas),
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar o formulário.") } : { ok: true };
}

export async function arquivarFormularioDoEstudio(id: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("arquivar_formulario_estudio", { p_formulario: id });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível apagar o formulário.") } : { ok: true };
}

export interface EnvioDeFormulario {
  respostaId: string;
  nome: string;
  whatsapp: string | null;
  comApp: boolean;
}

/** Envia para os alunos ativos (só os escolhidos, se alunoIds). Devolve quem recebeu. */
export async function enviarFormularioDoEstudio(
  formularioId: string,
  alunoIds: string[] | null,
): Promise<{ ok: true; enviados: EnvioDeFormulario[] } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("enviar_formulario_estudio", { p_formulario: formularioId, p_alunos: alunoIds });
  if (error) return { ok: false, erro: doBanco(error.message, "Não foi possível enviar o formulário.") };
  return {
    ok: true,
    enviados: ((data ?? []) as { resposta_id: string; nome: string; whatsapp: string | null; com_app: boolean }[])
      .map((r) => ({ respostaId: r.resposta_id, nome: r.nome, whatsapp: r.whatsapp, comApp: r.com_app }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}

export interface RespostaDeFormulario {
  id: string;
  tipo: TipoDeFormulario;
  titulo: string;
  /** Nome do aluno (nas respostas de um formulário). */
  aluno?: string;
  perguntas: Pergunta[];
  respostas: Respostas | null;
  enviadoEm: string;
  respondidoEm: string | null;
}

/** Respostas que já chegaram de um formulário (coordenação). */
export async function respostasDoFormulario(formularioId: string): Promise<RespostaDeFormulario[]> {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase
    .from("estudio_respostas")
    .select("id, tipo, titulo, perguntas, respostas, enviado_em, respondido_em, estudio_alunos(nome)")
    .eq("formulario_id", formularioId)
    .not("respondido_em", "is", null)
    .order("respondido_em", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as TipoDeFormulario,
    titulo: r.titulo,
    aluno: (r.estudio_alunos as unknown as { nome: string } | null)?.nome ?? "Aluno",
    perguntas: r.perguntas as Pergunta[],
    respostas: r.respostas as Respostas | null,
    enviadoEm: r.enviado_em,
    respondidoEm: r.respondido_em,
  }));
}

/** Formulários de um aluno (coordenação e professores do aluno). */
export async function formulariosDoAluno(
  estudioAlunoId: string,
): Promise<{ ok: true; lista: RespostaDeFormulario[] } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("formularios_do_aluno_estudio", { p_estudio_aluno: estudioAlunoId });
  if (error) return { ok: false, erro: doBanco(error.message, "Não foi possível abrir os formulários.") };
  return {
    ok: true,
    lista: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      tipo: r.tipo as TipoDeFormulario,
      titulo: r.titulo as string,
      perguntas: r.perguntas as Pergunta[],
      respostas: (r.respostas as Respostas | null) ?? null,
      enviadoEm: r.enviado_em as string,
      respondidoEm: (r.respondido_em as string | null) ?? null,
    })),
  };
}

// ─── Aluno ────────────────────────────────────────────────────────────────────

export interface FormularioPendente {
  id: string;
  estudioId: string;
  estudio: string;
  tipo: TipoDeFormulario;
  titulo: string;
}

export async function meusFormulariosPendentes(): Promise<FormularioPendente[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("meus_formularios_pendentes");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    estudioId: r.estudio_id as string,
    estudio: r.estudio as string,
    tipo: r.tipo as TipoDeFormulario,
    titulo: r.titulo as string,
  }));
}

export async function lerFormularioParaResponder(
  id: string,
): Promise<{ id: string; tipo: TipoDeFormulario; titulo: string; estudioId: string; perguntas: Pergunta[]; respondidoEm: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id ?? "")) return null;
  const supabase = await criarClienteSupabase();
  const { data } = await supabase
    .from("estudio_respostas")
    .select("id, tipo, titulo, estudio_id, perguntas, respondido_em")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    tipo: data.tipo as TipoDeFormulario,
    titulo: data.titulo,
    estudioId: data.estudio_id,
    perguntas: data.perguntas as Pergunta[],
    respondidoEm: data.respondido_em,
  };
}

export async function responderFormularioDoEstudio(id: string, respostas: Respostas): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("responder_formulario_estudio", { p_resposta: id, p_respostas: respostas });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível enviar as respostas.") } : { ok: true };
}
