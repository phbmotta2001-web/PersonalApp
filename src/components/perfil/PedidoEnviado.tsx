"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Personal } from "@/data/personais";
import { AVISO_APAGAR_30_DIAS } from "@/lib/consentimento";
import { maiuscula, tratamento } from "@/lib/formato";
import { Icone } from "../Icone";

/** Tela "Pedido enviado", que cobre o perfil depois que o pedido sai. */
export function PedidoEnviado({
  personal,
  hora,
  autorizouRestricoes,
}: {
  personal: Personal;
  hora: string;
  autorizouRestricoes: boolean;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const t = tratamento(personal);
  const quem = `${t.artigo} ${t.nome}`;
  const resposta = personal.perfil.tempoResposta.replace("~", "cerca de ");

  // Leva o foco para o título, para leitores de tela anunciarem a nova tela.
  useEffect(() => titulo.current?.focus(), []);

  // Ainda não há aviso por WhatsApp/e-mail ao personal (ver src/data/pedidos.ts),
  // então esta tela não promete isso.
  const passos = [
    { feito: true, titulo: "Pedido enviado", detalhe: `Hoje, ${hora}` },
    {
      feito: false,
      titulo: `${t.nome} responde com uma proposta`,
      detalhe: `${maiuscula(t.pronome)} tem até 24 h para responder.`,
    },
    {
      feito: false,
      titulo: "Aula experimental",
      detalhe: "Sem custo. Você só paga se decidir continuar.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-app">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
        <div className="flex justify-end pt-3.5 pr-3.5">
          <Link
            href="/"
            aria-label="Fechar"
            className="grid size-11 place-items-center rounded-full hover:bg-surface-2"
          >
            <Icone nome="fechar" />
          </Link>
        </div>

        <main className="flex flex-col gap-[18px] px-[18px] pt-1 pb-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="mx-auto mt-[18px] mb-1 grid size-[72px] place-items-center rounded-full bg-brand-soft text-brand">
              <Icone nome="certo" className="size-9 [stroke-width:2.4]" />
            </div>
            <h1 ref={titulo} tabIndex={-1} className="text-[26px] font-extrabold outline-none">
              Pedido enviado
            </h1>
            <p className="max-w-[30ch] text-ink-3">
              Seu pedido foi guardado para {quem}. {maiuscula(t.pronome)} costuma responder em{" "}
              {resposta}.
            </p>
          </div>

          <ol className="rounded-[20px] border border-line bg-surface p-4">
            {passos.map((p, i) => (
              <li key={p.titulo} className="relative flex gap-3 pb-4 last:pb-0">
                {i < passos.length - 1 && (
                  <span className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-line" />
                )}
                <span
                  className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                    p.feito ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface"
                  }`}
                >
                  {p.feito && <Icone nome="certo" className="size-3.5 [stroke-width:3]" />}
                </span>
                <div>
                  <p className="text-[14.5px] font-bold">
                    {p.titulo}
                    <span className="sr-only">{p.feito ? " (feito)" : " (próximo passo)"}</span>
                  </p>
                  <p className="text-[12.5px] text-ink-3 tabular-nums">{p.detalhe}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
            <span className="mt-px text-brand">
              <Icone nome="cadeado" />
            </span>
            <div className="flex flex-col gap-1.5">
              <p>
                {autorizouRestricoes
                  ? `Você autorizou ${quem} a ver suas restrições para decidir este pedido.`
                  : `Suas restrições não foram compartilhadas: ${quem} vê que você preferiu mostrá-las só depois do aceite.`}{" "}
                Peso, altura, medidas, endereço e exames só aparecem se {t.pronome} aceitar.
              </p>
              <p>{AVISO_APAGAR_30_DIAS}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="flex min-h-[50px] items-center justify-center rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110"
            >
              Voltar ao início
            </Link>
            <Link
              href="/buscar"
              className="flex min-h-[50px] items-center justify-center rounded-[15px] border border-line bg-surface px-[18px] font-bold"
            >
              Ver outros personais
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
