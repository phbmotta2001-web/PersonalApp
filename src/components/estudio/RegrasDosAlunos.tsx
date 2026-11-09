"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarRegrasDosAlunos } from "@/data/aluno-estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const HORAS_FALTA = [0, 1, 2, 3, 4, 6, 8, 12, 24, 48];
const HORAS_MARCAR = [0, 1, 2, 3, 4, 6, 12, 24];
const DIAS_VALIDADE = [7, 15, 30, 45, 60, 90];
const horas = (h: number) => (h === 0 ? "Até a hora da aula" : `${h} h antes`);

/** Regras dos alunos: aviso de falta (gera reposição), antecedência para repor e validade. */
export function RegrasDosAlunos({ estudioId, faltaH, marcarH, validadeDias }: { estudioId: string; faltaH: number; marcarH: number | null; validadeDias: number }) {
  const router = useRouter();
  const [falta, setFalta] = useState(faltaH);
  const [marcar, setMarcar] = useState(marcarH ?? 1);
  const [validade, setValidade] = useState(validadeDias);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const opcoes = (lista: number[], atual: number) => (lista.includes(atual) ? lista : [...lista, atual].sort((a, b) => a - b));

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Faltas e reposições dos alunos">
      <div>
        <h2 className="font-bold">Faltas e reposições dos alunos</h2>
        <p className="text-[13px] text-ink-3">Valem para o app do aluno e para quando o professor avisa a falta por ele.</p>
      </div>
      {marcarH === null ? (
        <p className="text-[14px] text-ink-3">Ainda não disponível: falta atualizar o banco (migração 38).</p>
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
              Avisar a falta para ganhar reposição
              <select value={falta} onChange={(e) => setFalta(Number(e.target.value))} className={ESTILO_CAIXA}>
                {opcoes(HORAS_FALTA, falta).map((h) => (
                  <option key={h} value={h}>
                    {horas(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
              Marcar reposição
              <select value={marcar} onChange={(e) => setMarcar(Number(e.target.value))} className={ESTILO_CAIXA}>
                {opcoes(HORAS_MARCAR, marcar).map((h) => (
                  <option key={h} value={h}>
                    {horas(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
              A reposição vale
              <select value={validade} onChange={(e) => setValidade(Number(e.target.value))} className={ESTILO_CAIXA}>
                {opcoes(DIAS_VALIDADE, validade).map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await salvarRegrasDosAlunos(estudioId, falta, marcar, validade);
                setAviso(r.ok ? { tipo: "ok", texto: "Regras salvas." } : { tipo: "erro", texto: r.erro });
                if (r.ok) router.refresh();
              })
            }
            className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
          >
            {ocupado ? "Salvando…" : "Salvar regras"}
          </button>
        </>
      )}
    </section>
  );
}
