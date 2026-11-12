"use client";

import { useState, useTransition } from "react";
import { encerrarTurmas, type EstudioCompleto } from "@/data/estudio";
import { minParaHora, opcoesDeHora } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, ESTILO_CAIXA } from "../Formulario";
import { EscolhaDeDias } from "./EscolhaDeDias";

const ROTULO = "flex flex-col gap-1 text-[14px] font-bold text-ink-2";

/**
 * Remover horários em lote (decisão 67), o espelho do cadastro: tipo, modalidade, dias e
 * "das … às …". Remove as turmas e turnos do padrão que começam dentro do intervalo.
 */
export function RemoverHorarios({ estudio, fechar, salvo }: { estudio: EstudioCompleto; fechar: () => void; salvo: () => void }) {
  const [tipo, setTipo] = useState<"turma" | "turno" | "todos">("todos");
  const [modalidade, setModalidade] = useState("");
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [de, setDe] = useState(0);
  const [ate, setAte] = useState(1440);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const doTipo = estudio.turmas.filter((t) => tipo === "todos" || t.tipo === tipo);
  const modalidades = [...new Set(doTipo.map((t) => t.modalidade))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const alvo = doTipo.filter((t) => (!modalidade || t.modalidade === modalidade) && dias.includes(t.diaSemana) && t.inicioMin >= de && t.inicioMin < ate);
  const comAlunos = alvo.filter((t) => t.alunos.length > 0).length;

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-bad/60 bg-surface p-4">
      <h3 className="text-[17px] font-bold">Remover horários</h3>
      <div className="flex flex-wrap gap-2">
        <Chip ativo={tipo === "todos"} onClick={() => setTipo("todos")}>
          Turmas e turnos
        </Chip>
        <Chip ativo={tipo === "turma"} onClick={() => setTipo("turma")}>
          Só turmas
        </Chip>
        <Chip ativo={tipo === "turno"} onClick={() => setTipo("turno")}>
          Só turnos
        </Chip>
      </div>
      <label className={ROTULO + " sm:max-w-xs"}>
        {tipo === "turno" ? "Função" : "Modalidade"}
        <select value={modalidade} onChange={(e) => setModalidade(e.target.value)} className={ESTILO_CAIXA}>
          <option value="">Todas</option>
          {modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <EscolhaDeDias valor={dias} mudar={setDias} />
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <label className={ROTULO}>
          Começando das
          <select value={de} onChange={(e) => setDe(Number(e.target.value))} className={ESTILO_CAIXA}>
            {opcoesDeHora(0, 1410).map((m) => (
              <option key={m} value={m}>
                {minParaHora(m)}
              </option>
            ))}
          </select>
        </label>
        <label className={ROTULO}>
          Às
          <select value={ate} onChange={(e) => setAte(Number(e.target.value))} className={ESTILO_CAIXA}>
            {opcoesDeHora(de + 30, 1440).map((m) => (
              <option key={m} value={m}>
                {m === 1440 ? "24:00" : minParaHora(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[14px] text-ink-2">
        {alvo.length === 0
          ? "Nenhum horário encontrado com essas escolhas."
          : `Vai remover ${alvo.length} ${alvo.length === 1 ? "horário" : "horários"} que se repetem toda semana${comAlunos ? ` (${comAlunos} com alunos, que saem da turma)` : ""}.`}{" "}
        Aulas com chamada feita ficam no histórico. Aula extra se remove tocando nela na agenda.
      </p>
      <Aviso>{aviso}</Aviso>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || alvo.length === 0}
          onClick={() => {
            if (!confirm(`Remover ${alvo.length} ${alvo.length === 1 ? "horário" : "horários"}? Não dá para desfazer.`)) return;
            iniciar(async () => {
              setAviso(null);
              const r = await encerrarTurmas(alvo.map((t) => t.id));
              salvo();
              if (!r.ok) return setAviso(r.erro);
              fechar();
            });
          }}
          className="flex min-h-[54px] w-full items-center justify-center rounded-[15px] bg-bad px-[18px] font-bold text-white hover:brightness-110 disabled:opacity-60 sm:w-auto"
        >
          {ocupado ? "Removendo…" : "Remover"}
        </button>
        <button type="button" onClick={fechar} className="px-3 font-semibold text-ink-3">
          Cancelar
        </button>
      </div>
    </div>
  );
}
