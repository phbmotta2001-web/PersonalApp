// Proteção das páginas da área do personal: só abre para um personal logado.
// Aluno logado vai para o perfil dele; ninguém logado vai para Entrar.
// (Arquivo comum do servidor, sem "use server": não é chamável pelo navegador.)

import { redirect } from "next/navigation";
import type { Personal } from "@/lib/personal";
import { souContaEmpresa, tipoDaConta } from "./conta";
import { lerPersonalAtual } from "./profissional";
import { soNoEstudio, telaDoSoEstudio } from "./so-estudio";

// Quem ainda não fez o primeiro acesso vai para ele antes de qualquer outra tela.
export const PRIMEIRO_ACESSO = "/agenda/boas-vindas";

export async function exigirPersonal(voltar: string): Promise<Personal> {
  const personal = await lerPersonalAtual();
  if (personal) {
    // A conta empresarial não tem agenda particular: fica só na coordenação do estúdio.
    const doEstudio = voltar.startsWith("/estudio") || voltar.startsWith("/agenda/turma/");
    if (!personal.configurado && !doEstudio && (await souContaEmpresa())) redirect("/estudio");
    if (!personal.configurado && !voltar.startsWith(PRIMEIRO_ACESSO) && !doEstudio) {
      // Quem só trabalha no estúdio não precisa do cadastro de personal: fica nas telas do estúdio.
      if (await soNoEstudio()) {
        if (!telaDoSoEstudio(voltar)) redirect("/agenda");
      } else redirect(PRIMEIRO_ACESSO);
    }
    return personal;
  }
  if ((await tipoDaConta()) === "aluno") redirect("/perfil");
  redirect(`/entrar?voltar=${encodeURIComponent(voltar)}`);
}
