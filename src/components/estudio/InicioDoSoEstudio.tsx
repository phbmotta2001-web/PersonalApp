import Link from "next/link";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { Icone } from "@/components/Icone";
import { InstalarApp } from "@/components/InstalarApp";
import type { AulaDeTurma, MeuEstudio } from "@/data/estudio";
import { PRIMEIRO_ACESSO } from "@/data/exigir-personal";
import { emBrasilia } from "@/lib/expediente";
import { EstudioNoInicio } from "./EstudioNoInicio";

/**
 * Início de quem só trabalha no estúdio (entrou pelo convite e não fez o cadastro de personal):
 * o que tem hoje no estúdio e, como opção, criar o cadastro de personal para os alunos de fora.
 */
export function InicioDoSoEstudio({
  nome,
  estudios,
  aulasHoje,
  agora,
  emAndamento,
  experimentais,
}: {
  nome: string;
  estudios: MeuEstudio[];
  aulasHoje: AulaDeTurma[];
  agora: Date;
  /** A caixa "Aula em andamento" (decisão 87), quando há aula agora. */
  emAndamento?: React.ReactNode;
  /** Experimentais concluídas esperando a coordenação (decisão 93). */
  experimentais?: React.ReactNode;
}) {
  const doDia = aulasHoje.filter((a) => !a.cancelada && Date.parse(a.fim) > agora.getTime());
  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-8 lg:pt-8">
      <header>
        <p className="text-[14px] text-ink-3">{estudios.map((e) => e.nome).join(" · ")}</p>
        <h1 className="text-[24px] font-extrabold">Olá, {nome.split(" ")[0]}</h1>
      </header>

      <InstalarApp />
      <AtivarNotificacoes texto="Receba os avisos do estúdio no celular." />

      {emAndamento}
      {experimentais}

      <EstudioNoInicio estudios={estudios} aulasHoje={aulasHoje} agora={agora} />

      <section className="flex flex-col gap-2" aria-label="Hoje">
        <h2 className="text-[14px] font-extrabold tracking-[0.04em] text-ink-3 uppercase">Hoje</h2>
        {doDia.length === 0 ? (
          <p className="text-ink-3">Nada mais no estúdio hoje.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {doDia.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/agenda/turma/${a.id}`}
                  className="flex items-center gap-3 rounded-[14px] border-l-[3px] border-estudio bg-estudio-soft px-3 py-2.5 text-estudio"
                >
                  <span className="w-12 shrink-0 text-[15px] font-extrabold">{emBrasilia(a.inicio).hora}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">
                      {a.turno ? "Turno" : "Turma"} {a.modalidade}
                    </span>
                    <span className="block truncate text-[13px] opacity-85">
                      até {emBrasilia(a.fim).hora}
                      {!a.turno && ` · ${a.alunos}/${a.vagas} alunos`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/agenda/calendario" className="text-[14px] font-semibold text-brand">
          Ver a semana
        </Link>
      </section>

      <Link
        href={PRIMEIRO_ACESSO}
        className="flex items-center gap-3.5 rounded-[20px] border-2 border-dashed border-brand/50 bg-brand-soft/40 p-4 hover:border-brand"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
          <Icone nome="mais" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Criar o meu cadastro de personal</span>
          <span className="block text-[14px] text-ink-2">
            Incluso gratuitamente com o plano TEAM. Opcional: para agendar e cobrar seus alunos de fora do estúdio.
          </span>
        </span>
      </Link>
    </div>
  );
}
