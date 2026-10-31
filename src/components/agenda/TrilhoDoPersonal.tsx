"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Icone, type NomeIcone } from "../Icone";

// Decisão de 22/10/2026 (opção C, "mesa de trabalho"): no computador, as abas viram um
// trilho de ícones fixo à esquerda; a aba Online aparece aqui porque a consultoria
// online é feita quase toda no computador. No celular continua a barra de baixo.
const ABAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/agenda", rotulo: "Início", icone: "casa" },
  { href: "/agenda/calendario", rotulo: "Agenda", icone: "calendario" },
  { href: "/agenda/alunos", rotulo: "Alunos", icone: "pessoas" },
  { href: "/agenda/financeiro", rotulo: "Financeiro", icone: "dinheiro" },
  { href: "/agenda/online", rotulo: "Online", icone: "conversa" },
  { href: "/agenda/conta", rotulo: "Conta", icone: "usuario" },
];

export function TrilhoDoPersonal() {
  return (
    <Suspense fallback={<Trilho caminho="" />}>
      <TrilhoNoCaminho />
    </Suspense>
  );
}

function TrilhoNoCaminho() {
  return <Trilho caminho={usePathname()} />;
}

function Trilho({ caminho }: { caminho: string }) {
  // No primeiro acesso, só o passo a passo (sem atalhos para outras telas).
  if (caminho.startsWith("/agenda/boas-vindas")) return null;
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-y-0 left-0 z-20 hidden w-[88px] flex-col items-center gap-1.5 bg-deep py-5 text-on-deep-2 lg:flex"
    >
      <Link
        href="/agenda"
        aria-label="P-Bell"
        className="mb-4 grid size-11 place-items-center rounded-[13px] bg-lime font-display text-[20px] font-extrabold text-lime-ink"
      >
        P
      </Link>
      {ABAS.map((a) => {
        const ativa = a.href === "/agenda" ? caminho === "/agenda" : caminho.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={`flex w-[72px] flex-col items-center gap-1 rounded-[14px] py-2.5 text-[12px] font-semibold ${
              ativa ? "bg-white/12 text-on-deep" : "hover:bg-white/6 hover:text-on-deep"
            }`}
          >
            <Icone nome={a.icone} className="size-6" />
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
