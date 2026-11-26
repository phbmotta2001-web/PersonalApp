import { Suspense } from "react";
import { ColunaDaLista, DetalheDaLista } from "@/components/agenda/ColunaDaLista";
import { ListaDeAlunos } from "@/components/agenda/ListaDeAlunos";
import { Carregando } from "@/components/Formulario";

// Alunos no computador: sem aluno aberto, a lista ocupa a tela; com um aberto, a lista à esquerda e a ficha ao lado.
export default function LayoutDosAlunos({ children }: LayoutProps<"/agenda/alunos">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
      <ColunaDaLista raiz="/agenda/alunos" larga>
        <Suspense fallback={<Carregando />}>
          <ListaDeAlunos />
        </Suspense>
      </ColunaDaLista>
      <DetalheDaLista raiz="/agenda/alunos">{children}</DetalheDaLista>
    </div>
  );
}
