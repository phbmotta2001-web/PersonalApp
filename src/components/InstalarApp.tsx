"use client";

import { useEffect, useState } from "react";
import { Icone } from "./Icone";

// O evento que o Chrome (Android e computador) dispara quando dá para instalar.
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE = "pienel-instalar-dispensado";

type Modo = "escondido" | "botao" | "iphone";

/**
 * Convite para instalar o Pienel na tela de início (etapa 4). Aparece uma vez por
 * aparelho, some quando o app já está instalado ou quando a pessoa dispensa.
 * Android/Chrome: botão que abre a instalação. iPhone: passo a passo (a Apple não
 * deixa botão de instalar).
 */
export function InstalarApp() {
  const [modo, setModo] = useState<Modo>("escondido");
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dispensado = false;
    try {
      dispensado = localStorage.getItem(CHAVE) === "1";
    } catch {
      // Navegação anônima ou armazenamento bloqueado: mostra normalmente.
    }
    if (instalado || dispensado) return;

    const ua = navigator.userAgent;
    const iphone = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    // No iPhone o evento não existe; mostra o passo a passo (o estado muda fora do render).
    const quadro = iphone ? requestAnimationFrame(() => setModo("iphone")) : 0;

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setModo("botao");
    };
    const aoInstalar = () => setModo("escondido");
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {
      // Sem armazenamento: só esconde por agora.
    }
    setModo("escondido");
  };

  if (modo === "escondido") return null;

  return (
    <section className="flex items-start gap-3 rounded-[20px] border border-brand bg-brand-soft p-4" aria-label="Instalar o Pienel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icones/icone-192.png" alt="" className="size-11 shrink-0 rounded-[12px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[15px] font-bold text-brand">Instale o Pienel no seu celular</p>
        {modo === "botao" ? (
          <p className="text-[14px] text-ink-2">Abre com um toque, em tela cheia, como um app.</p>
        ) : (
          <p className="text-[14px] text-ink-2">
            No Safari, toque em <strong>Compartilhar</strong>{" "}
            <Icone nome="compartilhar" className="inline size-4 align-text-bottom" /> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
        )}
        <div className="flex gap-2">
          {modo === "botao" && evento && (
            <button
              type="button"
              onClick={async () => {
                await evento.prompt();
                const { outcome } = await evento.userChoice;
                if (outcome === "accepted") setModo("escondido");
              }}
              className="rounded-[11px] bg-brand px-3 py-2 text-[14px] font-bold text-brand-ink"
            >
              Instalar o Pienel
            </button>
          )}
          <button type="button" onClick={dispensar} className="rounded-[11px] px-2 py-2 text-[14px] font-semibold text-ink-3">
            Agora não
          </button>
        </div>
      </div>
    </section>
  );
}
