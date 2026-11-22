"use client";

import Link from "next/link";
import { useEffect } from "react";

// Quando algo falha (internet caiu no meio de um salvamento, por exemplo), mostra uma tela em
// português com o caminho de volta, no lugar da tela de erro padrão.
export default function TelaDeErro({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-display text-[26px] leading-tight font-extrabold">Algo não deu certo</p>
      <p className="text-[15.5px] text-ink-2">Confira sua internet e tente de novo. Se acabou de salvar algo, confira se ficou salvo.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-12 w-full rounded-[14px] bg-brand text-[15.5px] font-bold text-brand-ink"
      >
        Tentar de novo
      </button>
      <Link href="/" className="text-[15px] font-semibold text-brand">
        Voltar para o início
      </Link>
    </div>
  );
}
