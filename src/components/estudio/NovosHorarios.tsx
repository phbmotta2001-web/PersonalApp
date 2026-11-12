"use client";

import { useState, useTransition } from "react";
import { criarHorarios, type EstudioCompleto } from "@/data/estudio";
import { minParaHora, opcoesDeHora } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { EscolhaDeDias } from "./EscolhaDeDias";

const DURACOES = [30, 45, 50, 60, 75, 90, 120];
const textoDuracao = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const ROTULO = "flex flex-col gap-1 text-[14px] font-bold text-ink-2";

/**
 * Cadastro de horários (decisão 66), igual para turma e turno: um ou mais intervalos
 * "das … às …", em vários dias (padrão, toda semana) ou numa data (aula extra). Na turma, o
 * intervalo vira aulas seguidas da duração escolhida. O professor pode ficar para depois.
 */
export function NovosHorarios({ estudio, hoje, fechar, salvo }: { estudio: EstudioCompleto; hoje: string; fechar: () => void; salvo: () => void }) {
  const abertos = Object.keys(estudio.config.funcionamento).map(Number);
  // Decisão 69: sem turno; o professor de cada horário se dá em "Professor".
  const tipo = "turma" as const;
  const [extra, setExtra] = useState(false);
  const [modalidade, setModalidade] = useState("");
  const [professor, setProfessor] = useState("");
  const [dias, setDias] = useState<number[]>(abertos.includes(1) || abertos.length === 0 ? [1] : [abertos[0]]);
  const [data, setData] = useState(hoje);
  const [intervalos, setIntervalos] = useState([{ de: 360, ate: 600 }]);
  const [duracao, setDuracao] = useState(60);
  const [vagas, setVagas] = useState(Math.min(estudio.config.maxAlunosTurma, 8));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const turma = tipo === "turma";

  const porDia = intervalos.reduce((s, i) => s + (turma ? Math.max(0, Math.floor((i.ate - i.de) / duracao)) : i.ate > i.de ? 1 : 0), 0);
  const total = porDia * (extra ? 1 : dias.length);
  const mudar = (k: number, campo: "de" | "ate", v: number) =>
    setIntervalos(intervalos.map((i, j) => (j !== k ? i : campo === "de" ? { de: v, ate: Math.max(i.ate, v + (turma ? duracao : 60)) } : { ...i, ate: v })));

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-brand bg-surface p-4">
      <h3 className="text-[17px] font-bold">Novos horários</h3>
      <div className="flex flex-wrap gap-2">
        <Chip ativo={!extra} onClick={() => setExtra(false)}>
          Padrão (toda semana)
        </Chip>
        <Chip ativo={extra} onClick={() => setExtra(true)}>
          {turma ? "Aula extra (só uma data)" : "Extra (só uma data)"}
        </Chip>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ROTULO}>
          {turma ? "Modalidade" : "Função"}
          <input value={modalidade} maxLength={60} onChange={(e) => setModalidade(e.target.value)} placeholder={turma ? "Ex.: Pilates" : "Ex.: Musculação"} className={ESTILO_CAIXA} />
        </label>
        <label className={ROTULO}>
          Professor
          <select value={professor} onChange={(e) => setProfessor(e.target.value)} className={ESTILO_CAIXA}>
            <option value="">Escolher depois</option>
            {estudio.equipe.map((p) => (
              <option key={p.personalId} value={p.personalId}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {extra ? (
        <label className={ROTULO + " sm:max-w-xs"}>
          Data
          <input type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className={ESTILO_CAIXA} />
        </label>
      ) : (
        <EscolhaDeDias valor={dias} mudar={setDias} abertos={abertos} />
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Horários</legend>
        {intervalos.map((iv, k) => (
          <div key={k} className="flex items-end gap-2">
            <label className={ROTULO + " flex-1"}>
              Das
              <select value={iv.de} onChange={(e) => mudar(k, "de", Number(e.target.value))} className={ESTILO_CAIXA}>
                {opcoesDeHora(300, 1410).map((m) => (
                  <option key={m} value={m}>
                    {minParaHora(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className={ROTULO + " flex-1"}>
              Às
              <select value={iv.ate} onChange={(e) => mudar(k, "ate", Number(e.target.value))} className={ESTILO_CAIXA}>
                {opcoesDeHora(iv.de + 30, Math.min(1440, iv.de + (turma ? 1080 : 720))).map((m) => (
                  <option key={m} value={m}>
                    {m === 1440 ? "24:00" : minParaHora(m)}
                  </option>
                ))}
              </select>
            </label>
            {intervalos.length > 1 && (
              <button
                type="button"
                onClick={() => setIntervalos(intervalos.filter((_, j) => j !== k))}
                className="grid size-[52px] shrink-0 place-items-center rounded-[13px] border border-line text-[20px] text-ink-3"
                aria-label="Tirar este intervalo"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {intervalos.length < 10 && (
          <button
            type="button"
            onClick={() => {
              const ultimo = intervalos.at(-1)!;
              const de = Math.min(1380, ultimo.ate + 60);
              setIntervalos([...intervalos, { de, ate: Math.min(1440, de + 120) }]);
            }}
            className="self-start text-[15px] font-bold text-brand"
          >
            + Adicionar outro intervalo
          </button>
        )}
      </fieldset>

      {turma && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <label className={ROTULO}>
            Cada aula
            <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className={ESTILO_CAIXA}>
              {DURACOES.map((m) => (
                <option key={m} value={m}>
                  {textoDuracao(m)}
                </option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Vagas
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={vagas}
              onChange={(e) => setVagas(Number(e.target.value))}
              className={ESTILO_CAIXA}
            />
          </label>
        </div>
      )}

      <p className="text-[14px] text-ink-2">
        {total === 0
          ? "Nada para criar: confira os dias e horários."
          : `Vai criar ${total} ${turma ? (total === 1 ? "aula" : "aulas") : total === 1 ? "turno" : "turnos"}${extra ? " só nesta data" : " que se repetem toda semana"}.`}
        {!extra && total > 0 && " Vale de agora em diante: os dias desta semana que já passaram ficam vazios e aparecem a partir da semana que vem."}
      </p>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || total === 0}
          onClick={() =>
            iniciar(async () => {
              setAviso(null);
              const r = await criarHorarios(estudio.id, {
                tipo,
                modalidade,
                professorId: professor || null,
                vagas: turma ? vagas : null,
                duracao: turma ? duracao : null,
                dias: extra ? null : dias,
                data: extra ? data : null,
                intervalos,
              });
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              salvo();
              fechar();
            })
          }
          className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={fechar} className="px-3 font-semibold text-ink-3">
          Cancelar
        </button>
      </div>
    </div>
  );
}
