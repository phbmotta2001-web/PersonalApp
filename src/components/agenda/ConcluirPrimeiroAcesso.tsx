"use client";

import { useState, useTransition } from "react";
import { concluirConfiguracao } from "@/data/profissional";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { soltarConfete } from "@/lib/confete";

/** Último passo do primeiro acesso: marca a conta como configurada e abre a agenda. */
export function ConcluirPrimeiroAcesso() {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={(e) => {
          soltarConfete(e.currentTarget);
          iniciar(async () => {
            try {
              // Dando certo, o servidor já abre a agenda; só volta aqui com um erro.
              const r = await concluirConfiguracao();
              setErro(r.erro);
            } catch {
              setErro("Não foi possível salvar agora. Confira sua internet.");
            }
          });
        }}
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Abrindo…" : "Abrir minha agenda"}
      </button>
    </div>
  );
}
