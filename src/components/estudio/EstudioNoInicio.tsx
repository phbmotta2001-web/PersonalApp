import Link from "next/link";
import type { AulaDeTurma, MeuEstudio } from "@/data/estudio";
import { emBrasilia } from "@/lib/expediente";
import { Icone } from "../Icone";

/**
 * Estúdio no Início do professor (decisão 54, opção C). No horário de trabalho no estúdio
 * (de 30 min antes da primeira turma do dia até o fim da última), o cartão da aula atual
 * ou da próxima, com a chamada. Fora dele, o ícone de cada estúdio, que abre a página dele.
 */
export function EstudioNoInicio({ estudios, aulasHoje, agora }: { estudios: MeuEstudio[]; aulasHoje: AulaDeTurma[]; agora: Date }) {
  if (estudios.length === 0) return null;
  const doDia = aulasHoje.filter((a) => !a.cancelada);
  const t = agora.getTime();
  const comeco = doDia.length ? Math.min(...doDia.map((a) => Date.parse(a.inicio))) - 30 * 60_000 : Infinity;
  const fim = doDia.length ? Math.max(...doDia.map((a) => Date.parse(a.fim))) : -Infinity;
  const atual = t >= comeco && t <= fim ? doDia.find((a) => Date.parse(a.fim) > t) : undefined;

  if (atual) {
    const ms = Date.parse(atual.inicio) - t;
    const quando = ms <= 0 ? "Acontecendo agora" : `Começa em ${Math.max(1, Math.round(ms / 60_000))} min`;
    const seguintes = doDia.filter((a) => Date.parse(a.inicio) > Date.parse(atual.inicio));
    return (
      <section className="flex flex-col gap-3 rounded-[24px] bg-estudio p-5 text-white" aria-label="Estúdio agora">
        <div>
          <p className="text-[14px] opacity-85">
            {atual.estudioNome} · {quando}
          </p>
          <p className="font-display text-[28px] leading-tight font-extrabold">
            {emBrasilia(atual.inicio).hora} · {atual.modalidade}
          </p>
          <p className="text-[14px] opacity-85">
            {atual.alunos} de {atual.vagas} vagas
            {seguintes.length > 0 && ` · depois: ${seguintes.map((a) => emBrasilia(a.inicio).hora).join(", ")}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/agenda/turma/${atual.id}`}
            className="flex min-h-12 items-center justify-center rounded-[14px] bg-white text-[14.5px] font-bold text-estudio"
          >
            {atual.chamadaEm ? "Ver chamada" : "Fazer chamada"}
          </Link>
          <Link
            href={`/agenda/estudio/${atual.estudioId}`}
            className="flex min-h-12 items-center justify-center rounded-[14px] border border-white/40 text-[14.5px] font-bold"
          >
            Estúdio
          </Link>
        </div>
      </section>
    );
  }

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Seus estúdios">
      {estudios.map((e) => (
        <Link
          key={e.id}
          href={`/agenda/estudio/${e.id}`}
          className="flex items-center gap-2 rounded-full border border-estudio/30 bg-estudio-soft py-1.5 pr-3.5 pl-1.5 text-[14px] font-bold text-estudio"
        >
          <span className="grid size-8 place-items-center rounded-full bg-estudio text-white">
            <Icone nome="pessoas" className="size-4" />
          </span>
          {e.nome}
        </Link>
      ))}
    </nav>
  );
}
