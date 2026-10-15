import Link from "next/link";
import { Suspense } from "react";
import { Icone } from "@/components/Icone";
import { sair, tipoDaConta } from "@/data/conta";
import { MARKETPLACE_ATIVO } from "@/lib/recursos";

// Fase 1: a página inicial fala com o PERSONAL (agenda e cobrança num só lugar).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 px-6 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-5xl font-extrabold tracking-tight text-brand">Pienel</h1>
        <p className="text-[22px] leading-snug font-bold text-ink">
          Sua agenda, seus alunos e suas cobranças num só lugar.
        </p>
        <p className="text-ink-2">
          Chega de juntar agenda, link de pagamento e WhatsApp na mão.
        </p>
      </div>

      <ul className="flex flex-col gap-3 text-[15px] text-ink-2">
        {[
          { icone: "relogio" as const, texto: "Agenda com aulas fixas, remarcações e reposições" },
          { icone: "usuario" as const, texto: "Alunos marcam e remarcam sozinhos, dentro das suas regras" },
          { icone: "conversa" as const, texto: "Lembretes e cobranças automáticos por WhatsApp" },
        ].map((item) => (
          <li key={item.texto} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <Icone nome={item.icone} className="size-[18px]" />
            </span>
            <span className="pt-1.5">{item.texto}</span>
          </li>
        ))}
      </ul>

      {/* Depende de quem está logado: aparece logo depois do resto da página. */}
      <Suspense fallback={<div className="h-[50px]" />}>
        <MenuConta />
      </Suspense>

      {MARKETPLACE_ATIVO && (
        <Link href="/buscar" className="inline-flex items-center gap-1.5 font-semibold text-brand">
          <Icone nome="busca" />
          Buscar personais
        </Link>
      )}
    </main>
  );
}

async function MenuConta() {
  const tipo = await tipoDaConta();
  const principal =
    "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[15px] bg-brand px-5 font-bold text-brand-ink hover:brightness-110";

  if (tipo === "personal")
    return (
      <Link href="/agenda" className={principal}>
        Abrir minha agenda
      </Link>
    );
  if (tipo === "aluno")
    return (
      <div className="flex flex-col gap-3">
        <Link href="/aluno" className={principal}>
          <Icone nome="usuario" />
          Abrir minha área
        </Link>
        {/* Cada e-mail é aluno OU personal: para criar a conta de personal, é preciso sair desta. */}
        <form action={sair} className="text-center text-[13px] text-ink-3">
          É personal? Use outro e-mail:{" "}
          <button type="submit" className="font-semibold text-brand">
            sair desta conta de aluno
          </button>
        </form>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <Link href="/cadastro" className={principal}>
        Criar minha conta de personal
      </Link>
      <Link href="/entrar" className="text-center font-semibold text-brand">
        Já tenho conta: entrar
      </Link>
      <p className="text-center text-[13px] text-ink-3">
        É aluno? Sua conta é criada pelo link de convite do seu personal.
      </p>
    </div>
  );
}
