import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AbasAluno } from "@/components/aluno/AbasAluno";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { InstalarApp } from "@/components/InstalarApp";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { matriculasSuspensas } from "@/data/matriculas";
import { faltaNoPerfil, perfilCompleto } from "@/lib/aluno";
import { juntarComE } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Minha área",
};

export default function PaginaAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

// Aba "Treinos": junta os treinos de todos os personais (a agenda chega nas etapas 3 e 6).
async function Conteudo() {
  const conta = await exigirAluno("/aluno");
  const [personais, suspensas] = await Promise.all([listarMeusPersonais(), matriculasSuspensas()]);

  return (
    <>
      <AbasAluno personais={personais} ativa="treinos" />
      <div className="flex flex-col gap-5 px-[18px] pt-3 pb-6">
        <header>
          <p className="text-[12.5px] text-ink-3">Minha área</p>
          <h1 className="text-[24px] font-extrabold">Olá, {conta.perfil.nomeCompleto.split(" ")[0]}</h1>
        </header>

        {personais
          .filter((p) => suspensas[p.vinculoId])
          .map((p) => (
            <Link
              key={p.vinculoId}
              href={`/aluno/personal/${p.vinculoId}`}
              role="alert"
              className="flex items-center gap-3 rounded-[20px] border-2 border-bad bg-bad/5 p-4"
            >
              <Icone nome="cadeado" className="size-6 shrink-0 text-bad" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-bad">Matrícula suspensa</span>
                <span className="block text-[13px] text-ink-2">
                  Sua matrícula com {p.nome.split(" ")[0]} venceu sem pagamento. Pague para liberar suas aulas.
                </span>
              </span>
              <span className="rounded-[11px] bg-bad px-3 py-2 text-[13px] font-bold text-white">Pagar</span>
            </Link>
          ))}

        <InstalarApp />
        <AtivarNotificacoes texto="Receba o lembrete 1 hora antes da aula, as respostas do seu personal e o aviso de vencimento da matrícula." />

        {!perfilCompleto(conta) && (
          <section className="rounded-[20px] bg-gold-soft p-4 text-[13.5px] text-gold">
            <p className="font-bold">Complete seu perfil</p>
            <p className="mt-1">
              Falta {juntarComE(faltaNoPerfil(conta))}. Sem isso, você não consegue aceitar convites de personais.
            </p>
            <Link href="/perfil" className="mt-2 inline-block font-semibold underline">
              Completar agora
            </Link>
          </section>
        )}

        <section className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-line p-6 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
            <Icone nome="calendario" />
          </span>
          {personais.length === 0 ? (
            <>
              <p className="font-bold">Você ainda não treina com nenhum personal pelo Pienel</p>
              <p className="text-[13px] text-ink-3">Peça o link de convite ao seu personal.</p>
            </>
          ) : (
            <>
              <p className="font-bold">Seus treinos aparecem aqui</p>
              <p className="text-[13px] text-ink-3">
                Quando {personais.length === 1 ? personais[0].nome.split(" ")[0] : "seus personais"} marcar suas aulas,
                elas ficam nesta aba, juntas, mesmo com mais de um personal.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
