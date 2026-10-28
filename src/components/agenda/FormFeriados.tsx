"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarRegraDeFeriados } from "@/data/feriados";
import { curtoDoDia, dataCurta, diaDaSemana } from "@/lib/expediente";
import { trabalhaNoFeriado, type Feriado, type RegraDeFeriados } from "@/lib/feriados";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

/**
 * Feriados (decisão de 28/10/2026): a regra geral ("trabalho" ou "não trabalho") e, na
 * lista dos próximos feriados, as exceções. `continuar`: no primeiro acesso, a próxima etapa.
 */
export function FormFeriados({
  inicial,
  feriados,
  continuar,
}: {
  inicial: RegraDeFeriados;
  /** Próximos feriados (uns 12 meses). */
  feriados: Feriado[];
  continuar?: string;
}) {
  const router = useRouter();
  const [regra, setRegra] = useState(inicial);
  const [salvo, setSalvo] = useState(() => JSON.stringify(inicial));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const mudou = JSON.stringify(regra) !== salvo;

  const escolherGeral = (trabalha: boolean) => {
    setAviso(null);
    // Trocar a regra geral zera as exceções (elas eram o contrário da regra antiga).
    setRegra({ trabalha, excecoes: [] });
  };
  const alternar = (data: string) => {
    setAviso(null);
    setRegra((r) => ({
      ...r,
      excecoes: r.excecoes.includes(data) ? r.excecoes.filter((d) => d !== data) : [...r.excecoes, data],
    }));
  };

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <section className="flex flex-col gap-2" aria-label="Regra geral">
        {[
          {
            valor: true,
            titulo: "Trabalho em feriados",
            texto: "As aulas fixas continuam marcadas nos feriados.",
          },
          {
            valor: false,
            titulo: "Não trabalho em feriados",
            texto: "O dia fica bloqueado e as aulas fixas que caem nele são canceladas: o aluno ganha uma reposição.",
          },
        ].map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            aria-pressed={regra.trabalha === o.valor}
            onClick={() => escolherGeral(o.valor)}
            className={`flex flex-col gap-0.5 rounded-[18px] border-[1.5px] p-4 text-left ${
              regra.trabalha === o.valor ? "border-brand bg-brand-soft/60" : "border-line bg-surface"
            }`}
          >
            <span className="text-[16px] font-bold">{o.titulo}</span>
            <span className="text-[14px] text-ink-2">{o.texto}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2" aria-label="Próximos feriados">
        <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">Próximos feriados</h2>
        <p className="text-[14px] text-ink-3">Toque num feriado para fazer diferente só nele.</p>
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {feriados.map((f) => {
            const trabalha = trabalhaNoFeriado(regra, f.data);
            return (
              <li key={f.data}>
                <button type="button" onClick={() => alternar(f.data)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="w-[74px] shrink-0 text-[14px] font-bold tabular-nums">
                    {curtoDoDia(diaDaSemana(f.data))} {dataCurta(f.data)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{f.nome}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${
                      trabalha ? "bg-brand-soft text-brand" : "bg-gold-soft text-gold"
                    }`}
                  >
                    {trabalha ? "Trabalho" : "Folga"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-ink-3">
          Feriados da sua cidade ou do seu estado: marque em Conta › Bloqueios.
        </p>
      </section>

      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={(!mudou && !continuar) || salvando}
        onClick={() =>
          iniciar(async () => {
            try {
              const r = await salvarRegraDeFeriados(regra);
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              if (continuar) return router.push(continuar);
              setSalvo(JSON.stringify(regra));
              setAviso({ tipo: "ok", texto: "Feriados salvos." });
              router.refresh();
            } catch {
              setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
            }
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {salvando ? "Salvando…" : continuar ? "Salvar e continuar" : mudou ? "Salvar feriados" : "Feriados salvos"}
      </button>
    </div>
  );
}
