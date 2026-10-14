import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-extrabold">Página não encontrada</h1>
      <p className="max-w-sm text-ink-2">
        Este endereço não existe. Confira o link ou volte para a lista de personais.
      </p>
      <Link href="/buscar" className="font-semibold text-brand">
        Ver personais
      </Link>
    </main>
  );
}
