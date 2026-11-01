import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormNovaSenha } from "@/components/conta/FormNovaSenha";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { usuarioAtual } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Senha nova",
};

export default function PaginaNovaSenha() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Criar senha nova" />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

// Só abre com a sessão criada pelo link do e-mail (ou com a conta já aberta neste navegador).
async function Conteudo() {
  const { id } = await usuarioAtual();
  if (id) return <FormNovaSenha />;
  return (
    <div className="flex flex-col gap-3 px-[18px] pt-2 pb-6 text-ink-2">
      <p>Este link venceu ou já foi usado. Peça um novo para criar sua senha.</p>
      <Link href="/esqueci-senha" className="font-semibold text-brand">
        Pedir outro link
      </Link>
    </div>
  );
}
