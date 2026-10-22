import { Suspense } from "react";
import { ColunaDaLista } from "@/components/agenda/ColunaDaLista";
import { ListaDeAlunos } from "@/components/agenda/ListaDeAlunos";
import { Carregando } from "@/components/Formulario";

// Alunos no computador: a lista à esquerda e a ficha (ou formulário) ao lado.
export default function LayoutDosAlunos({ children }: LayoutProps<"/agenda/alunos">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
      <ColunaDaLista raiz="/agenda/alunos">
        <Suspense fallback={<Carregando />}>
          <ListaDeAlunos />
        </Suspense>
      </ColunaDaLista>
      <div className="flex min-w-0 flex-1 flex-col lg:px-8 lg:py-6">{children}</div>
    </div>
  );
}
