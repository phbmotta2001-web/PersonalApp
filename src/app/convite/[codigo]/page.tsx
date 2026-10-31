import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AceitarConvite } from "@/components/conta/AceitarConvite";
import { FormCadastro } from "@/components/conta/FormCadastro";
import { Carregando, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { lerContaAtual } from "@/data/alunos";
import { sair, tipoDaConta } from "@/data/conta";
import { verConvite } from "@/data/convites";
import { faltaNoPerfil, perfilCompleto } from "@/lib/aluno";
import { juntarComE } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Convite",
};

// Página que o aluno abre pelo link do personal. Funciona sem login: mostra quem
// convidou e, conforme a situação, o cadastro, o "complete seu perfil" ou o "Aceitar".
export default function PaginaConvite({ params }: PageProps<"/convite/[codigo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params }: { params: PageProps<"/convite/[codigo]">["params"] }) {
  const { codigo } = await params;
  const [convite, tipo] = await Promise.all([verConvite(codigo), tipoDaConta()]);
  const aqui = `/convite/${codigo}`;

  if (convite.situacao === "inexistente")
    return <Mensagem titulo="Link de convite inválido">Confira se o link foi copiado inteiro, ou peça outro ao seu personal.</Mensagem>;

  if (convite.situacao === "usado")
    return convite.jaAceitoPorMim ? (
      <Mensagem titulo={`Você já é aluno de ${convite.personalNome}`}>
        <Link href="/aluno" className={ESTILO_BOTAO_PRINCIPAL}>
          Ir para a minha área
        </Link>
      </Mensagem>
    ) : (
      <Mensagem titulo="Este convite já foi usado">Cada link serve para um aluno só. Peça um novo ao seu personal.</Mensagem>
    );

  if (convite.situacao !== "valido")
    return (
      <Mensagem titulo="Este convite não está mais válido">
        Ele {convite.situacao === "expirado" ? "venceu (vale 14 dias)" : "foi cancelado"}. Peça um link novo para{" "}
        {convite.personalNome}.
      </Mensagem>
    );

  const primeiro = convite.personalNome.split(" ")[0];

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-6 pb-6">
      <header className="flex flex-col gap-1">
        <p className="text-[15px] font-bold text-brand">P-Bell</p>
        <h1 className="text-[24px] leading-tight font-extrabold">
          {convite.personalNome} convidou você para treinar pelo P-Bell
        </h1>
        <p className="text-[14px] text-ink-3">CREF {convite.personalCref}</p>
      </header>
      <p className="text-ink-2">
        Olá, {convite.nomeConvite.split(" ")[0]}! No P-Bell você vê seus horários de treino, remarca aulas e recebe
        os avisos de {primeiro}. É gratuito para alunos.
      </p>

      {tipo === "personal" ? (
        <form action={sair} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 text-[15px] text-ink-2">
          <p>Você está com uma conta de <b>personal</b>. Para aceitar este convite, use uma conta de aluno (com outro e-mail).</p>
          <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
            Sair desta conta
          </button>
        </form>
      ) : tipo === "aluno" ? (
        <Aluno codigo={codigo} personal={convite.personalNome} aqui={aqui} />
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
            <p className="font-bold">Já tem conta no P-Bell?</p>
            <p className="text-[14px] text-ink-3">Por exemplo, se você já treina com outro personal pelo app.</p>
            <Link href={`/entrar?voltar=${encodeURIComponent(aqui)}`} className={ESTILO_BOTAO_SECUNDARIO}>
              Entrar e aceitar o convite
            </Link>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="px-[18px] text-[17px] font-semibold">Ou crie sua conta</h2>
            <p className="px-[18px] text-[13px] text-ink-3">
              Só maiores de 18 anos. Menor de idade? Avise {primeiro}: você pode ser colocado na agenda sem conta.
            </p>
            <div className="-mx-[18px]">
              <FormCadastro voltar={aqui} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

async function Aluno({ codigo, personal, aqui }: { codigo: string; personal: string; aqui: string }) {
  const conta = await lerContaAtual();
  if (!conta) return null;

  if (!perfilCompleto(conta))
    return (
      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
        <p className="font-bold">Falta pouco: complete seu perfil</p>
        <p className="text-[14px] text-ink-2">
          Para treinar com um personal pelo P-Bell, informe {juntarComE(faltaNoPerfil(conta))}. Assim ele conhece suas
          limitações e treina você com segurança.
        </p>
        <Link href={`/perfil?voltar=${encodeURIComponent(aqui)}`} className={ESTILO_BOTAO_PRINCIPAL}>
          Completar meu perfil
        </Link>
      </section>
    );

  return <AceitarConvite codigo={codigo} personal={personal} />;
}

function Mensagem({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-[18px] pt-8 text-ink-2">
      <p className="text-[15px] font-bold text-brand">P-Bell</p>
      <h1 className="text-[22px] font-extrabold text-ink">{titulo}</h1>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
