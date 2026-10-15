import type { Metadata } from "next";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormCadastroPersonal } from "@/components/conta/FormCadastroPersonal";
import { Cabecalho } from "@/components/Formulario";

export const metadata: Metadata = {
  title: "Criar conta de personal",
};

// Fase 1: o cadastro aberto é só para personais. O aluno cria a conta pelo link de
// convite do personal (etapa 2), que vai reaproveitar src/components/conta/FormCadastro.tsx.
export default function PaginaCadastro() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Criar conta de personal">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <FormCadastroPersonal />
    </div>
  );
}
