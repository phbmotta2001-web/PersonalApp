// Proteção das páginas da área do personal: só abre para um personal logado.
// Aluno logado vai para o perfil dele; ninguém logado vai para Entrar.
// (Arquivo comum do servidor, sem "use server": não é chamável pelo navegador.)

import { redirect } from "next/navigation";
import type { Personal } from "@/lib/personal";
import { tipoDaConta } from "./conta";
import { lerPersonalAtual } from "./profissional";

export async function exigirPersonal(voltar: string): Promise<Personal> {
  const personal = await lerPersonalAtual();
  if (personal) return personal;
  if ((await tipoDaConta()) === "aluno") redirect("/perfil");
  redirect(`/entrar?voltar=${encodeURIComponent(voltar)}`);
}
