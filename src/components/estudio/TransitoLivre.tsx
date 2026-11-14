"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarTransitoLivre } from "@/data/estudio";
import { Aviso } from "../Formulario";

export const TEXTO_TRANSITO = {
  titulo: "Trânsito livre dos alunos entre horários",
  ligado: "Ligado: o aluno troca de horário, aumenta ou diminui as aulas sozinho, sem confirmação.",
  desligado: "Desligado: cada mudança do aluno vira um pedido, e a coordenação aprova ou recusa.",
};

/** Decisão 96: o interruptor (no cadastro do estúdio, controlado pelo formulário). */
export function InterruptorTransito({ ligado, mudar, ocupado = false }: { ligado: boolean; mudar: (v: boolean) => void; ocupado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} disabled={ocupado} onClick={() => mudar(!ligado)} className="flex items-center gap-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink-2">{TEXTO_TRANSITO.titulo}</span>
        <span className="block text-[13px] text-ink-3">{ligado ? TEXTO_TRANSITO.ligado : TEXTO_TRANSITO.desligado}</span>
      </span>
      <span aria-hidden="true" className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${ligado ? "bg-brand" : "bg-line"}`}>
        <span className={`size-5 rounded-full bg-surface shadow transition-transform ${ligado ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

/** Em Ajustes: muda na hora. */
export function TransitoLivreDoEstudio({ estudioId, ligado }: { estudioId: string; ligado: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(ligado);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Trânsito dos alunos">
      <InterruptorTransito
        ligado={valor}
        ocupado={ocupado}
        mudar={(novo) =>
          iniciar(async () => {
            setErro(null);
            const r = await salvarTransitoLivre(estudioId, novo);
            if (!r.ok) return setErro(r.erro);
            setValor(novo);
            router.refresh();
          })
        }
      />
      <Aviso>{erro}</Aviso>
    </section>
  );
}
