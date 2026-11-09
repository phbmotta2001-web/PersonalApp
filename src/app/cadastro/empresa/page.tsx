import type { Metadata } from "next";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormCadastroEmpresa } from "@/components/conta/FormCadastroEmpresa";
import { Cabecalho } from "@/components/Formulario";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";

export const metadata: Metadata = {
  title: "Criar conta empresarial",
};

// Conta empresarial (estúdio ou academia de rede): abre na coordenação do estúdio.
export default function PaginaCadastroEmpresa() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Criar conta empresarial">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <FormCadastroEmpresa termos={TERMOS_PUBLICADOS} />
    </div>
  );
}
