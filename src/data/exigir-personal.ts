// Proteção das páginas da área do personal: só abre para um personal logado.
// Aluno logado vai para o perfil dele; ninguém logado vai para Entrar.
// (Arquivo comum do servidor, sem "use server": não é chamável pelo navegador.)

import { redirect } from "next/navigation";
import type { Personal } from "@/lib/personal";
import { souContaEmpresa, tipoDaConta } from "./conta";
import { souDaEquipe } from "./equipe";
import { lerPersonalAtual } from "./profissional";

// Quem ainda não fez o primeiro acesso vai para ele antes de qualquer outra tela.
export const PRIMEIRO_ACESSO = "/agenda/boas-vindas";

export async function exigirPersonal(voltar: string): Promise<Personal> {
  const personal = await lerPersonalAtual();
  if (personal) {
    // A conta empresarial não tem agenda particular: fica só na coordenação do estúdio.
    if (!personal.configurado && !voltar.startsWith("/estudio") && (await souContaEmpresa())) redirect("/estudio");
    if (!personal.configurado && !voltar.startsWith(PRIMEIRO_ACESSO) && !voltar.startsWith("/estudio")) {
      // A conta de administração é criada como personal, mas abre direto no painel da beta.
      if (await souDaEquipe()) redirect("/equipe");
      redirect(PRIMEIRO_ACESSO);
    }
    return personal;
  }
  if ((await tipoDaConta()) === "aluno") redirect("/perfil");
  redirect(`/entrar?voltar=${encodeURIComponent(voltar)}`);
}
