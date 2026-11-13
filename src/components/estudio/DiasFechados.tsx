"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fecharDiaEstudio, reabrirDiaEstudio, type DiaFechado } from "@/data/estudio";
import { curtoDoDia, dataCurta, diaDaSemana } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/**
 * Decisão 91: a coordenação fecha o estúdio num dia (enforcar feriado, imprevisto).
 * Todas as aulas do dia são canceladas, inclusive as extras, e alunos e professores são avisados.
 */
export function DiasFechados({ estudioId, hoje, dias }: { estudioId: string; hoje: string; dias: DiaFechado[] }) {
  const router = useRouter();
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const fechar = () => {
    if (!data) return setAviso({ tipo: "erro", texto: "Escolha o dia." });
    if (!confirm(`Fechar o estúdio em ${dataCurta(data)}? Todas as aulas desse dia serão canceladas e alunos e professores serão avisados.`)) return;
    setAviso(null);
    iniciar(async () => {
      const r = await fecharDiaEstudio(estudioId, data, motivo);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      setAviso({ tipo: "ok", texto: r.avisados ? `Dia fechado. ${r.avisados} ${r.avisados === 1 ? "pessoa avisada" : "pessoas avisadas"}.` : "Dia fechado." });
      setData("");
      setMotivo("");
      router.refresh();
    });
  };

  const reabrir = (d: string) => {
    if (!confirm(`Reabrir o estúdio em ${dataCurta(d)}? As aulas voltam a ficar marcadas.`)) return;
    setAviso(null);
    iniciar(async () => {
      const r = await reabrirDiaEstudio(estudioId, d);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      setAviso({ tipo: "ok", texto: "Dia reaberto." });
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Fechar o estúdio num dia">
      <h2 className="font-bold">Fechar o estúdio num dia</h2>
      <p className="text-[14px] text-ink-3">Para enforcar um feriado ou num imprevisto. Todas as aulas do dia são canceladas e alunos e professores recebem um aviso.</p>
      <div className="flex flex-col gap-2">
        <input type="date" aria-label="Dia" value={data} min={hoje} onChange={(e) => setData(e.target.value)} className={ESTILO_CAIXA} />
        <input
          type="text"
          aria-label="Motivo"
          placeholder="Motivo (opcional), ex.: Enforcamos o feriado"
          maxLength={80}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={ESTILO_CAIXA}
        />
        <button type="button" onClick={fechar} disabled={ocupado || !data} className={ESTILO_BOTAO_PRINCIPAL}>
          {ocupado ? "Salvando…" : "Fechar este dia"}
        </button>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {dias.length > 0 && (
        <ul className="flex flex-col gap-2">
          {dias.map((d) => (
            <li key={d.data} className="flex items-center justify-between gap-3 rounded-[14px] bg-bad/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold">
                  Fechado em {curtoDoDia(diaDaSemana(d.data))}, {dataCurta(d.data)}
                </p>
                {d.motivo && <p className="truncate text-[13px] text-ink-3">{d.motivo}</p>}
              </div>
              <button type="button" onClick={() => reabrir(d.data)} disabled={ocupado} className="shrink-0 text-[14px] font-bold text-estudio">
                Reabrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
