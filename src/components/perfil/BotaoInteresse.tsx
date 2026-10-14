"use client";

import { useState } from "react";
import type { Personal } from "@/data/personais";
import { GavetaPedido } from "./GavetaPedido";
import { PedidoEnviado } from "./PedidoEnviado";

/** Botão "Tenho interesse": abre o formulário do pedido e, depois, a tela de confirmação. */
export function BotaoInteresse({ personal }: { personal: Personal }) {
  const [aberta, setAberta] = useState(false);
  const [horaEnvio, setHoraEnvio] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="min-h-[50px] rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110"
      >
        Tenho interesse
      </button>

      <GavetaPedido
        personal={personal}
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        aoEnviar={() => {
          setAberta(false);
          setHoraEnvio(
            new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          );
        }}
      />

      {horaEnvio && <PedidoEnviado personal={personal} hora={horaEnvio} />}
    </>
  );
}
