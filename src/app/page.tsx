import Link from "next/link";
import { Suspense } from "react";
import { LoginDoTopo } from "@/components/conta/LoginDoTopo";
import { Icone, type NomeIcone } from "@/components/Icone";
import { sair, tipoDaConta } from "@/data/conta";
import { MARKETPLACE_ATIVO } from "@/lib/recursos";

// Página inicial (decisão de 22/10/2026, opção C): apresenta o Pienel ao personal, com o
// login no canto superior. Fundo verde-escuro com o verde-limão em destaque.
const FUNCIONALIDADES: { icone: NomeIcone; titulo: string; texto: string }[] = [
  {
    icone: "calendario",
    titulo: "Agenda que se organiza",
    texto: "Aulas fixas, remarcações, reposições e pausas. O aluno pede, dentro das suas regras, e você aprova com um toque.",
  },
  {
    icone: "dinheiro",
    titulo: "Mensalidades em dia",
    texto: "Cobranças geradas sozinhas, sua chave Pix pronta para o aluno copiar e aviso quando alguém paga ou atrasa.",
  },
  {
    icone: "conversa",
    titulo: "Consultoria online",
    texto: "Questionários de check-in e as respostas de cada aluno organizadas, com tudo à mão no computador.",
  },
  {
    icone: "sino",
    titulo: "Avisos na hora",
    texto: "Notificações no celular para pedidos, pagamentos e vencimentos, sem precisar ficar abrindo o app.",
  },
];

const PARA_O_ALUNO = [
  "Vê as próximas aulas e o histórico",
  "Pede reposição ou remarcação sem precisar mandar mensagem",
  "Copia o Pix e avisa que pagou",
  "Responde os check-ins da consultoria online",
];

const PASSOS = [
  { titulo: "Crie sua conta", texto: "Configure seus horários de trabalho, regras e valores das aulas." },
  { titulo: "Traga seus alunos", texto: "Convide pelo link no WhatsApp ou cadastre quem não usa o app." },
  { titulo: "Acompanhe tudo", texto: "Agenda, pagamentos e check-ins num só lugar, no celular ou no computador." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-deep text-on-deep">
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-5 py-4 lg:px-10 lg:py-5">
        <span className="font-display text-[26px] font-extrabold tracking-tight">
          Pien<span className="text-lime">el</span>
        </span>
        <div className="ml-auto">
          {/* Depende de quem está logado: aparece logo depois do resto da página. */}
          <Suspense fallback={<div className="h-11" />}>
            <Acesso />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-20 px-5 pt-8 pb-16 lg:gap-28 lg:px-10 lg:pt-14">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]" aria-label="Apresentação">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full bg-lime px-3.5 py-1 text-[14px] font-bold text-lime-ink">Para personal trainers</span>
            <h1 className="font-display text-[42px] leading-[1.04] font-extrabold tracking-tight lg:text-[60px]">
              Organize as aulas.
              <br />
              Receba em dia.
              <br />
              <span className="text-lime">Acompanhe de perto.</span>
            </h1>
            <p className="max-w-[46ch] text-[18px] leading-relaxed text-on-deep-2">
              O Pienel junta a agenda, as mensalidades e o acompanhamento dos seus alunos, presenciais e online, num só
              lugar. Você usa no celular ou no computador; seus alunos, pelo celular.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/cadastro"
                className="flex min-h-[54px] items-center rounded-[15px] bg-lime px-6 text-[16px] font-bold text-lime-ink hover:brightness-105"
              >
                Criar conta de personal
              </Link>
              <a
                href="#como-funciona"
                className="flex min-h-[54px] items-center rounded-[15px] border border-white/25 px-6 text-[16px] font-bold hover:bg-white/8"
              >
                Ver como funciona
              </a>
            </div>
          </div>
          <Vitrine />
        </section>

        <section id="funcionalidades" className="flex flex-col gap-8" aria-labelledby="titulo-funcionalidades">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h2 id="titulo-funcionalidades" className="font-display text-[32px] leading-tight font-extrabold lg:text-[40px]">
              Menos tempo organizando, mais tempo treinando.
            </h2>
            <p className="text-[17px] text-on-deep-2">
              Tudo o que ocupa o seu dia fora do treino, resolvido de um jeito simples.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FUNCIONALIDADES.map((f) => (
              <li key={f.titulo} className="flex flex-col gap-3 rounded-[22px] border border-white/12 bg-white/6 p-6">
                <span className="grid size-12 place-items-center rounded-[14px] bg-lime/15 text-lime">
                  <Icone nome={f.icone} className="size-6" />
                </span>
                <h3 className="text-[18px] font-bold">{f.titulo}</h3>
                <p className="text-[15px] leading-relaxed text-on-deep-2">{f.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid items-center gap-10 rounded-[28px] bg-white/6 p-6 lg:grid-cols-[1fr_auto] lg:p-12" aria-labelledby="titulo-aluno">
          <div className="flex flex-col gap-5">
            <h2 id="titulo-aluno" className="font-display text-[30px] leading-tight font-extrabold lg:text-[36px]">
              Seu aluno também ganha.
            </h2>
            <p className="max-w-[52ch] text-[17px] text-on-deep-2">
              Ele recebe um convite seu e passa a ter tudo no celular:
            </p>
            <ul className="flex flex-col gap-3">
              {PARA_O_ALUNO.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[16px]">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                    <Icone nome="certo" className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Celular />
        </section>

        <section id="como-funciona" className="flex scroll-mt-8 flex-col gap-8" aria-labelledby="titulo-passos">
          <h2 id="titulo-passos" className="font-display text-[32px] leading-tight font-extrabold lg:text-[40px]">
            Como funciona
          </h2>
          <ol className="grid gap-4 lg:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex flex-col gap-2 rounded-[22px] border border-white/12 p-6">
                <span className="font-display text-[44px] leading-none font-extrabold text-lime">{i + 1}</span>
                <h3 className="text-[18px] font-bold">{p.titulo}</h3>
                <p className="text-[15px] leading-relaxed text-on-deep-2">{p.texto}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/cadastro"
            className="flex min-h-[54px] items-center self-start rounded-[15px] bg-lime px-6 text-[16px] font-bold text-lime-ink hover:brightness-105"
          >
            Começar agora
          </Link>
        </section>

        {MARKETPLACE_ATIVO && (
          <Link href="/buscar" className="inline-flex items-center gap-1.5 font-semibold text-lime">
            <Icone nome="busca" />
            Buscar personais
          </Link>
        )}
      </main>

      <footer className="border-t border-white/10">
        <p className="mx-auto w-full max-w-[1200px] px-5 py-6 text-[14px] text-on-deep-2 lg:px-10">
          Pienel · agenda, alunos e mensalidades do personal trainer. Aluno: sua conta é criada pelo link de convite do seu
          personal.
        </p>
      </footer>
    </div>
  );
}

/** No canto superior: o login, ou o atalho para a área de quem já entrou. */
async function Acesso() {
  const tipo = await tipoDaConta();
  const botao = "flex h-11 items-center rounded-[12px] bg-lime px-5 text-[15px] font-bold text-lime-ink hover:brightness-105";
  if (tipo === "personal")
    return (
      <Link href="/agenda" className={botao}>
        Abrir minha agenda
      </Link>
    );
  if (tipo === "aluno")
    return (
      <div className="flex items-center gap-4">
        {/* Cada e-mail é aluno OU personal: para criar a conta de personal, é preciso sair desta. */}
        <form action={sair} className="hidden text-[14px] text-on-deep-2 sm:block">
          <button type="submit" className="font-semibold underline">
            Sair da conta de aluno
          </button>
        </form>
        <Link href="/aluno" className={botao}>
          Abrir minha área
        </Link>
      </div>
    );
  return <LoginDoTopo />;
}

/** Ilustração do app: os pedidos do dia no computador e a próxima aula no celular (exemplo). */
function Vitrine() {
  return (
    <div className="relative flex items-end justify-center gap-4 sm:pr-28" aria-hidden="true">
      <div className="flex w-full max-w-[400px] flex-col gap-1 rounded-[22px] bg-app p-5 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)]">
        <p className="pb-2 text-[16px] font-bold">Precisa de você</p>
        {[
          { icone: "calendario" as const, tom: "text-gold", texto: "Ana quer remarcar para sex, 08:00" },
          { icone: "certo" as const, tom: "text-ok", texto: "Carla avisou que pagou R$ 400,00" },
          { icone: "conversa" as const, tom: "text-info", texto: "Rafael respondeu o check-in" },
          { icone: "dinheiro" as const, tom: "text-bad", texto: "João · mensalidade venceu ontem" },
        ].map((l) => (
          <p key={l.texto} className="flex items-center gap-2.5 border-t border-line py-2.5 text-[14.5px] first-of-type:border-t-0">
            <Icone nome={l.icone} className={`size-[18px] shrink-0 ${l.tom}`} />
            {l.texto}
          </p>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <span className="flex flex-col rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[12.5px] text-ink-3">Recebido no mês</span>
            <span className="font-display text-[20px] font-extrabold text-ok">R$ 3.200</span>
          </span>
          <span className="flex flex-col rounded-[14px] border border-line bg-surface p-3">
            <span className="text-[12.5px] text-ink-3">A receber</span>
            <span className="font-display text-[20px] font-extrabold">R$ 1.850</span>
          </span>
        </div>
      </div>
      <div className="absolute right-0 -bottom-10 hidden sm:block">
        <Celular pequeno />
      </div>
    </div>
  );
}

/** Um celular com a próxima aula (exemplo). */
function Celular({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <div
      className={`${pequeno ? "w-[170px]" : "w-[220px]"} flex flex-col gap-2 rounded-[30px] border-[7px] border-[#08201a] bg-app p-3 text-ink shadow-[0_30px_60px_-25px_rgb(0_0_0/0.8)]`}
      aria-hidden="true"
    >
      <div className="flex flex-col gap-0.5 rounded-[16px] bg-deep p-3 text-on-deep">
        <span className="text-[11.5px] text-on-deep-2">Começa em 25 min</span>
        <span className={`font-display ${pequeno ? "text-[18px]" : "text-[22px]"} leading-tight font-extrabold`}>18:00 · Ana</span>
        <span className="text-[11.5px] text-on-deep-2">Academia do Centro</span>
      </div>
      <div className="flex flex-col rounded-[14px] border border-line bg-surface px-2.5 py-1.5 text-[12px]">
        <span className="border-b border-line py-1 font-semibold">19:00 · Bruno</span>
        <span className="py-1 font-semibold">20:00 · Theo</span>
      </div>
      {!pequeno && (
        <span className="flex items-center justify-center gap-1.5 rounded-[12px] bg-lime py-2 text-[12.5px] font-bold text-lime-ink">
          <Icone nome="certo" className="size-3.5" /> Já paguei
        </span>
      )}
    </div>
  );
}
