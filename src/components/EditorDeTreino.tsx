"use client";

import { useState, useTransition } from "react";
import type { Resposta } from "@/data/conta";
import { DIAS } from "@/lib/expediente";
import { Aviso } from "./Formulario";

/**
 * Treino de cada dia da semana, só por texto (decisões 73 e 81). Aparecem os dias de aula do aluno
 * e os que já têm treino; com `outrosDias`, dá para acrescentar qualquer outro dia.
 */
export function EditorDeTreino({
  dias,
  inicial,
  salvar,
  maximo,
  outrosDias = false,
  semDias,
}: {
  dias: number[];
  inicial: Record<number, string>;
  salvar: (dia: number, texto: string) => Promise<Resposta>;
  maximo: number;
  outrosDias?: boolean;
  semDias: string;
}) {
  const [textos, setTextos] = useState<Record<number, string>>(inicial);
  const [salvos, setSalvos] = useState<Record<number, string>>(inicial);
  const [extras, setExtras] = useState<number[]>([]);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const visiveis = DIAS.filter((d) => dias.includes(d.valor) || salvos[d.valor] || extras.includes(d.valor));
  const faltam = DIAS.filter((d) => !visiveis.includes(d));
  const mudados = visiveis.filter((d) => (textos[d.valor] ?? "") !== (salvos[d.valor] ?? ""));

  return (
    <div className="flex flex-col gap-2">
      {visiveis.length === 0 && !outrosDias && <p className="text-[14px] text-ink-3">{semDias}</p>}
      {visiveis.map((d) => (
        <label key={d.valor} className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
          {d.nome}
          <textarea
            rows={2}
            maxLength={maximo}
            value={textos[d.valor] ?? ""}
            onChange={(e) => {
              setAviso(null);
              setTextos({ ...textos, [d.valor]: e.target.value });
            }}
            placeholder="Ex.: peito e tríceps"
            className="rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none focus:border-brand"
          />
        </label>
      ))}
      {outrosDias && faltam.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
          {visiveis.length === 0 ? "Escolha os dias:" : "Outro dia:"}
          {faltam.map((d) => (
            <button
              key={d.valor}
              type="button"
              onClick={() => setExtras([...extras, d.valor])}
              className="rounded-full border border-line bg-surface px-2.5 py-1 font-semibold text-ink-2"
            >
              {d.nome.slice(0, 3)}
            </button>
          ))}
        </div>
      )}
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      {mudados.length > 0 && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              for (const d of mudados) {
                const r = await salvar(d.valor, textos[d.valor] ?? "");
                if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              }
              setSalvos({ ...textos });
              setAviso({ tipo: "ok", texto: "Treino salvo." });
            })
          }
          className="min-h-[44px] self-start rounded-[12px] bg-brand px-4 font-bold text-brand-ink"
        >
          {ocupado ? "Salvando…" : "Salvar treino"}
        </button>
      )}
    </div>
  );
}
