import type { Metadata } from "next";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { Icone } from "@/components/Icone";

export const metadata: Metadata = {
  title: "Alunos",
};

// Aba "Alunos": a lista vem do layout (no celular ocupa a tela; no computador fica à
// esquerda). Aqui, no computador, só o convite para escolher um aluno.
export default function PaginaAlunos() {
  return (
    <>
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center text-ink-3 lg:flex lg:min-h-[70dvh]">
        <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
          <Icone nome="pessoas" className="size-8" />
        </span>
        <p className="text-[17px] font-semibold text-ink-2">Escolha um aluno na lista para ver a ficha.</p>
        <p className="text-[14px]">Ou use &quot;Novo aluno&quot; para convidar ou cadastrar.</p>
      </div>
      <div className="pb-32 lg:hidden" />
      <BarraDoPersonal />
    </>
  );
}
