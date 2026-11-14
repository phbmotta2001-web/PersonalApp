import type { Metadata } from "next";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { FormulariosDoEstudio } from "@/components/estudio/FormulariosDoEstudio";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerFormulariosDoPersonal } from "@/data/formularios-personal";

export const metadata: Metadata = {
  title: "ParQ e anamnese",
};

// Decisão 105: ParQ e anamnese do personal, na mesma tela dos formulários do estúdio.
export default function PaginaFormularios() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="ParQ e anamnese">
        <BotaoVoltar reserva="/agenda/conta" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const personal = await exigirPersonal("/agenda/formularios");
  const [formularios, alunos] = await Promise.all([lerFormulariosDoPersonal(), listarMeusAlunos()]);
  return (
    <div className="px-[18px] pt-2 pb-10">
      <FormulariosDoEstudio
        personal
        estudioId=""
        estudio={personal.nomeCompleto}
        formularios={formularios}
        alunos={alunos
          .filter((a) => a.situacao === "ativo" && !a.semConta)
          .map((a) => ({ id: a.vinculoId, nome: a.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
      />
    </div>
  );
}
