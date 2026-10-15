// Proteção das páginas da área do aluno: só abre para um aluno logado.
// Personal logado vai para a agenda; ninguém logado vai para Entrar.
// (Arquivo comum do servidor, sem "use server": não é chamável pelo navegador.)

import { redirect } from "next/navigation";
import type { ContaAluno } from "@/lib/aluno";
import { lerContaAtual } from "./alunos";
import { tipoDaConta } from "./conta";

export async function exigirAluno(voltar: string): Promise<ContaAluno> {
  const conta = await lerContaAtual();
  if (conta) return conta;
  if ((await tipoDaConta()) === "personal") redirect("/agenda");
  redirect(`/entrar?voltar=${encodeURIComponent(voltar)}`);
}
