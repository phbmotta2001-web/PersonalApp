"use client";

import { useState, useTransition } from "react";
import { definirNovaSenha } from "@/data/conta";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Depois do link do e-mail: cria a senha nova e abre a área de cada tipo de conta. */
export function FormNovaSenha() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          try {
            const r = await definirNovaSenha(senha);
            if (!r.ok) return setErro(r.erro);
            // Página de passagem: leva cada tipo de conta para a sua área.
            window.location.replace("/inicio");
          } catch {
            setErro("Não foi possível salvar agora. Confira sua internet e tente de novo.");
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      <Campo id="ns-senha" rotulo="Senha nova" ajuda="Pelo menos 8 caracteres.">
        <input
          id="ns-senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => {
            setErro(null);
            setSenha(e.target.value);
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Aviso>{erro}</Aviso>
      <button type="submit" disabled={salvando || senha.length < 8} className={ESTILO_BOTAO_PRINCIPAL}>
        {salvando ? "Salvando…" : "Salvar senha nova"}
      </button>
    </form>
  );
}
