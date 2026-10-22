import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormAlunoSemConta } from "@/components/agenda/FormAlunoSemConta";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { lerFichaSemConta } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { agoraEmBrasilia } from "@/lib/expediente";

export const metadata: Metadata = {
  title: "Editar aluno",
};

export default function PaginaEditarAlunoSemConta({ params }: PageProps<"/agenda/alunos/[vinculo]/editar">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/agenda/alunos/[vinculo]/editar">["params"] }) {
  const { vinculo } = await params;
  await exigirPersonal(`/agenda/alunos/${vinculo}/editar`);
  const f = await lerFichaSemConta(vinculo);

  return (
    <>
      <Cabecalho titulo="Editar aluno">
        <BotaoVoltar reserva={`/agenda/alunos/${vinculo}`} className="hover:bg-surface-2" />
      </Cabecalho>
      {f ? (
        <FormAlunoSemConta
          vinculoId={vinculo}
          hoje={agoraEmBrasilia().data}
          atual={{
            nome: f.nome,
            dataNascimento: f.dataNascimento,
            whatsapp: f.whatsapp ?? "",
            responsavelNome: f.responsavelNome ?? "",
            responsavelWhatsapp: f.responsavelWhatsapp ?? "",
            responsavelAutorizou: !!f.consentimentoEm,
            observacoes: f.observacoes ?? "",
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 px-[18px] pt-4 text-[15px] text-ink-2">
          <p>Só dá para editar aqui os alunos que não usam o app. Os outros cuidam do próprio perfil.</p>
          <Link href={`/agenda/alunos/${vinculo}`} className="font-semibold text-brand">
            Voltar para a ficha
          </Link>
        </div>
      )}
    </>
  );
}
