"use server";

// Aluno do estúdio (decisão 61, migração 38): convite, agenda com vagas, falta e reposição.
// Leituras devolvem vazio se a migração ainda não foi rodada.

import { criarClienteSupabase, origemDoSite, usuarioAtual } from "@/lib/supabase/servidor";
import type { Funcionamento } from "@/lib/funcionamento";
import type { Resposta } from "./conta";

const TECNICO = /could not|function|schema|column|relation|permission|violates|syntax|null value|uuid/i;
const doBanco = (mensagem: string | undefined, padrao: string) => (mensagem && !TECNICO.test(mensagem) ? mensagem : padrao);

export interface EstudioDoAluno {
  id: string;
  nome: string;
  faltaH: number;
  marcarH: number;
  validadeDias: number;
  funcionamento: Funcionamento;
}

export interface AulaNaAgendaDoAluno {
  id: string;
  inicio: string;
  fim: string;
  modalidade: string;
  professor: string | null;
  vagas: number;
  ocupadas: number;
  /** "fixa": a turma é dele; "reposicao": marcou reposição nela. */
  minha: "fixa" | "reposicao" | null;
  aviseiFalta: boolean;
  cancelada: boolean;
  /** Decisão 94: a turma, as vagas livres nela (toda semana; vazio: aula extra) e quantos esperam na fila. */
  turmaId: string;
  livres: number | null;
  naFila: number;
}

export interface FilaDoAluno {
  estudioId: string;
  estudio: string;
  turmaId: string;
  /** "Pilates · Seg 07:00" */
  turma: string;
  /** A turma dele que larga quando entrar (troca de dia). */
  trocar: string | null;
  situacao: "esperando" | "oferecida";
  posicao: number;
  expiraEm: string | null;
}

export interface ReposicaoDoAluno {
  id: string;
  modalidade: string;
  validoAte: string;
}

export async function meusEstudiosComoAluno(): Promise<EstudioDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("meus_estudios_aluno");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((e) => {
    const funcionamento: Funcionamento = {};
    for (const f of (e.funcionamento as { dia: number; inicio_min: number; fim_min: number }[]) ?? [])
      funcionamento[f.dia] = { inicio: f.inicio_min, fim: f.fim_min };
    return {
      id: e.estudio_id as string,
      nome: e.nome as string,
      faltaH: Number(e.falta_h),
      marcarH: Number(e.marcar_h),
      validadeDias: Number(e.validade_dias),
      funcionamento,
    };
  });
}

/** Turmas do estúdio entre duas datas ("AAAA-MM-DD"), com ocupação e sem nomes de alunos. */
export async function agendaDoAlunoNoEstudio(estudioId: string, de: string, ate: string): Promise<AulaNaAgendaDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("agenda_aluno_estudio", { p_estudio: estudioId, p_de: de, p_ate: ate });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.aula_id as string,
    inicio: a.inicio as string,
    fim: a.fim as string,
    modalidade: a.modalidade as string,
    professor: (a.professor as string | null) || null,
    vagas: Number(a.vagas ?? 0),
    ocupadas: Number(a.ocupadas ?? 0),
    minha: a.minha === "fixa" || a.minha === "reposicao" ? a.minha : null,
    aviseiFalta: a.avisei_falta === true,
    cancelada: a.cancelada === true,
    turmaId: (a.turma_id as string) ?? "",
    livres: a.livres == null ? null : Number(a.livres),
    naFila: Number(a.na_fila ?? 0),
  }));
}

/** Decisão 94: as filas de espera em que o aluno logado está. */
export async function minhaFilaDeEspera(): Promise<FilaDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("minha_fila_estudio");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    estudioId: f.estudio_id as string,
    estudio: f.estudio as string,
    turmaId: f.turma_id as string,
    turma: f.turma as string,
    trocar: (f.trocar as string | null) ?? null,
    situacao: f.situacao === "oferecida" ? "oferecida" : "esperando",
    posicao: Number(f.posicao ?? 1),
    expiraEm: (f.expira_em as string | null) ?? null,
  }));
}

/** Entra numa turma toda semana (com `trocar`, larga essa turma dele). */
/** pendente: o trânsito livre está desligado e virou pedido para a coordenação (decisão 96). */
export async function entrarNaTurma(turmaId: string, trocar: string | null = null): Promise<{ ok: true; pendente: boolean } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("entrar_na_turma_estudio", { p_turma: turmaId, p_trocar: trocar });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível entrar na turma.") } : { ok: true, pendente: data === "pendente" };
}

export async function sairDaTurma(turmaId: string): Promise<{ ok: true; pendente: boolean } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("sair_da_turma_estudio", { p_turma: turmaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível sair da turma.") } : { ok: true, pendente: data === "pendente" };
}

// ─── Pedidos de mudança de turma (decisão 96) ───────────────────────────────

export interface PedidoDeFrequencia {
  id: string;
  estudioId: string;
  estudio: string;
  aluno: string;
  whatsapp: string | null;
  tipo: "entrar" | "sair";
  turmaId: string;
  turma: string;
  trocar: string | null;
  /** É um pedido do próprio aluno logado. */
  meu: boolean;
}

/** Pedidos pendentes: os do aluno logado e os dos estúdios que ele coordena. */
export async function pedidosDeFrequencia(): Promise<PedidoDeFrequencia[]> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("pedidos_frequencia_pendentes");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    estudioId: p.estudio_id as string,
    estudio: p.estudio as string,
    aluno: p.aluno as string,
    whatsapp: (p.whatsapp as string | null) ?? null,
    tipo: p.tipo === "sair" ? "sair" : "entrar",
    turmaId: p.turma_id as string,
    turma: p.turma as string,
    trocar: (p.trocar as string | null) ?? null,
    meu: p.meu === true,
  }));
}

export async function decidirPedidoDeFrequencia(pedidoId: string, aprovar: boolean): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("decidir_pedido_frequencia", { p_pedido: pedidoId, p_aprovar: aprovar });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível responder o pedido.") } : { ok: true };
}

export async function cancelarPedidoDeFrequencia(pedidoId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("cancelar_pedido_frequencia", { p_pedido: pedidoId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível cancelar o pedido.") } : { ok: true };
}

/** Entra na fila de uma turma cheia. Devolve a posição. */
export async function entrarNaFila(turmaId: string, trocar: string | null = null): Promise<{ ok: true; posicao: number } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("entrar_na_fila_estudio", { p_turma: turmaId, p_trocar: trocar });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível entrar na fila.") } : { ok: true, posicao: Number(data ?? 1) };
}

export async function sairDaFila(turmaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("sair_da_fila_estudio", { p_turma: turmaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível sair da fila.") } : { ok: true };
}

export async function minhasReposicoesNoEstudio(estudioId: string): Promise<ReposicaoDoAluno[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("minhas_reposicoes_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { id: string; modalidade: string; valido_ate: string }[]).map((r) => ({
    id: r.id,
    modalidade: r.modalidade,
    validoAte: r.valido_ate,
  }));
}

/** Avisar a falta. Sem `alunoId`: o próprio aluno; com ele: o professor da aula ou a coordenação. */
export async function avisarFaltaNoEstudio(
  aulaId: string,
  alunoId?: string,
): Promise<{ ok: true; credito: boolean; fixo: boolean; prazoH: number } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("avisar_falta_estudio", { p_aula: aulaId, p_aluno: alunoId ?? null });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível avisar a falta.") };
  const r = data as { credito: boolean; fixo: boolean; prazo_h: number };
  return { ok: true, credito: r.credito, fixo: r.fixo, prazoH: r.prazo_h };
}

export async function desfazerFaltaNoEstudio(aulaId: string, alunoId?: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("desfazer_falta_estudio", { p_aula: aulaId, p_aluno: alunoId ?? null });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível desfazer.") } : { ok: true };
}

export async function marcarReposicaoNoEstudio(aulaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("marcar_reposicao_estudio", { p_aula: aulaId });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível marcar a reposição.") } : { ok: true };
}

// ─── Convite do aluno ───────────────────────────────────────────────────────

/** Link de convite para o aluno do estúdio entrar no app (só a coordenação). */
export async function gerarConviteDoAluno(estudioAlunoId: string): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("convite_aluno_estudio", { p_estudio_aluno: estudioAlunoId });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível criar o convite. Se continuar, avise a equipe do P-Bell.") };
  return { ok: true, link: `${await origemDoSite()}/estudio/aluno/${data}` };
}

export async function verConviteDoAluno(codigo: string): Promise<{ situacao: string; estudio?: string; aluno?: string }> {
  if (!/^[a-f0-9]{16,64}$/.test(codigo ?? "")) return { situacao: "inexistente" };
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ver_convite_aluno_estudio", { p_codigo: codigo });
  return (data as { situacao: string; estudio?: string; aluno?: string } | null) ?? { situacao: "inexistente" };
}

export async function aceitarConviteDoAluno(codigo: string): Promise<{ ok: true; estudio: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("aceitar_convite_aluno_estudio", { p_codigo: codigo });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível aceitar o convite.") };
  return { ok: true, estudio: data as string };
}

// ─── Link de alunos do estúdio (decisão 95) ───────────────────────────────────

/** O link geral do estúdio para novos alunos se cadastrarem (novo = true troca por outro). */
export async function linkDeAlunos(estudioId: string, novo = false): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("link_alunos_estudio", { p_estudio: estudioId, p_novo: novo });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível gerar o link. Se continuar, avise a equipe do P-Bell.") };
  return { ok: true, link: `${await origemDoSite()}/estudio/entrar/${data}` };
}

export async function verLinkDeAlunos(codigo: string): Promise<{ situacao: string; estudio?: string }> {
  if (!/^[a-f0-9]{16,64}$/.test(codigo ?? "")) return { situacao: "inexistente" };
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.rpc("ver_link_alunos_estudio", { p_codigo: codigo });
  return (data as { situacao: string; estudio?: string } | null) ?? { situacao: "inexistente" };
}

export async function entrarPeloLinkDeAlunos(codigo: string): Promise<{ ok: true; estudio: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.rpc("entrar_pelo_link_alunos", { p_codigo: codigo });
  if (error || !data) return { ok: false, erro: doBanco(error?.message, "Não foi possível entrar no estúdio.") };
  return { ok: true, estudio: data as string };
}

// ─── Regras (coordenação) ───────────────────────────────────────────────────

export async function salvarRegrasDosAlunos(estudioId: string, faltaH: number, marcarH: number, validadeDias: number): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("salvar_regras_alunos_estudio", {
    p_estudio: estudioId,
    p_falta_h: faltaH,
    p_marcar_h: marcarH,
    p_validade: validadeDias,
  });
  return error ? { ok: false, erro: doBanco(error.message, "Não foi possível salvar as regras.") } : { ok: true };
}

/** Antecedência para marcar reposição (null: migração 38 ainda não rodada). */
export async function lerAntecedenciaParaMarcar(estudioId: string): Promise<number | null> {
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.from("estudios").select("antecedencia_marcar_h").eq("id", estudioId).maybeSingle();
  return error || !data ? null : data.antecedencia_marcar_h;
}

/** O treino de cada dia escrito pelo professor (decisão 73). Vazio se a migração 42 não rodou. */
export async function meuTreinoNoEstudio(estudioId: string): Promise<{ dia: number; texto: string }[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const { data, error } = await supabase.rpc("meu_treino_no_estudio", { p_estudio: estudioId });
  if (error) return [];
  return ((data ?? []) as { dia_semana: number; texto: string }[]).map((t) => ({ dia: Number(t.dia_semana), texto: t.texto }));
}
