import Link from "next/link";
import { sair } from "@/data/conta";
import { Icone, type NomeIcone } from "../Icone";
import type { Aba } from "./GestaoDoEstudio";

// Decisão 62: o painel da coordenação é só do estúdio (administração, financeiro e agenda),
// com o menu inteiro em roxo. No computador, uma coluna fixa à esquerda; no celular, uma faixa
// roxa em cima com o nome do estúdio e a barra de abas embaixo.
export const ABAS_DA_COORDENACAO: { valor: Aba; rotulo: string; curto: string; icone: NomeIcone }[] = [
  { valor: "agenda", rotulo: "Agenda", curto: "Agenda", icone: "calendario" },
  { valor: "equipe", rotulo: "Professores", curto: "Equipe", icone: "pessoas" },
  { valor: "alunos", rotulo: "Alunos", curto: "Alunos", icone: "usuario" },
  { valor: "financeiro", rotulo: "Financeiro", curto: "Financeiro", icone: "dinheiro" },
  { valor: "ajustes", rotulo: "Ajustes", curto: "Ajustes", icone: "filtros" },
];

export function MenuDaCoordenacao({ estudioId, nome, aba, empresa }: { estudioId: string; nome: string; aba: Aba; empresa: boolean }) {
  const href = (a: Aba) => `/estudio/${estudioId}?aba=${a}`;
  // Conta empresarial: só "Sair". Personal que coordena: volta para a área dele.
  const saida = empresa ? (
    <form action={sair}>
      <button type="submit" className="rounded-[12px] px-3 py-2 text-[14px] font-semibold text-on-estudio-2 hover:bg-white/10 hover:text-on-estudio">
        Sair
      </button>
    </form>
  ) : (
    <Link href="/agenda/conta" className="rounded-[12px] px-3 py-2 text-[14px] font-semibold text-on-estudio-2 hover:bg-white/10 hover:text-on-estudio">
      Sair do painel
    </Link>
  );

  return (
    <>
      {/* Computador */}
      <nav aria-label="Coordenação" className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-1 bg-estudio-fundo px-3 py-6 text-on-estudio-2 lg:flex">
        <div className="mb-5 px-3">
          <p className="text-[12.5px] font-bold tracking-[0.06em] uppercase opacity-80">Coordenação</p>
          <p className="font-display text-[22px] leading-tight font-extrabold text-on-estudio">{nome}</p>
        </div>
        {ABAS_DA_COORDENACAO.map((a) => {
          const ativa = a.valor === aba;
          return (
            <Link
              key={a.valor}
              href={href(a.valor)}
              scroll={false}
              aria-current={ativa ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15.5px] font-semibold ${
                ativa ? "bg-white/15 text-on-estudio" : "hover:bg-white/8 hover:text-on-estudio"
              }`}
            >
              <Icone nome={a.icone} className="size-6" />
              {a.rotulo}
            </Link>
          );
        })}
        <div className="mt-auto">{saida}</div>
      </nav>

      {/* Celular: faixa de cima */}
      <header className="flex items-center gap-2 bg-estudio-fundo px-[18px] pt-[calc(env(safe-area-inset-top)+14px)] pb-3.5 text-on-estudio lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold tracking-[0.06em] text-on-estudio-2 uppercase">Coordenação</p>
          <p className="truncate font-display text-[21px] leading-tight font-extrabold">{nome}</p>
        </div>
        {saida}
      </header>

      {/* Celular: barra de abas */}
      <nav
        aria-label="Coordenação"
        className="fixed inset-x-0 bottom-0 z-20 bg-estudio-fundo pb-[env(safe-area-inset-bottom)] text-on-estudio-2 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ABAS_DA_COORDENACAO.map((a) => {
            const ativa = a.valor === aba;
            return (
              <li key={a.valor}>
                <Link
                  href={href(a.valor)}
                  scroll={false}
                  aria-current={ativa ? "page" : undefined}
                  className={`flex min-h-[62px] flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11.5px] ${
                    ativa ? "font-bold text-on-estudio" : "font-semibold"
                  }`}
                >
                  <span className={`grid h-7 w-11 place-items-center rounded-full ${ativa ? "bg-white/18" : ""}`}>
                    <Icone nome={a.icone} className="size-6" />
                  </span>
                  {a.curto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
