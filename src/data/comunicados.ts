"use server";

// Decisão 102: comunicados da coordenação para os alunos (no Início do app, sem notificação no
// celular, e pelo WhatsApp). Leituras devolvem vazio se a migração 64 não foi rodada.

import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid|invalid input/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export interface ComunicadoEnviado {
  id: string;
  texto: string;
  criadoEm: string;
  enviados: number;
  lidos: number;
}

export interface DestinatarioDoComunicado {
  alunoId: string;
  nome: string;
  whatsapp: string | null;
  comApp: boolean;
}

export async function comunicadosDoEstudio(estudioId: string): Promise<ComunicadoEnviado[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("comunicados_do_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { id: string; texto: string; criado_em: string; enviados: number; lidos: number }[]).map((c) => ({
    id: c.id,
    texto: c.texto,
    criadoEm: c.criado_em,
    enviados: c.enviados,
    lidos: c.lidos,
  }));
}

/** Envia para todos (alunoIds nulo) ou para os escolhidos. Devolve quem recebeu, para o WhatsApp. */
export async function enviarComunicado(
  estudioId: string,
  texto: string,
  alunoIds: string[] | null,
): Promise<{ ok: true; para: DestinatarioDoComunicado[] } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("enviar_comunicado_estudio", { p_estudio: estudioId, p_texto: texto, p_alunos: alunoIds });
  if (error) return { ok: false, erro: doBanco(error.message, "Não foi possível enviar o comunicado.") };
  return {
    ok: true,
    para: ((data ?? []) as { estudio_aluno_id: string; nome: string; whatsapp: string | null; com_app: boolean }[]).map((x) => ({
      alunoId: x.estudio_aluno_id,
      nome: x.nome,
      whatsapp: x.whatsapp,
      comApp: x.com_app,
    })),
  };
}

export interface ComunicadoDoAluno {
  id: string;
  estudioId: string;
  estudio: string;
  texto: string;
  criadoEm: string;
}

export async function meusComunicados(): Promise<ComunicadoDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("meus_comunicados");
  if (error) return [];
  return ((data ?? []) as { id: string; estudio_id: string; estudio: string; texto: string; criado_em: string }[]).map((c) => ({
    id: c.id,
    estudioId: c.estudio_id,
    estudio: c.estudio,
    texto: c.texto,
    criadoEm: c.criado_em,
  }));
}

export async function marcarComunicadoLido(comunicadoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_comunicado_lido", { p_comunicado: comunicadoId });
  return error ? { ok: false, erro: "Não foi possível agora." } : { ok: true };
}
