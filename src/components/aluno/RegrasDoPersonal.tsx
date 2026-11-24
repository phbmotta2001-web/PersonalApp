"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/Icone";
import { ESTILO_BOTAO_PRINCIPAL } from "@/components/Formulario";
import { confirmarRegras, type RegrasPendentes } from "@/data/aluno-aulas";
import { textoDeHoras } from "@/lib/aula";

// Decisão 118: no primeiro acesso depois de virar aluno, as regras do personal com "Li e entendi".
export function RegrasDoPersonal({ regras, nome }: { regras: RegrasPendentes; nome: string }) {
  const router = useRouter();
  const [entendi, setEntendi] = useState(false);
  const [pendente, confirmar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = nome.split(" ")[0];
  const itens = [
    `Para desmarcar uma aula e ganhar reposição, avise com pelo menos ${textoDeHoras(regras.cancelamentoH)} de antecedência. Em cima da hora, a aula conta como dada.`,
    "A reposição vale até o próximo vencimento da mensalidade.",
    `Para marcar reposição ou remarcar pelo app, faça com pelo menos ${textoDeHoras(regras.reposicaoH)} de antecedência.`,
    regras.pausaDias > 0 ? `Pausas na matrícula (viagem, lesão…) com desconto: até ${regras.pausaDias} dias por ano, combinadas com ${primeiro}.` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="flex flex-col gap-3 rounded-[22px] border-2 border-brand bg-surface p-4" aria-label={`Regras de ${primeiro}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Icone nome="escudo" className="size-5" />
        </span>
        <div>
          <h2 className="text-[17px] font-extrabold">Regras de {primeiro}</h2>
          <p className="text-[13.5px] text-ink-3">Leia antes de começar a usar o app</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {itens.map((t) => (
          <li key={t} className="flex gap-2 text-[15px] leading-snug">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
        <input type="checkbox" checked={entendi} onChange={(e) => setEntendi(e.target.checked)} className="size-6 accent-[var(--brand)]" />
        Li e entendi as regras
      </label>
      <button
        type="button"
        disabled={!entendi || pendente}
        className={ESTILO_BOTAO_PRINCIPAL}
        onClick={() =>
          confirmar(async () => {
            const r = await confirmarRegras(regras.vinculoId);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          })
        }
      >
        {pendente ? "Confirmando…" : "Confirmar"}
      </button>
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </section>
  );
}
