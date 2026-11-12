"use client";

import { useState, useTransition } from "react";
import { atribuirProfessor, encerrarTurmas, type EstudioCompleto } from "@/data/estudio";
import { DIAS, minParaHora } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { FiltroDeHorarios, filtrar, useFiltro } from "./FiltroDeHorarios";
import { NovosHorarios } from "./NovosHorarios";

type Modo = "adicionar" | "remover" | "professor";
const BOTAO_VERMELHO =
  "flex min-h-[54px] w-full items-center justify-center rounded-[15px] bg-bad px-[18px] font-bold text-white hover:brightness-110 disabled:opacity-60 sm:w-auto";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * "Editar" da agenda (decisão 68): só três coisas — adicionar horários, remover (os que repetem
 * toda semana ou as aulas extras) e dar professor a horários que já existem.
 */
export function EditarHorarios({ estudio, hoje, atualizar }: { estudio: EstudioCompleto; hoje: string; atualizar: () => void }) {
  const [modo, setModo] = useState<Modo | null>(null);

  if (!modo)
    return (
      <button type="button" onClick={() => setModo("adicionar")} className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto sm:self-start"}>
        Editar
      </button>
    );

  return (
    <section className="flex flex-col gap-3.5" aria-label="Editar a agenda">
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={modo === "adicionar"} onClick={() => setModo("adicionar")}>
          Adicionar
        </Chip>
        <Chip ativo={modo === "remover"} onClick={() => setModo("remover")}>
          Remover
        </Chip>
        <Chip ativo={modo === "professor"} onClick={() => setModo("professor")}>
          Professor
        </Chip>
        <button type="button" onClick={() => setModo(null)} className="ml-auto px-2 font-semibold text-ink-3">
          Fechar
        </button>
      </div>
      {modo === "adicionar" && <NovosHorarios estudio={estudio} hoje={hoje} fechar={() => setModo(null)} salvo={atualizar} />}
      {modo === "remover" && <Remover estudio={estudio} atualizar={atualizar} fechar={() => setModo(null)} />}
      {modo === "professor" && <Professor estudio={estudio} atualizar={atualizar} fechar={() => setModo(null)} />}
    </section>
  );
}

function Remover({ estudio, atualizar, fechar }: { estudio: EstudioCompleto; atualizar: () => void; fechar: () => void }) {
  const [extras, setExtras] = useState(false);
  const [filtro, setFiltro] = useFiltro();
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const alvo = filtrar(estudio.turmas, filtro);
  const comAlunos = alvo.filter((t) => t.alunos.length > 0).length;
  const remover = (ids: string[], pergunta: string, depois?: () => void) => {
    if (!confirm(pergunta)) return;
    iniciar(async () => {
      setAviso(null);
      const r = await encerrarTurmas(ids);
      atualizar();
      if (!r.ok) return setAviso(r.erro);
      depois?.();
    });
  };

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-bad/60 bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <Chip ativo={!extras} onClick={() => setExtras(false)}>
          Toda semana
        </Chip>
        <Chip ativo={extras} onClick={() => setExtras(true)}>
          Aulas extras {estudio.extras.length > 0 && `(${estudio.extras.length})`}
        </Chip>
      </div>

      {extras ? (
        estudio.extras.length === 0 ? (
          <p className="text-ink-3">Nenhuma aula extra marcada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {estudio.extras.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1">
                  <span className="block font-bold">{x.modalidade}</span>
                  <span className="block text-[14px] text-ink-2">
                    {DIAS.find((d) => d.valor === new Date(x.data + "T12:00:00").getDay())?.curto}, {x.data.slice(8, 10)}/{x.data.slice(5, 7)} ·{" "}
                    {minParaHora(x.inicioMin)} às {minParaHora(x.inicioMin + x.duracaoMin)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => remover([x.id], `Remover a aula extra de ${x.modalidade}?`)}
                  className="rounded-[12px] border border-line px-3 py-1.5 font-bold text-bad"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <FiltroDeHorarios turmas={estudio.turmas} valor={filtro} mudar={setFiltro} />
          <p className="text-[14px] text-ink-2">
            {alvo.length === 0
              ? "Nenhum horário encontrado com essas escolhas."
              : `Vai remover ${plural(alvo.length, "horário", "horários")} que se repetem toda semana${comAlunos ? ` (${comAlunos} com alunos, que saem da turma)` : ""}.`}
          </p>
          <button
            type="button"
            disabled={ocupado || alvo.length === 0}
            onClick={() => remover(alvo.map((t) => t.id), `Remover ${plural(alvo.length, "horário", "horários")}? Não dá para desfazer.`, fechar)}
            className={BOTAO_VERMELHO}
          >
            {ocupado ? "Removendo…" : "Remover"}
          </button>
        </>
      )}
      <Aviso>{aviso}</Aviso>
    </div>
  );
}

function Professor({ estudio, atualizar, fechar }: { estudio: EstudioCompleto; atualizar: () => void; fechar: () => void }) {
  const [filtro, setFiltro] = useFiltro();
  const [professor, setProfessor] = useState(estudio.equipe[0]?.personalId ?? "");
  const [soVazios, setSoVazios] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const alvo = filtrar(estudio.turmas, filtro).filter((t) => (professor && soVazios ? t.professorId == null : t.professorId !== (professor || null)));
  const nome = estudio.equipe.find((p) => p.personalId === professor)?.nome;

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-brand bg-surface p-4">
      <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2 sm:max-w-xs">
        Professor
        <select value={professor} onChange={(e) => setProfessor(e.target.value)} className={ESTILO_CAIXA}>
          {estudio.equipe.map((p) => (
            <option key={p.personalId} value={p.personalId}>
              {p.nome}
            </option>
          ))}
          <option value="">Sem professor</option>
        </select>
      </label>
      <p className="text-[14px] font-bold text-ink-2">Em quais horários</p>
      <FiltroDeHorarios turmas={estudio.turmas} valor={filtro} mudar={setFiltro} />
      {professor && (
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={soVazios} onChange={(e) => setSoVazios(e.target.checked)} className="size-5 accent-brand" />
          Só os que estão sem professor
        </label>
      )}
      <p className="text-[14px] text-ink-2">
        {alvo.length === 0
          ? "Nenhum horário encontrado com essas escolhas."
          : professor
            ? `Vai passar ${plural(alvo.length, "horário", "horários")} para ${nome}, toda semana.`
            : `Vai deixar ${plural(alvo.length, "horário", "horários")} sem professor.`}
      </p>
      <Aviso>{aviso}</Aviso>
      <button
        type="button"
        disabled={ocupado || alvo.length === 0}
        onClick={() =>
          iniciar(async () => {
            setAviso(null);
            const r = await atribuirProfessor(estudio.id, alvo.map((t) => t.id), professor || null);
            atualizar();
            if (!r.ok) return setAviso(r.erro);
            fechar();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
      >
        {ocupado ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
