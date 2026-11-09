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

/** Barra fixa embaixo com as abas do personal (como num app). No computador, o TrilhoDoPersonal. */

// Quem só trabalha no estúdio (sem cadastro de personal) vê só Início, Agenda e Conta.
const DO_ESTUDIO = ["/agenda", "/agenda/calendario", "/agenda/conta"];
export function BarraCliente({ soEstudio }: { soEstudio: boolean }) {
  return (
    <Suspense fallback={<Barra caminho="" soEstudio={soEstudio} />}>
      <BarraNoCaminho soEstudio={soEstudio} />
    </Suspense>
  );
}

function BarraNoCaminho({ soEstudio }: { soEstudio: boolean }) {
  return <Barra caminho={usePathname()} soEstudio={soEstudio} />;
}

function Barra({ caminho, soEstudio }: { caminho: string; soEstudio: boolean }) {
  const abas = soEstudio ? ABAS.filter((a) => DO_ESTUDIO.includes(a.href)) : ABAS;
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t lg:hidden border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}>
        {abas.map((a) => {
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
