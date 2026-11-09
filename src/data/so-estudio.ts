// Profissional "só do estúdio": entrou pela equipe de um estúdio e não fez o cadastro de
// personal (primeiro acesso). Vê só as telas do estúdio: Início, Agenda e Conta.
// (Arquivo comum do servidor, sem "use server": não é chamável pelo navegador.)

import { cache } from "react";
import { souContaEmpresa } from "./conta";
import { meusEstudios } from "./estudio";
import { lerPersonalAtual } from "./profissional";

export const soNoEstudio = cache(async (): Promise<boolean> => {
  const personal = await lerPersonalAtual();
  if (!personal || personal.configurado) return false;
  if (await souContaEmpresa()) return false;
  return (await meusEstudios()).length > 0;
});

/** Telas da área do personal que o profissional só do estúdio usa. */
export function telaDoSoEstudio(caminho: string): boolean {
  const c = caminho.split("?")[0];
  return (
    c === "/agenda" ||
    ["/agenda/calendario", "/agenda/conta", "/agenda/avisos", "/agenda/estudio/", "/agenda/turma/", "/agenda/boas-vindas"].some((p) =>
      c.startsWith(p),
    )
  );
}
