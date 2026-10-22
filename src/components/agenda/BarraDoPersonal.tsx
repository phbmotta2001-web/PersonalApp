"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Icone, type NomeIcone } from "../Icone";

// Decisão de 22/10/2026: cinco abas (a Agenda vem logo depois do Início, mais perto do polegar).
const ABAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/agenda", rotulo: "Início", icone: "casa" },
  { href: "/agenda/calendario", rotulo: "Agenda", icone: "calendario" },
  { href: "/agenda/alunos", rotulo: "Alunos", icone: "pessoas" },
  { href: "/agenda/financeiro", rotulo: "Financeiro", icone: "dinheiro" },
  { href: "/agenda/conta", rotulo: "Conta", icone: "usuario" },
];

/** Barra fixa embaixo com as abas do personal (como num app). */
export function BarraDoPersonal() {
  return (
    <Suspense fallback={<Barra caminho="" />}>
      <BarraNoCaminho />
    </Suspense>
  );
}

function BarraNoCaminho() {
  return <Barra caminho={usePathname()} />;
}

function Barra({ caminho }: { caminho: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ABAS.map((a) => {
          const ativa = a.href === "/agenda" ? caminho === "/agenda" : caminho.startsWith(a.href);
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`aba-macia flex min-h-[64px] flex-col items-center justify-center gap-1 pt-2.5 pb-2 text-[13px] ${
                  ativa ? "font-bold text-brand" : "font-semibold text-ink-3"
                }`}
              >
                <Icone nome={a.icone} className="size-7" />
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
