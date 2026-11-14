"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarPedidoDeFrequencia, decidirPedidoDeFrequencia, type PedidoDeFrequencia } from "@/data/aluno-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { Aviso } from "../Formulario";

const oQue = (p: PedidoDeFrequencia) =>
  `${p.tipo === "sair" ? "Sair da turma de" : "Entrar na turma de"} ${p.turma}${p.trocar ? `, no lugar da de ${p.trocar}` : ""}`;

/**
 * Decisão 96: pedidos de mudança de turma (trânsito livre desligado). Para a coordenação,
 * grande no Início com "Aprovar" e "Recusar"; para o aluno, "Aguardando a coordenação".
 */
export function PedidosDeFrequencia({ lista, coordenacao }: { lista: PedidoDeFrequencia[]; coordenacao: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const agir = (fazer: () => Promise<{ ok: true } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      setErro(null);
      const r = await fazer();
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3" aria-label="Pedidos de mudança de turma">
      {lista.map((p) => (
        <div key={p.id} className="flex flex-col gap-3 rounded-[22px] border-2 border-gold bg-gold-soft p-4">
          <div>
            <p className="text-[13px] font-bold tracking-wide text-gold uppercase">
              {coordenacao ? "Pedido de mudança de turma" : "Aguardando a coordenação"}
            </p>
            {coordenacao && <p className="font-display text-[22px] leading-tight font-extrabold">{p.aluno}</p>}
            <p className="mt-0.5 text-[15px] font-semibold">{oQue(p)}</p>
            <p className="text-[14px] text-ink-2">{p.estudio}</p>
          </div>
          {coordenacao ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => agir(() => decidirPedidoDeFrequencia(p.id, true))}
                className="min-h-[48px] flex-1 rounded-[13px] bg-brand px-4 font-bold text-brand-ink"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  if (confirm(`Recusar o pedido de ${p.aluno}?`)) agir(() => decidirPedidoDeFrequencia(p.id, false));
                }}
                className="min-h-[48px] flex-1 rounded-[13px] border border-line bg-surface px-4 font-bold text-bad"
              >
                Recusar
              </button>
              {p.whatsapp && (
                <a
                  href={linkWhatsapp(p.whatsapp, `Olá, ${p.aluno.split(" ")[0]}! Sobre seu pedido no ${p.estudio}: ${oQue(p).toLowerCase()}.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="grid min-h-[48px] w-full place-items-center rounded-[13px] border border-line bg-surface px-4 font-bold text-brand"
                >
                  Entrar em contato
                </a>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (confirm("Cancelar este pedido?")) agir(() => cancelarPedidoDeFrequencia(p.id));
              }}
              className="min-h-[48px] rounded-[13px] border border-line bg-surface px-4 font-bold text-bad"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      ))}
      <Aviso>{erro}</Aviso>
    </section>
  );
}
