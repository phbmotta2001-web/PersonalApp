"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarConfigReposicao, type ConfigReposicao, type ModeloReposicao } from "@/data/reposicao";
import { centavosParaCampo } from "@/lib/matricula";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Quanto recebe o professor que vem repor uma aula: por hora ou por aluno presente. */
export function ValorDaReposicao({ estudioId, config }: { estudioId: string; config: ConfigReposicao | null }) {
  const router = useRouter();
  const [modelo, setModelo] = useState<ModeloReposicao>(config?.modelo ?? "hora");
  const [valor, setValor] = useState(centavosParaCampo(config?.valorCentavos ?? null));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Aula de reposição">
      <div>
        <h2 className="font-bold">Aula de reposição</h2>
        <p className="text-[13px] text-ink-3">Quanto recebe o professor que vem repor a aula de quem está de férias ou faltou.</p>
      </div>
      {!config ? (
        <p className="text-[14px] text-ink-3">Ainda não disponível: falta atualizar o banco (migração 37).</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={modelo === "hora"} onClick={() => setModelo("hora")}>
              Valor fixo por hora
            </Chip>
            <Chip ativo={modelo === "por_aluno"} onClick={() => setModelo("por_aluno")}>
              Por aluno presente
            </Chip>
          </div>
          <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
            {modelo === "hora" ? "Valor por hora (R$)" : "Valor por aluno presente (R$)"}
            <input inputMode="decimal" placeholder="40,00" value={valor} onChange={(e) => setValor(e.target.value)} className={ESTILO_CAIXA} />
          </label>
          {modelo === "por_aluno" && <p className="text-[13px] text-ink-3">Turnos de trabalho são pagos pelo valor da hora do estúdio.</p>}

          <label className="flex items-start gap-3 rounded-2xl border border-line p-3 opacity-60">
            <input type="checkbox" disabled checked={false} readOnly className="mt-0.5 size-5 shrink-0" />
            <span className="text-[14px]">
              <b className="block">Permitir professores de fora da equipe</b>
              <span className="text-ink-3">Em breve. Por enquanto, só a equipe do estúdio é avisada.</span>
            </span>
          </label>

          <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await salvarConfigReposicao(estudioId, modelo, valor);
                setAviso(r.ok ? { tipo: "ok", texto: "Valor da reposição salvo." } : { tipo: "erro", texto: r.erro });
                if (r.ok) router.refresh();
              })
            }
            className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
          >
            {ocupado ? "Salvando…" : "Salvar valor da reposição"}
          </button>
        </>
      )}
    </section>
  );
}
