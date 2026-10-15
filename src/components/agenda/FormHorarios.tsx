"use client";

import { useState, useTransition } from "react";
import { salvarExpediente } from "@/data/expediente";
import {
  DIAS,
  DURACOES,
  MAX_FAIXAS_POR_DIA,
  minParaHora,
  opcoesDeHora,
  problemasDasFaixas,
  type Duracao,
  type Faixa,
} from "@/lib/expediente";
import { frase } from "@/lib/formato";
import { Chip } from "../Chip";
import { ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { Icone } from "../Icone";

const FAIXA_NOVA = { inicioMin: 360, fimMin: 720 }; // 06:00–12:00
const estiloSelect = "min-h-10 rounded-[11px] border border-line bg-surface px-2 text-sm tabular-nums";

const ordenar = (faixas: Faixa[]) => [...faixas].sort((a, b) => a.dia - b.dia || a.inicioMin - b.inicioMin);

/** Editor dos horários de trabalho: dias, faixas e duração padrão da aula. */
export function FormHorarios({ inicial }: { inicial: { duracao: Duracao; faixas: Faixa[] } }) {
  const [duracao, setDuracao] = useState<Duracao>(inicial.duracao);
  const [faixas, setFaixas] = useState<Faixa[]>(ordenar(inicial.faixas));
  const [salvo, setSalvo] = useState(() => JSON.stringify({ duracao: inicial.duracao, faixas: ordenar(inicial.faixas) }));
  const [copiandoDe, setCopiandoDe] = useState<number | null>(null);
  const [destinos, setDestinos] = useState<number[]>([]);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  const problemas = problemasDasFaixas(faixas);
  const mudou = JSON.stringify({ duracao, faixas: ordenar(faixas) }) !== salvo;
  const doDia = (dia: number) => faixas.filter((f) => f.dia === dia);

  const trocar = (novas: Faixa[]) => {
    setAviso(null);
    setFaixas(ordenar(novas));
  };
  const ligarDia = (dia: number, ligado: boolean) =>
    trocar(ligado ? [...faixas, { dia, ...FAIXA_NOVA }] : faixas.filter((f) => f.dia !== dia));
  const mudarFaixa = (dia: number, indice: number, parte: Partial<Faixa>) => {
    const alvo = doDia(dia)[indice];
    trocar(faixas.map((f) => (f === alvo ? { ...f, ...parte } : f)));
  };
  const removerFaixa = (dia: number, indice: number) => {
    const alvo = doDia(dia)[indice];
    trocar(faixas.filter((f) => f !== alvo));
  };
  const adicionarFaixa = (dia: number) => {
    const ultimo = doDia(dia).at(-1);
    const inicioMin = ultimo ? Math.min(ultimo.fimMin + 60, 1380) : FAIXA_NOVA.inicioMin;
    trocar([...faixas, { dia, inicioMin, fimMin: Math.min(inicioMin + 180, 1440) }]);
  };
  const aplicarCopia = () => {
    if (copiandoDe === null) return;
    const modelo = doDia(copiandoDe);
    trocar([
      ...faixas.filter((f) => !destinos.includes(f.dia)),
      ...destinos.flatMap((dia) => modelo.map((f) => ({ ...f, dia }))),
    ]);
    setCopiandoDe(null);
    setDestinos([]);
  };

  function salvar() {
    iniciar(async () => {
      try {
        const r = await salvarExpediente(duracao, faixas);
        if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
        setSalvo(JSON.stringify({ duracao, faixas: ordenar(faixas) }));
        setAviso({ tipo: "ok", texto: "Horários salvos." });
      } catch {
        setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
        <fieldset className="flex flex-col gap-[7px]">
          <legend className="mb-[7px] text-[13px] font-bold text-ink-2">Duração padrão da aula</legend>
          <div className="flex flex-wrap gap-2">
            {DURACOES.map((d) => (
              <Chip
                key={d}
                ativo={duracao === d}
                onClick={() => {
                  setAviso(null);
                  setDuracao(d);
                }}
              >
                {d} min
              </Chip>
            ))}
          </div>
          <p className="text-xs text-ink-3">Os horários livres são cortados nesse tamanho a partir do início de cada faixa.</p>
        </fieldset>

        <ul className="flex flex-col gap-3">
          {DIAS.map((d) => {
            const lista = doDia(d.valor);
            const ligado = lista.length > 0;
            return (
              <li key={d.valor} className="rounded-[20px] border border-line bg-surface p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-bold">{d.nome}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ligado}
                    aria-label={`Trabalho na ${d.nome.toLowerCase()}`}
                    onClick={() => ligarDia(d.valor, !ligado)}
                    className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors ${ligado ? "bg-brand" : "bg-line"}`}
                  >
                    <span
                      className={`absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow transition-transform ${
                        ligado ? "translate-x-[18px]" : ""
                      }`}
                    />
                  </button>
                </div>

                {ligado ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {lista.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                        <label className="sr-only" htmlFor={`ini-${d.valor}-${i}`}>Início</label>
                        <select
                          id={`ini-${d.valor}-${i}`}
                          value={f.inicioMin}
                          onChange={(e) => mudarFaixa(d.valor, i, { inicioMin: Number(e.target.value) })}
                          className={estiloSelect}
                        >
                          {opcoesDeHora(0, 1410).map((m) => (
                            <option key={m} value={m}>{minParaHora(m)}</option>
                          ))}
                        </select>
                        <span>às</span>
                        <label className="sr-only" htmlFor={`fim-${d.valor}-${i}`}>Fim</label>
                        <select
                          id={`fim-${d.valor}-${i}`}
                          value={f.fimMin}
                          onChange={(e) => mudarFaixa(d.valor, i, { fimMin: Number(e.target.value) })}
                          className={estiloSelect}
                        >
                          {opcoesDeHora(30, 1440).map((m) => (
                            <option key={m} value={m}>{minParaHora(m)}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removerFaixa(d.valor, i)}
                          aria-label="Remover esta faixa"
                          className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                        >
                          <Icone nome="fechar" className="size-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-3 text-[13px] font-semibold text-brand">
                      {lista.length < MAX_FAIXAS_POR_DIA && (
                        <button type="button" onClick={() => adicionarFaixa(d.valor)} className="inline-flex items-center gap-1">
                          <Icone nome="mais" className="size-4" /> Adicionar faixa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCopiandoDe(copiandoDe === d.valor ? null : d.valor);
                          setDestinos([]);
                        }}
                      >
                        Copiar para outros dias
                      </button>
                    </div>
                    {copiandoDe === d.valor && (
                      <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
                        <p className="text-xs text-ink-3">Copiar os horários de {d.nome.toLowerCase()} para:</p>
                        <div className="flex flex-wrap gap-2">
                          {DIAS.filter((o) => o.valor !== d.valor).map((o) => (
                            <Chip
                              key={o.valor}
                              ativo={destinos.includes(o.valor)}
                              onClick={() =>
                                setDestinos(destinos.includes(o.valor) ? destinos.filter((x) => x !== o.valor) : [...destinos, o.valor])
                              }
                            >
                              {o.curto}
                            </Chip>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={destinos.length === 0}
                          onClick={aplicarCopia}
                          className="self-start rounded-[11px] bg-brand px-3 py-2 text-[13px] font-bold text-brand-ink disabled:opacity-50"
                        >
                          Copiar
                        </button>
                        <p className="text-xs text-ink-3">Os horários que esses dias já tinham são substituídos.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-3">Não trabalho neste dia</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <button type="button" onClick={salvar} disabled={!mudou || problemas.length > 0 || salvando} className={ESTILO_BOTAO_PRINCIPAL}>
          {salvando ? "Salvando…" : "Salvar horários"}
        </button>
        <p aria-live="polite" className="min-h-4 text-center text-xs text-ink-3">
          {problemas.length > 0
            ? `Para salvar: ${frase(problemas)}`
            : aviso?.tipo === "erro"
              ? aviso.texto
              : mudou
                ? "Você tem alterações não salvas."
                : (aviso?.texto ?? "")}
        </p>
      </div>
    </div>
  );
}
