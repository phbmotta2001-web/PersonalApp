"use client";

import { useEffect, useState } from "react";
import { salvarInscricaoPush, type InscricaoPush } from "@/data/push";
import { Aviso } from "./Formulario";
import { Icone } from "./Icone";

const CHAVE = "kout-notificacoes-dispensado";

type Modo = "escondido" | "pedir" | "bloqueado";

/** A chave pública do push vem em base64url; o navegador quer os bytes. */
function bytesDaChave(base64: string): Uint8Array<ArrayBuffer> {
  const preenchido = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const texto = atob(preenchido);
  const bytes = new Uint8Array(new ArrayBuffer(texto.length));
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

/**
 * Convite para ligar as notificações (etapa 4b). Só aparece quando o aparelho aceita
 * notificações e ainda não ligou; no iPhone, só com o Kout instalado na tela de início.
 * Quando já está ligado, não mostra nada e só confirma a inscrição no servidor.
 */
export function AtivarNotificacoes({ texto }: { texto: string }) {
  const [modo, setModo] = useState<Modo>("escondido");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const chavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!chavePublica || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let ativo = true;
    navigator.serviceWorker.ready
      .then((registro) => registro.pushManager.getSubscription())
      .then((inscricao) => {
        if (!ativo) return;
        if (inscricao) {
          // Já ligado: garante que o servidor conhece este aparelho (ex.: depois de trocar de conta).
          void salvarInscricaoPush(inscricao.toJSON() as InscricaoPush);
          return;
        }
        let dispensado = false;
        try {
          dispensado = localStorage.getItem(CHAVE) === "1";
        } catch {
          // Armazenamento bloqueado: mostra normalmente.
        }
        if (Notification.permission === "denied") setModo(dispensado ? "escondido" : "bloqueado");
        else if (!dispensado) setModo("pedir");
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [chavePublica]);

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {
      // Sem armazenamento: só esconde por agora.
    }
    setModo("escondido");
  };

  const ligar = async () => {
    if (!chavePublica) return;
    setErro(null);
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setModo(permissao === "denied" ? "bloqueado" : "pedir");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytesDaChave(chavePublica),
      });
      const r = await salvarInscricaoPush(inscricao.toJSON() as InscricaoPush);
      if (!r.ok) return setErro(r.erro);
      setModo("escondido");
    } catch {
      setErro("Não foi possível ligar as notificações agora. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  if (modo === "escondido") return null;

  return (
    <section className="flex items-start gap-3 rounded-[20px] border border-brand bg-brand-soft p-4" aria-label="Notificações">
      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-brand text-brand-ink">
        <Icone nome="sino" className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[15px] font-bold text-brand">
          {modo === "pedir" ? "Ligue as notificações" : "As notificações estão bloqueadas"}
        </p>
        <p className="text-[14px] text-ink-2">
          {modo === "pedir"
            ? texto
            : "Para receber os avisos, libere as notificações do Kout nos ajustes do celular."}
        </p>
        <Aviso>{erro}</Aviso>
        <div className="flex gap-2">
          {modo === "pedir" && (
            <button
              type="button"
              onClick={ligar}
              disabled={ocupado}
              className="rounded-[11px] bg-brand px-3 py-2 text-[14px] font-bold text-brand-ink disabled:opacity-60"
            >
              {ocupado ? "Ligando…" : "Ligar notificações"}
            </button>
          )}
          <button type="button" onClick={dispensar} className="rounded-[11px] px-3 py-2 text-[14px] font-semibold text-ink-2">
            {modo === "pedir" ? "Agora não" : "Entendi"}
          </button>
        </div>
      </div>
    </section>
  );
}
