"use server";

// Pedidos feitos no botão "Tenho interesse". Roda só no servidor.
// O pedido é gravado no Supabase pela função enviar_pedido do banco, que copia as
// restrições do PERFIL guardado (nunca do navegador) e só se o aluno autorizar.
//
// Ainda não existe o lado do personal nem o aviso por WhatsApp/e-mail: o pedido
// fica guardado e pode ser visto em /dev/visao-personal (só no computador de quem
// desenvolve). Quando existir, o WhatsApp leva só "Você recebeu um novo pedido,
// abra o app" — nunca dados de saúde.

import { perfilProntoParaPedido } from "@/lib/aluno";
import { personalAtendeAluno } from "@/lib/filtros";
import { juntarComE, maiuscula, tratamento } from "@/lib/formato";
import { oQueFalta, type Pedido } from "@/lib/pedido";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { lerContaAtual } from "./alunos";
import type { Resposta } from "./conta";
import { buscarPersonal, type Personal } from "./personais";

export type SituacaoPedido =
  | { estado: "entrar" }
  | { estado: "completar-perfil" }
  | { estado: "nao-atende"; mensagem: string }
  | { estado: "pronto"; consentimentoSaude: boolean; temRestricoes: boolean };

function avisoNaoAtende(personal: Personal): string {
  const t = tratamento(personal);
  const especializado = personal.genero === "f" ? "especializada" : "especializado";
  return `${maiuscula(t.artigo)} ${t.nome} é ${especializado} em treino ${personal.publico} e não recebe pedidos com o gênero informado no seu perfil.`;
}

/** Antes de abrir o formulário: o aluno pode pedir para este personal? */
export async function situacaoParaPedido(slug: string): Promise<SituacaoPedido> {
  const conta = await lerContaAtual();
  if (!conta) return { estado: "entrar" };
  if (!perfilProntoParaPedido(conta.perfil)) return { estado: "completar-perfil" };

  const personal = await buscarPersonal(slug);
  if (personal && !personalAtendeAluno(personal.publico, conta.perfil.genero))
    return { estado: "nao-atende", mensagem: avisoNaoAtende(personal) };

  return {
    estado: "pronto",
    consentimentoSaude: conta.consentimentoSaude,
    temRestricoes: conta.consentimentoSaude && conta.saude.restricoes.trim().length > 0,
  };
}

export async function enviarPedido(pedido: Pedido): Promise<Resposta> {
  // Confere tudo de novo aqui: o que chega do navegador não é confiável.
  const conta = await lerContaAtual();
  if (!conta) return { ok: false, erro: "Entre na sua conta para enviar o pedido." };
  if (!perfilProntoParaPedido(conta.perfil))
    return { ok: false, erro: "Preencha seu objetivo e seu nível no perfil antes de enviar." };

  const personal = await buscarPersonal(pedido?.slug);
  if (!personal) return { ok: false, erro: "Este personal não foi encontrado." };
  if (!personalAtendeAluno(personal.publico, conta.perfil.genero))
    return { ok: false, erro: avisoNaoAtende(personal) };

  const falta = oQueFalta(pedido, personal);
  if (falta.length > 0) return { ok: false, erro: `Para enviar, escolha ${juntarComE(falta)}.` };

  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("enviar_pedido", {
    p_personal_slug: personal.slug,
    p_vezes_por_semana: pedido.vezesPorSemana,
    p_dias: pedido.dias,
    p_periodos: pedido.periodos,
    p_locais: pedido.locais,
    p_mensagem: pedido.mensagem,
    p_autorizar_restricoes: pedido.autorizarRestricoes,
  });

  return error ? { ok: false, erro: "Não foi possível enviar o pedido. Tente de novo." } : { ok: true };
}
