import Link from "next/link";
import { Icone } from "@/components/Icone";
import type { AvaliacaoFisica } from "@/lib/avaliacao";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import type { Exercicio, RegistroDoExercicio } from "@/lib/treino";
import { TreinoAoVivo } from "./TreinoAoVivo";

// Decisão 113: durante a aula particular, um painel grande no alto do Início, com o perfil do
// aluno e o treino do dia. O personal vê o aluno; o aluno vê o próprio treino e a aula.

export interface DadosDoPainel {
  quem: "personal" | "aluno";
  /** Personal: o nome do aluno. Aluno: o nome do personal. */
  nome: string;
  inicio: string;
  fim: string;
  local: string | null;
  idade?: number | null;
  objetivo?: string | null;
  nivel?: string | null;
  /** Só para o personal: restrições e limitações declaradas. */
  restricoes?: string | null;
  ultimaAvaliacao?: AvaliacaoFisica | null;
  /** Decisão 114: a aula (para registrar o treino), o que se trabalha no dia e os exercícios. */
  aulaId?: string;
  foco: string | null;
  exercicios: Exercicio[];
  registros: RegistroDoExercicio[];
  /** Personal: a ficha do aluno. Aluno: a página do personal (treino da semana). */
  link?: string;
}

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function PainelDaAula({ d }: { d: DadosDoPainel }) {
  const av = d.ultimaAvaliacao;
  const medidas = [
    av?.pesoKg != null && `${numero(av.pesoKg)} kg`,
    av?.gorduraPct != null && `${numero(av.gorduraPct)}% de gordura`,
  ].filter(Boolean);
  const perfil = [
    d.idade != null && `${d.idade} anos`,
    d.nivel,
    medidas.length > 0 && av && `${medidas.join(" · ")} (${dataCurta(av.data)})`,
  ].filter(Boolean) as string[];

  return (
    <section className="flex flex-col gap-4 rounded-[28px] bg-deep p-5 text-on-deep sm:p-6" aria-label="Aula em andamento">
      <div className="flex items-center gap-2">
        <span className="size-2.5 animate-pulse rounded-full bg-lime" aria-hidden="true" />
        <span className="text-[14px] font-extrabold tracking-[0.06em] uppercase">Aula em andamento</span>
        <span className="ml-auto text-[14px] text-on-deep-2 tabular-nums">
          {emBrasilia(d.inicio).hora} às {emBrasilia(d.fim).hora}
        </span>
      </div>

      <div>
        <p className="font-display text-[34px] leading-[1.05] font-extrabold">
          {d.quem === "aluno" ? `Com ${d.nome.split(" ")[0]}` : d.nome}
        </p>
        {d.local && <p className="mt-1 text-[15px] text-on-deep-2">{d.local}</p>}
      </div>

      {(perfil.length > 0 || d.objetivo) && (
        <div className="flex flex-col gap-2">
          {perfil.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {perfil.map((p) => (
                <span key={p} className="rounded-full bg-on-deep/12 px-3 py-1 text-[14px] font-semibold">
                  {p}
                </span>
              ))}
            </div>
          )}
          {d.objetivo && (
            <p className="text-[15px]">
              <span className="text-on-deep-2">Objetivo: </span>
              {d.objetivo}
            </p>
          )}
        </div>
      )}

      {d.quem === "personal" && d.restricoes && (
        <div className="flex items-start gap-2.5 rounded-[18px] bg-gold-soft p-3.5 text-gold">
          <Icone nome="escudo" className="mt-0.5 size-5 shrink-0" />
          <div className="text-[15px]">
            <p className="font-bold">Restrições e limitações</p>
            <p className="mt-0.5 whitespace-pre-line text-ink">{d.restricoes}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-[20px] bg-surface p-4 text-ink">
        <p className="flex items-center gap-2 text-[14px] font-extrabold tracking-[0.04em] text-brand uppercase">
          <Icone nome="estrela" className="size-4" /> Treino de hoje
        </p>
        {d.foco && <p className="font-display text-[22px] leading-tight font-extrabold">{d.foco}</p>}
        {d.exercicios.length > 0 && d.aulaId ? (
          <TreinoAoVivo aulaId={d.aulaId} exercicios={d.exercicios} registros={d.registros} />
        ) : (
          !d.foco && (
            <p className="text-[15px] text-ink-3">
              {d.quem === "personal" ? "Nenhum treino montado para este dia. Dá para montar na ficha." : "Seu personal ainda não montou o treino de hoje."}
            </p>
          )
        )}
      </div>

      {d.link && (
        <Link
          href={d.link}
          className="flex min-h-12 items-center justify-center rounded-[14px] bg-on-deep text-[15px] font-bold text-deep"
        >
          {d.quem === "personal" ? "Abrir a ficha" : "Ver o treino da semana"}
        </Link>
      )}
    </section>
  );
}
