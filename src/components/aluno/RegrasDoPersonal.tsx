"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/Icone";
import { ESTILO_BOTAO_PRINCIPAL } from "@/components/Formulario";
import { confirmarRegras, type RegrasPendentes } from "@/data/aluno-aulas";
import { textoDeHoras } from "@/lib/aula";

// Decisão 118: no primeiro acesso depois de virar aluno, as regras do personal com "Li e entendi".
// Decisão 126: e o contrato do personal, com "Li e aceito o contrato" (assina de novo se o personal mudar).
export function RegrasDoPersonal({ regras, nome }: { regras: RegrasPendentes; nome: string }) {
  const router = useRouter();
  const [entendi, setEntendi] = useState(!regras.regras);
  const [aceito, setAceito] = useState(!regras.contrato);
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
    <section className="flex flex-col gap-3 rounded-[22px] border-2 border-brand bg-surface p-4" aria-label={regras.regras ? `Regras de ${primeiro}` : `Contrato de ${primeiro}`}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Icone nome="escudo" className="size-5" />
        </span>
        <div>
          <h2 className="text-[17px] font-extrabold">
            {regras.regras ? (regras.contrato ? `Regras e contrato de ${primeiro}` : `Regras de ${primeiro}`) : `${primeiro} atualizou o contrato`}
          </h2>
          <p className="text-[13.5px] text-ink-3">{regras.regras ? "Leia antes de começar a usar o app" : "Leia e assine para continuar"}</p>
        </div>
      </div>
      {regras.regras && (
        <>
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
        </>
      )}
      {regras.contrato && (
        <>
          <h3 className="text-[15px] font-bold">Contrato</h3>
          <div
            tabIndex={0}
            className="max-h-72 overflow-y-auto rounded-[14px] border border-line bg-surface-2 p-3 text-[14.5px] leading-relaxed whitespace-pre-wrap"
          >
            {regras.contrato}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="size-6 accent-[var(--brand)]" />
            Li e aceito o contrato
          </label>
        </>
      )}
      <button
        type="button"
        disabled={!entendi || !aceito || pendente}
        className={ESTILO_BOTAO_PRINCIPAL}
        onClick={() =>
          confirmar(async () => {
            const r = await confirmarRegras(regras.vinculoId, regras.contratoVersao);
            if (!r.ok) return setErro(r.erro);
            router.refresh();
          })
        }
      >
        {pendente ? "Confirmando…" : regras.contrato ? "Assinar e continuar" : "Confirmar"}
      </button>
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </section>
  );
}
