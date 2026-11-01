import type { Metadata } from "next";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormEsqueciSenha } from "@/components/conta/FormEsqueciSenha";
import { Cabecalho } from "@/components/Formulario";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
};

export default function PaginaEsqueciSenha() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Esqueci minha senha">
        <BotaoVoltar reserva="/entrar" className="hover:bg-surface-2" />
      </Cabecalho>
      <FormEsqueciSenha />
    </div>
  );
}
