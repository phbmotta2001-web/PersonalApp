import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPerfilAluno } from "@/components/aluno/FormPerfilAluno";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { lerAlunoAtual } from "@/data/alunos";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default function PaginaPerfilAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-center gap-2.5 pt-3.5 pr-3.5 pb-2 pl-2">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
        <h1 className="text-[21px] font-semibold">Meu perfil</h1>
      </header>
      {/* O perfil é lido a cada visita, então a tela mostra "Carregando…" por um instante. */}
      <Suspense fallback={<p className="px-[18px] py-6 text-sm text-ink-3">Carregando…</p>}>
        <Formulario />
      </Suspense>
    </div>
  );
}

async function Formulario() {
  const aluno = await lerAlunoAtual();
  return <FormPerfilAluno inicial={aluno} />;
}
