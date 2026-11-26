"use client";

import { useState, useTransition } from "react";
import { salvarContrato } from "@/data/contrato";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Decisão 126: o contrato do personal. O aluno lê e assina no app, junto das regras. */
export function FormContrato({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const mudou = texto.trim() !== salvo.trim();

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <p className="text-[14.5px] text-ink-2">
        Escreva ou cole o seu contrato. O aluno lê no app junto das regras e assina marcando &quot;Li e aceito o contrato&quot;. Se você
        mudar o texto, os alunos assinam de novo. Deixe em branco para não ter contrato.
      </p>
      <textarea
        aria-label="Texto do contrato"
        value={texto}
        maxLength={20000}
        onChange={(e) => {
          setAviso(null);
          setTexto(e.target.value);
        }}
        rows={16}
        placeholder="Ex.: Contrato de prestação de serviços de personal trainer…"
        className={ESTILO_CAIXA + " min-h-[320px] py-3 leading-relaxed"}
      />
      <Aviso tipo={aviso?.tipo === "ok" ? "ok" : undefined}>{aviso?.texto ?? null}</Aviso>
      <button
        type="button"
        disabled={!mudou || salvando}
        onClick={() =>
          iniciar(async () => {
            const r = await salvarContrato(texto);
            if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
            setSalvo(texto);
            setAviso({ tipo: "ok", texto: texto.trim() ? "Contrato salvo. Seus alunos assinam no próximo acesso ao app." : "Contrato removido." });
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {salvando ? "Salvando…" : "Salvar contrato"}
      </button>
    </div>
  );
}
