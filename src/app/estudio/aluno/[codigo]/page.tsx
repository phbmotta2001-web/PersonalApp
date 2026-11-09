import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormCadastro } from "@/components/conta/FormCadastro";
import { AceitarConviteDoAluno } from "@/components/aluno/AceitarConviteDoAluno";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { verConviteDoAluno } from "@/data/aluno-estudio";
import { lerContaAtual } from "@/data/alunos";
import { sair, tipoDaConta } from "@/data/conta";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";

export const metadata: Metadata = {
  title: "Convite do estúdio",
};

// Convite para o ALUNO do estúdio entrar no app (decisão 61). Funciona sem login.
export default function PaginaConviteAlunoEstudio({ params }: PageProps<"/estudio/aluno/[codigo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/estudio/aluno/[codigo]">["params"] }) {
  const { codigo } = await params;
  const [convite, tipo, contaDeAluno] = await Promise.all([verConviteDoAluno(codigo), tipoDaConta(), lerContaAtual()]);
  const aqui = `/estudio/aluno/${codigo}`;

  if (convite.situacao !== "valido")
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-10 text-ink-2">
        <p className="text-[15px] font-bold text-estudio">P-Bell Estúdio</p>
        <h1 className="text-[22px] font-extrabold text-ink">Convite indisponível</h1>
        <p>Este link venceu ou já foi usado. Peça um novo ao estúdio.</p>
        <Link href="/aluno" className="font-semibold text-brand">
          Ir para a minha área
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-6 pb-6">
      <header className="flex flex-col gap-1">
        <p className="text-[15px] font-bold text-estudio">P-Bell Estúdio</p>
        <h1 className="text-[24px] leading-tight font-extrabold">
          {convite.aluno}, o {convite.estudio} convidou você para o app
        </h1>
      </header>
      <p className="text-ink-2">
        Veja a agenda do estúdio com as vagas de cada turma, avise quando for faltar e marque suas reposições. É gratuito para alunos.
      </p>

      {contaDeAluno ? (
        <AceitarConviteDoAluno codigo={codigo} estudio={convite.estudio ?? "estúdio"} />
      ) : tipo === "personal" ? (
        <form action={sair} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 text-[15px] text-ink-2">
          <p>
            Você está com uma conta de <b>personal</b>. Para aceitar, use uma conta de aluno (com outro e-mail).
          </p>
          <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
            Sair desta conta
          </button>
        </form>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
            <p className="font-bold">Já tem conta no P-Bell?</p>
            <Link href={`/entrar?voltar=${encodeURIComponent(aqui)}`} className={ESTILO_BOTAO_SECUNDARIO}>
              Entrar e aceitar o convite
            </Link>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="px-[18px] text-[17px] font-semibold">Ou crie sua conta</h2>
            <p className="px-[18px] text-[13px] text-ink-3">Só maiores de 18 anos.</p>
            <div className="-mx-[18px]">
              <FormCadastro voltar={aqui} termos={TERMOS_PUBLICADOS} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
