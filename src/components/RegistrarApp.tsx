"use client";

import { useEffect } from "react";

/** Liga o service worker (tela "sem internet" do app instalado). Não desenha nada. */
export function RegistrarApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker o site funciona igual; só perde a tela "sem internet".
    });
  }, []);
  return null;
}
