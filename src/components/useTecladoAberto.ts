"use client";

import { useEffect, useState } from "react";

// Decisão 118: no iPhone (app instalado), quando o teclado numérico fecha, a barra de abas fixa às vezes
// fica presa no meio da tela, na altura onde o teclado estava. A barra some enquanto o teclado está aberto
// e, quando ele fecha, um pequeno "empurrão" na rolagem faz o iPhone recalcular a posição.

const TIPOS_SEM_TECLADO = ["checkbox", "radio", "button", "submit", "reset", "range", "file", "color", "image"];

function abreTeclado(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !TIPOS_SEM_TECLADO.includes((el as HTMLInputElement).type);
}

function reposicionar() {
  const y = window.scrollY;
  window.scrollTo(window.scrollX, y + 1);
  window.scrollTo(window.scrollX, y);
}

export function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const aoFocar = (e: FocusEvent) => {
      if (abreTeclado(e.target as Element)) {
        window.clearTimeout(timer);
        setAberto(true);
      }
    };
    const aoSair = (e: FocusEvent) => {
      if (!abreTeclado(e.target as Element)) return;
      // Espera um pouco: pulando de um campo para o outro, o teclado continua aberto.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (abreTeclado(document.activeElement)) return;
        setAberto(false);
        reposicionar();
      }, 120);
    };
    const vv = window.visualViewport;
    const aoRedimensionar = () => {
      if (vv && vv.height > window.innerHeight * 0.85 && !abreTeclado(document.activeElement)) reposicionar();
    };
    document.addEventListener("focusin", aoFocar);
    document.addEventListener("focusout", aoSair);
    vv?.addEventListener("resize", aoRedimensionar);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", aoSair);
      vv?.removeEventListener("resize", aoRedimensionar);
    };
  }, []);
  return aberto;
}
