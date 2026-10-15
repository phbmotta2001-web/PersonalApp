import Link from "next/link";
import type { MeuPersonal } from "@/data/convites";

/**
 * Abas da área do aluno (decisão de 15/10/2026): "Treinos" junta os treinos de todos
 * os personais; cada personal ligado vira uma aba; e "Meu perfil".
 */
export function AbasAluno({ personais, ativa }: { personais: MeuPersonal[]; ativa: "treinos" | "perfil" | string }) {
  const abas = [
    { chave: "treinos", rotulo: "Treinos", href: "/aluno" },
    ...personais.map((p) => ({ chave: p.vinculoId, rotulo: p.nome.split(" ")[0], href: `/aluno/personal/${p.vinculoId}` })),
    { chave: "perfil", rotulo: "Meu perfil", href: "/perfil" },
  ];

  return (
    <nav aria-label="Seções da sua área" className="flex gap-1.5 overflow-x-auto px-[18px] pt-4 pb-2 [scrollbar-width:none]">
      {abas.map((a) => {
        const atual = a.chave === ativa;
        return (
          <Link
            key={a.chave}
            href={a.href}
            aria-current={atual ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap ${
              atual ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink-2 hover:border-brand"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
