"use client";

import { useState, useTransition } from "react";
import { salvarRegras, type Regras } from "@/data/aulas";
import {
  ANTECEDENCIA_PADRAO_H,
  ANTECEDENCIA_REPOSICAO_PADRAO_H,
  OPCOES_ANTECEDENCIA_H,
  OPCOES_ANTECEDENCIA_REPOSICAO_H,
  textoDeHoras,
} from "@/lib/aula";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const valida = (h: number) => Number.isInteger(h) && h >= 0 && h <= 168;

/** Regras de cancelamento, reposição e remarcação do personal. */
export function FormRegras({ inicial }: { inicial: Regras }) {
  const [regras, setRegras] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const tudoValido = valida(regras.cancelamentoH) && valida(regras.reposicaoH);
  const mudou = regras.cancelamentoH !== salvo.cancelamentoH || regras.reposicaoH !== salvo.reposicaoH;

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <EscolhaDeHoras
        titulo="Cancelamento com reposição"
        texto='Quanto tempo antes da aula o aluno precisa cancelar para ganhar uma reposição. Depois disso é "em cima da hora": a aula conta como dada.'
        opcoes={OPCOES_ANTECEDENCIA_H}
        padrao={ANTECEDENCIA_PADRAO_H}
        valor={regras.cancelamentoH}
        onMudar={(h) => {
          setAviso(null);
          setRegras({ ...regras, cancelamentoH: h });
        }}
      />
      <EscolhaDeHoras
        titulo="Reposição e remarcação pelo aluno"
        texto="Com quanta antecedência o aluno pode marcar uma reposição ou remarcar uma aula pelo app. Dá tempo de você ver o aviso."
        opcoes={OPCOES_ANTECEDENCIA_REPOSICAO_H}
        padrao={ANTECEDENCIA_REPOSICAO_PADRAO_H}
        valor={regras.reposicaoH}
        onMudar={(h) => {
          setAviso(null);
          setRegras({ ...regras, reposicaoH: h });
        }}
      />

      <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4 text-[13px] text-ink-2">
        <h2 className="text-[15px] font-bold text-ink">Como funciona</h2>
        <p>• O aluno cancela, remarca e marca reposição pelo app, e você recebe um aviso no sininho da agenda.</p>
        <p>• Remarcar pelo app só vale com a antecedência de cancelamento; em cima da hora, ele precisa falar com você.</p>
        <p>• Quando você cancela uma aula, o aluno sempre ganha reposição.</p>
        <p>• Falta sem aviso conta como aula dada, sem reposição.</p>
        <p>
          • A reposição vale <strong>até o próximo vencimento da mensalidade</strong> do aluno (sem vencimento na matrícula:
          30 dias).
        </p>
        <p>• Aula que passou sem você marcar nada conta como dada.</p>
      </section>

      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto ?? (tudoValido ? null : "Use números de 0 a 168.")}</Aviso>
      <button
        type="button"
        disabled={!tudoValido || !mudou || salvando}
        onClick={() =>
          iniciar(async () => {
            try {
              const r = await salvarRegras(regras);
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              setSalvo(regras);
              setAviso({ tipo: "ok", texto: "Regras salvas." });
            } catch {
              setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
            }
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {salvando ? "Salvando…" : mudou ? "Salvar regras" : "Regras salvas"}
      </button>
    </div>
  );
}

function EscolhaDeHoras({
  titulo,
  texto,
  opcoes,
  padrao,
  valor,
  onMudar,
}: {
  titulo: string;
  texto: string;
  opcoes: number[];
  padrao: number;
  valor: number;
  onMudar: (h: number) => void;
}) {
  const [outro, setOutro] = useState(!opcoes.includes(valor));
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <h2 className="text-[15px] font-bold">{titulo}</h2>
      <p className="text-[13px] text-ink-2">{texto}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((h) => (
          <Chip
            key={h}
            ativo={!outro && valor === h}
            onClick={() => {
              setOutro(false);
              onMudar(h);
            }}
          >
            {textoDeHoras(h)}
            {h === padrao ? " (padrão)" : ""}
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
            value={Number.isNaN(valor) ? "" : valor}
            onChange={(e) => onMudar(e.target.value === "" ? NaN : Number(e.target.value))}
            className={`${ESTILO_CAIXA} w-24 tabular-nums`}
            aria-label={`${titulo}: horas`}
          />
          horas (até 168, uma semana)
        </label>
      )}
    </section>
  );
}
