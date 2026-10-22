"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirConta } from "@/data/conta";
import { Aviso, Campo, ESTILO_CAIXA } from "../Formulario";

/** Confirmação da exclusão: senha de novo + "entendo que não tem volta". */
export function FormExcluirConta() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [entendi, setEntendi] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await excluirConta(senha);
          if (!r.ok) return setErro(r.erro);
          router.replace("/");
          router.refresh();
        });
      }}
      className="flex flex-col gap-4"
    >
      <Campo id="ex-senha" rotulo="Digite sua senha para confirmar">
        <input
          id="ex-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => {
            setErro(null);
            setSenha(e.target.value);
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <label className="flex items-start gap-3 text-[14px] text-ink-2">
        <input
          type="checkbox"
          checked={entendi}
          onChange={(e) => setEntendi(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--bad)]"
        />
        Entendo que a exclusão é imediata e não pode ser desfeita.
      </label>
      <Aviso>{erro}</Aviso>
      <button
        type="submit"
        disabled={!senha || !entendi || ocupado}
        className="flex min-h-[50px] w-full items-center justify-center rounded-[15px] bg-bad px-[18px] font-bold text-white disabled:opacity-50"
      >
        {ocupado ? "Excluindo…" : "Excluir minha conta"}
      </button>
    </form>
  );
}
