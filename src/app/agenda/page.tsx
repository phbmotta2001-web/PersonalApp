import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { sair, tipoDaConta } from "@/data/conta";
import { lerPersonalAtual } from "@/data/profissional";
import { formatarWhatsapp, ROTULO_SITUACAO } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Minha agenda",
};

export default function PaginaAgenda() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

// Área do personal. Na etapa 0 é só a "casa" da conta; a agenda chega nas próximas etapas.
async function Conteudo() {
  const personal = await lerPersonalAtual();
  if (!personal) {
    if ((await tipoDaConta()) === "aluno") redirect("/perfil");
    redirect("/entrar?voltar=/agenda");
  }

  const emAnalise = personal.situacao !== "aprovado";

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-5 pb-6">
      <header>
        <p className="text-[12.5px] text-ink-3">Área do personal</p>
        <h1 className="text-[24px] font-extrabold">Olá, {personal.nomeCompleto.split(" ")[0]}</h1>
      </header>

      <section
        className={`rounded-[20px] p-4 text-[13.5px] ${
          emAnalise ? "bg-gold-soft text-gold" : "bg-ok-soft text-ok"
        }`}
      >
        <p className="font-bold">Conta: {ROTULO_SITUACAO[personal.situacao]}</p>
        <p className="mt-1">
          {personal.situacao === "em_analise"
            ? "Estamos conferindo o seu CREF. Enquanto isso, você já pode conhecer o Pienel."
            : personal.situacao === "suspenso"
              ? "Sua conta está suspensa. Fale com a equipe do Pienel."
              : "Tudo certo com o seu cadastro."}
        </p>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
        <h2 className="text-[17px] font-semibold">Sua agenda está chegando</h2>
        <p className="text-[13px] text-ink-3">O que vem nas próximas versões do Pienel:</p>
        <ul className="flex flex-col gap-2 text-sm text-ink-2">
          {[
            "Seus horários de trabalho e bloqueios (férias, feriados)",
            "Convidar alunos por link e ver o cadastro de cada um",
            "Aulas fixas na agenda da semana e do dia",
            "Remarcações e reposições feitas pelo próprio aluno",
            "Mensalidades, atrasos e lembretes por WhatsApp",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-brand">
                <Icone nome="relogio" className="size-4" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-4 text-[13px] text-ink-2">
        <h2 className="mb-2 text-[15px] font-semibold text-ink">Seus dados</h2>
        <p>{personal.email}</p>
        <p>WhatsApp {formatarWhatsapp(personal.whatsapp)}</p>
        <p>
          CREF {personal.cref}/{personal.crefUf}
        </p>
      </section>

      <form action={sair}>
        <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </form>
    </div>
  );
}
