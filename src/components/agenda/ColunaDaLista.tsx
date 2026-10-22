"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

/**
 * Coluna de lista do modo "lista + detalhe" (opção C). No computador fica sempre à
 * esquerda, com rolagem própria; no celular só aparece na própria página da lista
 * (`raiz`), porque lá cada tela ocupa a tela toda.
 */
export function ColunaDaLista({ raiz, children }: { raiz: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Coluna naRaiz={false}>{children}</Coluna>}>
      <ColunaNoCaminho raiz={raiz}>{children}</ColunaNoCaminho>
    </Suspense>
  );
}

function ColunaNoCaminho({ raiz, children }: { raiz: string; children: React.ReactNode }) {
  return <Coluna naRaiz={usePathname() === raiz}>{children}</Coluna>;
}

function Coluna({ naRaiz, children }: { naRaiz: boolean; children: React.ReactNode }) {
  return (
    <aside
      className={`${naRaiz ? "flex" : "hidden"} mx-auto w-full max-w-md flex-col lg:sticky lg:top-0 lg:mx-0 lg:flex lg:h-dvh lg:w-[380px] lg:max-w-none lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-surface`}
    >
      {children}
    </aside>
  );
}

/** Item da coluna que fica destacado enquanto o detalhe dele está aberto ao lado. */
export function LinkDaLista({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Link href={href} className={className}>{children}</Link>}>
      <LinkNoCaminho href={href} className={className}>
        {children}
      </LinkNoCaminho>
    </Suspense>
  );
}

function LinkNoCaminho({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const aberto = usePathname().startsWith(href);
  return (
    <Link href={href} aria-current={aberto ? "page" : undefined} className={`${className} ${aberto ? "lg:bg-brand-soft" : "lg:hover:bg-surface-2"}`}>
      {children}
    </Link>
  );
}
