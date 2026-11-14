import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormCadastro } from "@/components/conta/FormCadastro";
import { AceitarConviteDoAluno } from "@/components/aluno/AceitarConviteDoAluno";
import { Carregando, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { faltaNoPerfil, perfilCompleto } from "@/lib/aluno";
import { juntarComE } from "@/lib/formato";
import { verLinkDeAlunos } from "@/data/aluno-estudio";
import { lerContaAtual } from "@/data/alunos";
import { sair, tipoDaConta } from "@/data/conta";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";

export const metadata: Metadata = {
  title: "Cadastro no estúdio",
};

// Link de cadastro de novos alunos do estúdio (decisão 95). Funciona sem login.
export default function PaginaLinkDeAlunos({ params }: PageProps<"/estudio/entrar/[codigo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/estudio/entrar/[codigo]">["params"] }) {
  const { codigo } = await params;
  const [convite, tipo, contaDeAluno] = await Promise.all([verLinkDeAlunos(codigo), tipoDaConta(), lerContaAtual()]);
  const aqui = `/estudio/entrar/${codigo}`;

  if (convite.situacao !== "valido")
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-10 text-ink-2">
        <p className="text-[15px] font-bold text-estudio">P-Bell Estúdio</p>
        <h1 className="text-[22px] font-extrabold text-ink">Link indisponível</h1>
        <p>Este link não vale mais. Peça um novo ao estúdio.</p>
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
          Cadastre-se no {convite.estudio}
        </h1>
      </header>
      <p className="text-ink-2">
        Veja a agenda do estúdio com as vagas de cada turma, avise quando for faltar e marque suas reposições. É gratuito para alunos.
      </p>

      {contaDeAluno && !perfilCompleto(contaDeAluno) ? (
        // Decisão 73: limitações e objetivos vêm do perfil (os mesmos que o personal vê).
        <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
          <p className="font-bold">Falta pouco: complete seu perfil</p>
          <p className="text-[14px] text-ink-2">
            Informe {juntarComE(faltaNoPerfil(contaDeAluno))}. Assim o estúdio conhece seus objetivos e suas limitações e treina você com segurança.
          </p>
          <Link href={`/perfil?voltar=${encodeURIComponent(aqui)}`} className={ESTILO_BOTAO_PRINCIPAL}>
            Completar meu perfil
          </Link>
        </section>
      ) : contaDeAluno ? (
        <AceitarConviteDoAluno codigo={codigo} estudio={convite.estudio ?? "estúdio"} geral />
      ) : tipo === "personal" ? (
        <form action={sair} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 text-[15px] text-ink-2">
          <p>
            Você está com uma conta de <b>personal</b>. Para se cadastrar, use uma conta de aluno (com outro e-mail).
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
              Entrar e me cadastrar no estúdio
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
