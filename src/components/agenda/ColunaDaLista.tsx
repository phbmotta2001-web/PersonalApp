"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

/**
 * Coluna de lista do modo "lista + detalhe" (opção C). No computador fica sempre à
 * esquerda, com rolagem própria; no celular só aparece na própria página da lista
 * (`raiz`), porque lá cada tela ocupa a tela toda.
 */
export function ColunaDaLista({ raiz, larga = false, children }: { raiz: string; larga?: boolean; children: React.ReactNode }) {
  return (
    <Suspense fallback={<Coluna naRaiz={false} larga={false}>{children}</Coluna>}>
      <ColunaNoCaminho raiz={raiz} larga={larga}>
        {children}
      </ColunaNoCaminho>
    </Suspense>
  );
}

function ColunaNoCaminho({ raiz, larga, children }: { raiz: string; larga: boolean; children: React.ReactNode }) {
  return (
    <Coluna naRaiz={usePathname() === raiz} larga={larga}>
      {children}
    </Coluna>
  );
}

/**
 * Com `larga`, no computador e sem nenhum item aberto, a lista ocupa a tela toda (em colunas);
 * com um item aberto, vira a coluna da esquerda, mais larga (440px) para caber o nome inteiro.
 */
function Coluna({ naRaiz, larga, children }: { naRaiz: boolean; larga: boolean; children: React.ReactNode }) {
  const cheia = larga && naRaiz;
  return (
    <aside
      data-larga={cheia ? "" : undefined}
      className={`${naRaiz ? "flex" : "hidden"} group/coluna mx-auto w-full max-w-md flex-col lg:mx-0 lg:flex lg:max-w-none ${
        cheia
          ? "lg:min-h-dvh lg:flex-1 lg:px-6"
          : `lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-line lg:bg-surface ${larga ? "lg:w-[440px]" : "lg:w-[380px]"}`
      }`}
    >
      {children}
    </aside>
  );
}

/** O detalhe ao lado da lista: com a lista larga, no computador some enquanto nada está aberto. */
export function DetalheDaLista({ raiz, children }: { raiz: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-w-0 flex-1 flex-col lg:px-8 lg:py-6">{children}</div>}>
      <DetalheNoCaminho raiz={raiz}>{children}</DetalheNoCaminho>
    </Suspense>
  );
}

function DetalheNoCaminho({ raiz, children }: { raiz: string; children: React.ReactNode }) {
  const naRaiz = usePathname() === raiz;
  return <div className={`flex min-w-0 flex-1 flex-col lg:px-8 lg:py-6 ${naRaiz ? "lg:hidden" : ""}`}>{children}</div>;
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
