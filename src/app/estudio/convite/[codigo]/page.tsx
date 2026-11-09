import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AceitarConviteEstudio } from "@/components/estudio/AceitarConviteEstudio";
import { FormCadastroProfessor } from "@/components/estudio/FormCadastroProfessor";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";
import { verConviteEstudio } from "@/data/estudio";
import { usuarioAtual } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Convite do estúdio",
};

// Convite para um professor entrar na equipe de um estúdio.
export default function PaginaConviteEstudio({ params }: PageProps<"/estudio/convite/[codigo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-[18px] pt-10 pb-12">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/estudio/convite/[codigo]">["params"] }) {
  const { codigo } = await params;
  const [convite, { id }] = await Promise.all([verConviteEstudio(codigo), usuarioAtual()]);
  const aqui = `/estudio/convite/${codigo}`;
  if (convite.situacao !== "valido")
    return (
      <>
        <h1 className="text-[24px] font-extrabold">Convite indisponível</h1>
        <p className="text-ink-2">Este convite venceu ou já foi usado. Peça um novo à coordenação do estúdio.</p>
      </>
    );
  return (
    <>
      <p className="text-[15px] font-bold text-estudio">P-Bell Estúdio</p>
      <h1 className="text-[26px] leading-tight font-extrabold">Você foi convidado para a equipe do {convite.estudio}</h1>
      <p className="text-ink-2">
        Suas turmas do estúdio vão aparecer em roxo na sua agenda, e você faz a chamada pelo celular. O estúdio vê só as turmas dele,
        nunca seus alunos particulares.
      </p>
      {id ? (
        <AceitarConviteEstudio codigo={codigo} />
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
            <p className="font-bold">Já tem conta no P-Bell?</p>
            <Link href={`/entrar?voltar=${encodeURIComponent(aqui)}`} className={ESTILO_BOTAO_SECUNDARIO}>
              Entrar e aceitar o convite
            </Link>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">Ou crie sua conta (leva 1 minuto)</h2>
            <FormCadastroProfessor codigo={codigo} termos={TERMOS_PUBLICADOS} />
          </section>
        </>
      )}
    </>
  );
}
