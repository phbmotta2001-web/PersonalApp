"use client";

import { useState, useTransition } from "react";
import { salvarAntecedencia } from "@/data/aulas";
import { ANTECEDENCIA_PADRAO_H, OPCOES_ANTECEDENCIA_H, textoDeHoras } from "@/lib/aula";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Regras de cancelamento e reposição do personal. */
export function FormRegras({ inicial }: { inicial: number }) {
  const [horas, setHoras] = useState(inicial);
  const [outro, setOutro] = useState(!OPCOES_ANTECEDENCIA_H.includes(inicial));
  const [salvo, setSalvo] = useState(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const valido = Number.isInteger(horas) && horas >= 0 && horas <= 168;

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-bold">Cancelamento com reposição</h2>
        <p className="text-[13px] text-ink-2">
          Quanto tempo antes da aula o aluno precisa cancelar para ganhar uma reposição. Depois disso é &quot;em cima da
          hora&quot;: a aula conta como dada.
        </p>
        <div className="flex flex-wrap gap-2">
          {OPCOES_ANTECEDENCIA_H.map((h) => (
            <Chip
              key={h}
              ativo={!outro && horas === h}
              onClick={() => {
                setAviso(null);
                setOutro(false);
                setHoras(h);
              }}
            >
              {textoDeHoras(h)}
              {h === ANTECEDENCIA_PADRAO_H ? " (padrão)" : ""}
            </Chip>
          ))}
          <Chip ativo={outro} onClick={() => setOutro(true)}>
            Outro
          </Chip>
        </div>
        {outro && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={168}
              value={Number.isNaN(horas) ? "" : horas}
              onChange={(e) => {
                setAviso(null);
                setHoras(e.target.value === "" ? NaN : Number(e.target.value));
              }}
              className={`${ESTILO_CAIXA} w-24 tabular-nums`}
              aria-label="Horas de antecedência"
            />
            horas antes da aula (até 168, uma semana)
          </label>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4 text-[13px] text-ink-2">
        <h2 className="text-[15px] font-bold text-ink">Como funcionam as reposições</h2>
        <p>• Quando você cancela uma aula, o aluno sempre ganha reposição.</p>
        <p>• Falta sem aviso conta como aula dada, sem reposição.</p>
        <p>
          • A reposição vale <strong>até o próximo vencimento da mensalidade</strong> do aluno (sem vencimento na matrícula:
          30 dias).
        </p>
        <p>• Aula que passou sem você marcar nada conta como dada.</p>
      </section>

      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto ?? (valido ? null : "Use um número de 0 a 168.")}</Aviso>
      <button
        type="button"
        disabled={!valido || horas === salvo || salvando}
        onClick={() =>
          iniciar(async () => {
            try {
              const r = await salvarAntecedencia(horas);
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              setSalvo(horas);
              setAviso({ tipo: "ok", texto: "Regra salva." });
            } catch {
              setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
            }
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {salvando ? "Salvando…" : horas === salvo && valido ? `Salvo: ${textoDeHoras(salvo)} de antecedência` : "Salvar regra"}
      </button>
    </div>
  );
}
