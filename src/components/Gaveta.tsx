"use client";

import { useEffect, useId, useRef } from "react";
import { Icone } from "./Icone";

/** Gaveta que sobe da parte de baixo da tela (usada nos filtros e no pedido). */
export function Gaveta({
  aberta,
  aoFechar,
  titulo,
  rodape,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  rodape: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberta && !dialogo.open) dialogo.showModal();
    if (!aberta && dialogo.open) dialogo.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      // Clicar no fundo escuro (fora da gaveta) fecha
      onClick={(e) => e.target === ref.current && aoFechar()}
      className="fixed inset-x-0 top-auto bottom-0 mx-auto my-0 max-h-[90dvh] w-full max-w-md rounded-t-[26px] bg-surface p-0 text-ink backdrop:bg-black/50 open:flex open:flex-col"
    >
      <div className="mx-auto mt-2.5 mb-1 h-[5px] w-[42px] shrink-0 rounded bg-line" />
      <div className="flex shrink-0 items-center gap-2 py-1.5 pr-2.5 pl-5">
        <h3 id={idTitulo} className="flex-1 text-[19px] font-semibold">
          {titulo}
        </h3>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <Icone nome="fechar" />
        </button>
      </div>

      <div className="flex flex-col gap-[18px] overflow-y-auto px-5 pt-1.5 pb-5">{children}</div>

      <div className="shrink-0 border-t border-line px-5 pt-3 pb-4">{rodape}</div>
    </dialog>
  );
}

/** Um bloco de opções dentro da gaveta, com título (ex.: "Objetivo"). */
export function GrupoDaGaveta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-[7px]">
      <legend className="mb-[7px] text-[14px] font-bold text-ink-2">{titulo}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
