"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "../Icone";

const ABAS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/agenda", rotulo: "Início", icone: "casa" },
  { href: "/agenda/alunos", rotulo: "Alunos", icone: "pessoas" },
  { href: "/agenda/calendario", rotulo: "Agenda", icone: "calendario" },
  { href: "/agenda/conta", rotulo: "Minha conta", icone: "usuario" },
];

/** Barra fixa embaixo com as quatro abas do personal (como num app). */
export function BarraDoPersonal() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ABAS.map((a) => {
          const ativa = a.href === "/agenda" ? caminho === "/agenda" : caminho.startsWith(a.href);
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] ${
                  ativa ? "font-bold text-brand" : "font-semibold text-ink-3"
                }`}
              >
                <Icone nome={a.icone} className="size-6" />
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
