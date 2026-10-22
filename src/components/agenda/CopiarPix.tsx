"use client";

import { useState } from "react";

/** Pix copia e cola com botão de copiar e o QR Code (para pagar de outro aparelho). */
export function CopiarPix({ codigo, qrSvg }: { codigo: string; qrSvg: string }) {
  const [copiado, setCopiado] = useState(false);
  const [mostrarQr, setMostrarQr] = useState(false);

  return (
    <section className="flex flex-col gap-2 rounded-[16px] border border-line bg-surface p-3">
      <p className="text-[14px] font-bold text-ink-2">Pix copia e cola</p>
      <p className="max-h-16 overflow-hidden text-[12.5px] break-all text-ink-3">{codigo}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(codigo);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              setCopiado(false);
            }
          }}
          className="flex-1 rounded-[12px] bg-brand px-3 py-2.5 text-[14px] font-bold text-brand-ink"
        >
          {copiado ? "Copiado!" : "Copiar código Pix"}
        </button>
        <button
          type="button"
          aria-expanded={mostrarQr}
          onClick={() => setMostrarQr(!mostrarQr)}
          className="rounded-[12px] border border-line px-3 py-2.5 text-[14px] font-bold"
        >
          {mostrarQr ? "Esconder QR" : "Ver QR Code"}
        </button>
      </div>
      {mostrarQr && (
        <div
          className="mx-auto w-full max-w-[240px] rounded-[12px] bg-white p-2"
          role="img"
          aria-label="QR Code do Pix"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      )}
    </section>
  );
}
