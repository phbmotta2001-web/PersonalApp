import Link from "next/link";
import { Icone } from "@/components/Icone";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight text-brand sm:text-7xl">Pienel</h1>
      <p className="max-w-md text-lg text-ink-2">
        Encontre o personal trainer ideal para os seus objetivos.
      </p>
      <Link
        href="/buscar"
        className="inline-flex min-h-[50px] items-center gap-2 rounded-[15px] bg-brand px-5 font-bold text-brand-ink hover:brightness-110"
      >
        <Icone nome="busca" />
        Buscar personais
      </Link>
      <Link href="/perfil" className="inline-flex items-center gap-1.5 font-semibold text-brand">
        <Icone nome="usuario" />
        Meu perfil
      </Link>
    </main>
  );
}
