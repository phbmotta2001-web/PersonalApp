import { Suspense } from "react";
import { ColunaDaLista } from "@/components/agenda/ColunaDaLista";
import { Carregando } from "@/components/Formulario";
import { ListaOnline } from "@/components/online/ListaOnline";

// Consultoria online no computador: alunos online à esquerda, o acompanhamento ao lado.
// No celular a lista vem depois do topo da página (questionários e envios pendentes).
export default function LayoutOnline({ children }: LayoutProps<"/agenda/online">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row-reverse lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col lg:px-8 lg:py-6">{children}</div>
      <ColunaDaLista raiz="/agenda/online">
        <Suspense fallback={<Carregando />}>
          <ListaOnline />
        </Suspense>
      </ColunaDaLista>
    </div>
  );
}
