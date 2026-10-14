"use server";

// Recebe os pedidos feitos no botão "Tenho interesse". Roda no servidor, nunca
// no navegador da aluna.
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  AINDA NÃO ENVIA DE VERDADE: o pedido só é conferido e anotado no     ║
// ║  terminal. Falta salvar no banco de dados e avisar o personal no      ║
// ║  WhatsApp — e a tela "Pedido enviado" já diz que ele foi avisado.     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { perfilPublico, rotuloNivel } from "@/lib/aluno";
import { juntarComE, oQueFalta, type Pedido } from "@/lib/pedido";
import { lerAlunoAtual } from "./alunos";
import { buscarPersonal } from "./personais";

export type RespostaPedido = { ok: true } | { ok: false; erro: string };

export async function enviarPedido(pedido: Pedido): Promise<RespostaPedido> {
  // Confere tudo de novo aqui: o que chega do navegador não é confiável.
  const personal = await buscarPersonal(pedido?.slug);
  if (!personal) return { ok: false, erro: "Este personal não foi encontrado." };

  const falta = oQueFalta(pedido, personal);
  if (falta.length > 0) return { ok: false, erro: `Para enviar, escolha ${juntarComE(falta)}.` };

  // O perfil vem do servidor, não do navegador. Só a parte PÚBLICA vai junto:
  // medidas, fotos e exames ficam de fora até o personal aceitar o pedido.
  const aluno = perfilPublico(await lerAlunoAtual());

  // TODO: salvar o pedido no banco de dados e avisar o personal no WhatsApp.
  console.log(`[EXEMPLO] Pedido para ${personal.nome} (ainda não é salvo nem enviado):`, {
    aluno: { ...aluno, nivel: rotuloNivel(aluno.nivel) },
    vezesPorSemana: pedido.vezesPorSemana,
    dias: pedido.dias,
    periodos: pedido.periodos,
    locais: pedido.locais,
    mensagem: pedido.mensagem,
  });

  return { ok: true };
}
