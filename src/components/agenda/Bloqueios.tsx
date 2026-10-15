"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apagarBloqueio, criarBloqueio } from "@/data/expediente";
import {
  agoraEmBrasilia,
  dataCurta,
  emBrasilia,
  LIMITE_MOTIVO,
  minParaHora,
  opcoesDeHora,
  problemasDoBloqueio,
  somarDias,
  type Bloqueio,
  type NovoBloqueio,
} from "@/lib/expediente";
import { frase } from "@/lib/formato";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

const novoVazio = (): NovoBloqueio => {
  const hoje = agoraEmBrasilia().data;
  return { diaInteiro: true, dataInicio: hoje, dataFim: hoje, inicioMin: 840, fimMin: 960, motivo: "" };
};

/** Como o bloqueio aparece na lista: "25/12 (dia inteiro)", "20/12 a 05/01", "22/10, 14:00–16:00". */
function descrever(b: Required<Bloqueio>): string {
  const ini = emBrasilia(b.inicio);
  const fim = emBrasilia(b.fim);
  if (b.diaInteiro) {
    const ultimoDia = somarDias(fim.data, -1);
    return ultimoDia === ini.data ? `${dataCurta(ini.data)} (dia inteiro)` : `${dataCurta(ini.data)} a ${dataCurta(ultimoDia)}`;
  }
  return `${dataCurta(ini.data)}, ${ini.hora}–${fim.hora}`;
}

/** Formulário de novo bloqueio + lista dos próximos bloqueios. */
export function Bloqueios({ bloqueios }: { bloqueios: Required<Bloqueio>[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState<NovoBloqueio>(novoVazio);
  const [tentou, setTentou] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const problemas = problemasDoBloqueio(novo);
  const mudar = (parte: Partial<NovoBloqueio>) => {
    setAviso(null);
    setNovo({ ...novo, ...parte });
  };

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (problemas.length > 0) return;
    iniciar(async () => {
      const r = await criarBloqueio(novo);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      setNovo(novoVazio());
      setTentou(false);
      setAviso({ tipo: "ok", texto: "Bloqueio adicionado." });
      router.refresh();
    });
  }

  function apagar(id: string) {
    iniciar(async () => {
      const r = await apagarBloqueio(id);
      setApagando(null);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 px-[18px] pt-2 pb-6">
      <form onSubmit={adicionar} noValidate className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4">
        <h2 className="text-[17px] font-semibold">Novo bloqueio</h2>

        <div role="radiogroup" aria-label="Tipo de bloqueio" className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-surface-2 p-1">
          {[
            { valor: true, rotulo: "Dia inteiro" },
            { valor: false, rotulo: "Algumas horas" },
          ].map((o) => (
            <button
              key={o.rotulo}
              type="button"
              role="radio"
              aria-checked={novo.diaInteiro === o.valor}
              onClick={() => mudar({ diaInteiro: o.valor })}
              className={`min-h-11 rounded-[11px] text-sm font-bold ${
                novo.diaInteiro === o.valor ? "bg-surface text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        {novo.diaInteiro ? (
          <div className="grid grid-cols-2 gap-3">
            <Campo id="bl-de" rotulo="De">
              <input
                id="bl-de"
                type="date"
                value={novo.dataInicio}
                onChange={(e) =>
                  mudar({ dataInicio: e.target.value, dataFim: e.target.value > novo.dataFim ? e.target.value : novo.dataFim })
                }
                className={ESTILO_CAIXA}
              />
            </Campo>
            <Campo id="bl-ate" rotulo="Até (inclusive)">
              <input
                id="bl-ate"
                type="date"
                min={novo.dataInicio}
                value={novo.dataFim}
                onChange={(e) => mudar({ dataFim: e.target.value })}
                className={ESTILO_CAIXA}
              />
            </Campo>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Campo id="bl-dia" rotulo="Dia">
              <input
                id="bl-dia"
                type="date"
                value={novo.dataInicio}
                onChange={(e) => mudar({ dataInicio: e.target.value })}
                className={ESTILO_CAIXA}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="bl-hini" rotulo="Das">
                <select id="bl-hini" value={novo.inicioMin} onChange={(e) => mudar({ inicioMin: Number(e.target.value) })} className={ESTILO_CAIXA}>
                  {opcoesDeHora(0, 1410).map((m) => (
                    <option key={m} value={m}>{minParaHora(m)}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="bl-hfim" rotulo="Às">
                <select id="bl-hfim" value={novo.fimMin} onChange={(e) => mudar({ fimMin: Number(e.target.value) })} className={ESTILO_CAIXA}>
                  {opcoesDeHora(30, 1440).map((m) => (
                    <option key={m} value={m}>{minParaHora(m)}</option>
                  ))}
                </select>
              </Campo>
            </div>
          </div>
        )}

        <Campo id="bl-motivo" rotulo="Motivo" opcional ajuda="Só você vê. Os alunos veem apenas que o horário não está livre.">
          <input
            id="bl-motivo"
            maxLength={LIMITE_MOTIVO}
            value={novo.motivo}
            onChange={(e) => mudar({ motivo: e.target.value })}
            placeholder="Ex.: férias, feriado, dentista"
            className={ESTILO_CAIXA}
          />
        </Campo>

        <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>

        <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
          {ocupado ? "Salvando…" : "Adicionar bloqueio"}
        </button>
      </form>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-semibold">Próximos bloqueios</h2>
        {bloqueios.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum bloqueio marcado.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
            {bloqueios.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <span className="text-brand">
                  <Icone nome="calendario" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold tabular-nums">{descrever(b)}</p>
                  {b.motivo && <p className="truncate text-[12.5px] text-ink-3">{b.motivo}</p>}
                </div>
                {apagando === b.id ? (
                  <span className="flex gap-2 text-[13px] font-bold">
                    <button type="button" onClick={() => setApagando(null)} className="text-ink-3">
                      Manter
                    </button>
                    <button type="button" disabled={ocupado} onClick={() => apagar(b.id)} className="text-bad">
                      Apagar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setApagando(b.id)}
                    aria-label={`Apagar bloqueio de ${descrever(b)}`}
                    className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                  >
                    <Icone nome="fechar" className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
