import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormExcluirConta } from "@/components/conta/FormExcluirConta";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { tipoDaConta } from "@/data/conta";

export const metadata: Metadata = {
  title: "Excluir conta",
};

// Exclusão da própria conta (direito do titular, LGPD art. 18). Vale para aluno e personal.
export default function PaginaExcluirConta() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Excluir conta">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const tipo = await tipoDaConta();
  if (!tipo) redirect("/entrar?voltar=/conta/excluir");

  const apagados =
    tipo === "personal"
      ? ["sua conta e seus dados", "seus horários de trabalho e bloqueios", "seus convites e a ligação com todos os alunos"]
      : ["sua conta e seu perfil", "seus dados de saúde e autorizações", "a ligação com todos os seus personais"];

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <section className="flex flex-col gap-2 rounded-[20px] bg-bad/10 p-4 text-[13.5px] text-ink-2">
        <p className="font-bold text-bad">Isto apaga a sua conta do Pienel de vez</p>
        <p>Serão apagados:</p>
        <ul className="list-disc pl-5">
          {apagados.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p>
          {tipo === "personal"
            ? "Seus alunos continuam com as contas deles; só deixam de estar ligados a você."
            : "Seus personais deixam de ver o seu cadastro."}
        </p>
      </section>
      <FormExcluirConta />
    </div>
  );
}
