"use client";

import { DIAS, minParaHora, opcoesDeHora } from "@/lib/expediente";
import type { Funcionamento } from "@/lib/funcionamento";

const CAIXA = "h-10 rounded-[10px] border border-line bg-surface px-2 text-[15px] outline-none focus:border-brand";

/** Dias e horários de funcionamento: marque os dias abertos e o horário de abrir e fechar. */
export function HorarioDeFuncionamento({ valor, mudar }: { valor: Funcionamento; mudar: (f: Funcionamento) => void }) {
  const abre = opcoesDeHora(0, 1410);
  const fecha = opcoesDeHora(30, 1440);
  return (
    <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line bg-surface px-3">
      {DIAS.map((d) => {
        const h = valor[d.valor];
        return (
          <li key={d.valor} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <label className="flex w-28 items-center gap-2 text-[15px] font-semibold">
              <input
                type="checkbox"
                checked={!!h}
                onChange={(e) => mudar({ ...valor, [d.valor]: e.target.checked ? (valor[1] ?? { inicio: 360, fim: 1320 }) : undefined })}
                className="size-4 accent-[var(--brand)]"
              />
              {d.nome}
            </label>
            {h ? (
              <span className="flex items-center gap-2 text-[14px] text-ink-3">
                <select value={h.inicio} onChange={(e) => mudar({ ...valor, [d.valor]: { ...h, inicio: Number(e.target.value) } })} className={CAIXA} aria-label={`${d.nome}: abre`}>
                  {abre.map((m) => (
                    <option key={m} value={m}>
                      {minParaHora(m)}
                    </option>
                  ))}
                </select>
                às
                <select value={h.fim} onChange={(e) => mudar({ ...valor, [d.valor]: { ...h, fim: Number(e.target.value) } })} className={CAIXA} aria-label={`${d.nome}: fecha`}>
                  {fecha.map((m) => (
                    <option key={m} value={m}>
                      {minParaHora(m)}
                    </option>
                  ))}
                </select>
              </span>
            ) : (
              <span className="text-[14px] text-ink-3">Fechado</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
