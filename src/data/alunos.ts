"use server";

// Porta de entrada dos dados do aluno. Roda só no servidor.
//
// Hoje: não há cadastro nem login, então o "aluno atual" é sempre o aluno de
// exemplo (`src/data/exemplos/aluno-exemplo.ts`). As mudanças feitas na tela
// "Meu perfil" ficam guardadas NA MEMÓRIA do servidor: valem enquanto o
// `npm run dev` estiver ligado e voltam ao exemplo quando ele é reiniciado.
// Todo mundo que abre o site vê e edita o mesmo aluno.
//
// Quando houver login e banco de dados, troque só o conteúdo destas duas funções
// para ler e salvar o aluno que está logado. As telas continuam iguais.
//
// ATENÇÃO: funções deste arquivo podem ser chamadas pelo navegador. Hoje isso é
// aceitável porque só existe um aluno; com login, cada função precisa conferir
// que quem chama é o próprio aluno, porque o perfil tem dados privados de saúde.

import { connection } from "next/server";
import { limparAluno, problemasDoAluno, type Aluno } from "@/lib/aluno";
import { juntarComE } from "@/lib/pedido";
import { ALUNO_EXEMPLO } from "./exemplos/aluno-exemplo";

// Guardado em `globalThis` para não se perder quando o Next.js recarrega o código
// durante o desenvolvimento.
const memoria = globalThis as typeof globalThis & { __pienelAluno?: Aluno };

/** O perfil completo (público e privado) do aluno que está usando o app. */
export async function lerAlunoAtual(): Promise<Aluno> {
  await connection(); // sempre lê o valor atual, nunca uma cópia guardada do momento da compilação
  return structuredClone(memoria.__pienelAluno ?? ALUNO_EXEMPLO);
}

export type RespostaPerfil = { ok: true; aluno: Aluno } | { ok: false; erro: string };

/** Salva o perfil do aluno que está usando o app. */
export async function salvarAlunoAtual(dados: Aluno): Promise<RespostaPerfil> {
  // Confere tudo de novo aqui: o que chega do navegador não é confiável.
  const problemas = problemasDoAluno(dados);
  if (problemas.length > 0) {
    const texto = juntarComE(problemas);
    return { ok: false, erro: texto.charAt(0).toUpperCase() + texto.slice(1) + "." };
  }

  const aluno = limparAluno(dados);
  memoria.__pienelAluno = aluno;
  return { ok: true, aluno: structuredClone(aluno) };
}
