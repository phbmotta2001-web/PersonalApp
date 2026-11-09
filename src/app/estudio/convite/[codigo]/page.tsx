import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AceitarConviteEstudio } from "@/components/estudio/AceitarConviteEstudio";
import { Carregando } from "@/components/Formulario";
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
        <div className="flex flex-col gap-2">
          <Link href={`/entrar?voltar=${encodeURIComponent(aqui)}`} className="rounded-[15px] bg-brand px-5 py-3.5 text-center font-bold text-brand-ink">
            Entrar para aceitar
          </Link>
          <Link href="/cadastro" className="text-center font-semibold text-brand">
            Ainda não tenho conta: criar conta de personal
          </Link>
          <p className="text-center text-[13px] text-ink-3">Depois de criar a conta, abra este link de novo.</p>
        </div>
      )}
    </>
  );
}
