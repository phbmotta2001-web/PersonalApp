"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ativarAlunoDaEquipe } from "@/data/equipe";

const CARTAO = "flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-4 hover:border-brand";

/**
 * Atalhos da conta da equipe para testar cada área com o mesmo login: a agenda de personal,
 * a coordenação de estúdio e a área do aluno (perfil de aluno de teste).
 */
export function TestarComo({ temPerfilDeAluno }: { temPerfilDeAluno: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className="flex flex-col gap-3" aria-label="Testar como">
      <div>
        <h2 className="text-[18px] font-bold">Testar como</h2>
        <p className="text-[13.5px] text-ink-3">Tudo com esta mesma conta. Para voltar, use Conta (personal) ou Perfil (aluno).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/agenda" className={CARTAO}>
          <span className="font-bold">Personal / professor</span>
          <span className="text-[13.5px] text-ink-3">Agenda, alunos, mensalidades. Na primeira vez, passa pelo primeiro acesso.</span>
        </Link>
        <Link href="/estudio" className={CARTAO}>
          <span className="font-bold">Empresa (estúdio)</span>
          <span className="text-[13.5px] text-ink-3">Coordenação: turmas, professores, financeiro. Você pode ser professor das próprias turmas.</span>
        </Link>
        {temPerfilDeAluno ? (
          <Link href="/aluno" className={CARTAO}>
            <span className="font-bold">Aluno</span>
            <span className="text-[13.5px] text-ink-3">
              Para ligar ao seu personal de teste: na agenda, convide um aluno e abra o link com esta conta.
            </span>
          </Link>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await ativarAlunoDaEquipe();
                if (!r.ok) return setErro(r.erro);
                router.push("/perfil");
              })
            }
            className={CARTAO + " text-left"}
          >
            <span className="font-bold">{ocupado ? "Criando…" : "Aluno"}</span>
            <span className="text-[13.5px] text-ink-3">Cria um perfil de aluno de teste nesta conta. Depois complete o perfil para aceitar convites.</span>
          </button>
        )}
      </div>
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </section>
  );
}
