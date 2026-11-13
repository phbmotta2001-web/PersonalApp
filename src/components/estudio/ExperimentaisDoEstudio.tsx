"use client";

import { useState, useTransition, type ReactNode } from "react";
import { desistenciaExperimental, type EstudioCompleto } from "@/data/estudio";
import { curtoDoDia, dataCurta, diaDaSemana, emBrasilia } from "@/lib/expediente";
import { Aviso } from "../Formulario";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const porcento = (mat: number, des: number) => (mat + des ? `${Math.round((mat / (mat + des)) * 100)}%` : "—");

/**
 * Decisão 92: alunos em aula experimental (nome em azul). Tocando, a coordenação escolhe
 * "Cadastrar aluno" (dias e horários) ou "Desistência".
 */
export function AlunosEmExperimental({
  estudio,
  hoje,
  atualizar,
  escolherTurmas,
}: {
  estudio: EstudioCompleto;
  hoje: string;
  atualizar: () => void;
  /** As turmas do aluno (o mesmo "Colocar em turmas" dos alunos), gravando como matrícula. */
  escolherTurmas: (alunoId: string) => ReactNode;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  if (estudio.experimentais.length === 0) return null;
  const professor = (id: string | null) => estudio.equipe.find((m) => m.personalId === id)?.nome.split(" ")[0];
  const quando = (a: EstudioCompleto["experimentais"][number]) => {
    const b = a.inicio ? emBrasilia(a.inicio) : null;
    return `${curtoDoDia(diaDaSemana(a.data))}, ${dataCurta(a.data)}${b ? ` às ${b.hora}` : ""}`;
  };

  const desistiu = (id: string, nome: string) => {
    if (!confirm(`Marcar a desistência de ${nome}? O nome sai da lista de alunos.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await desistenciaExperimental(id);
      if (!r.ok) return setErro(r.erro);
      setAberto(null);
      atualizar();
    });
  };

  return (
    <section className="flex flex-col gap-2" aria-label="Em aula experimental">
      <h2 className="text-[18px] font-bold">Aula experimental ({estudio.experimentais.length})</h2>
      <Aviso>{erro}</Aviso>
      <ul className="flex flex-col gap-2">
        {estudio.experimentais.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-[18px] border border-l-[5px] border-line border-l-info bg-surface px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setAberto(aberto === a.id ? null : a.id);
                setCadastrando(null);
              }}
              className="flex items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-info">{a.nome}</span>
                <span className="block text-[13px] text-ink-3">
                  {a.data < hoje ? "Fez a experimental em " : "Experimental "}
                  {quando(a)}
                  {professor(a.professorId) && ` · ${professor(a.professorId)}`}
                </span>
              </span>
              <span className="text-ink-3" aria-hidden="true">
                {aberto === a.id ? "▴" : "▾"}
              </span>
            </button>
            {aberto === a.id && (
              <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface-2 p-3">
                {cadastrando === a.id ? (
                  escolherTurmas(a.id)
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setCadastrando(a.id)} className="min-h-[46px] flex-1 rounded-[13px] bg-brand px-4 font-bold text-brand-ink">
                      Cadastrar aluno
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => desistiu(a.id, a.nome)}
                      className="min-h-[46px] flex-1 rounded-[13px] border border-line bg-surface px-4 font-bold text-bad"
                    >
                      Desistência
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

type Conta = { total: number; mat: number; des: number };

function Linha({ rotulo, c }: { rotulo: string; c: Conta }) {
  return (
    <li className="flex items-center gap-3 py-2 text-[14.5px]">
      <span className="min-w-0 flex-1">
        <b>{rotulo}</b>
        <span className="block text-[13px] text-ink-3">
          {c.total} experimenta{c.total === 1 ? "l" : "is"} · {c.mat} {c.mat === 1 ? "entrou" : "entraram"}
          {c.total - c.mat - c.des > 0 && ` · ${c.total - c.mat - c.des} sem resposta`}
        </span>
      </span>
      <span className="text-[19px] font-extrabold text-info">{porcento(c.mat, c.des)}</span>
    </li>
  );
}

/** Decisão 92: experimentais por mês e por professor, com a taxa de conversão. */
export function ConversaoDasExperimentais({ estudio }: { estudio: EstudioCompleto }) {
  const [porProfessor, setPorProfessor] = useState(false);
  const historico = estudio.historicoExperimentais;
  if (historico.length === 0) return null;

  const somar = (chave: (h: (typeof historico)[number]) => string) => {
    const m = new Map<string, Conta>();
    for (const h of historico) {
      const k = chave(h);
      const c = m.get(k) ?? { total: 0, mat: 0, des: 0 };
      c.total += 1;
      if (h.resultado === "matriculou") c.mat += 1;
      if (h.resultado === "desistiu") c.des += 1;
      m.set(k, c);
    }
    return m;
  };
  const meses = [...somar((h) => h.data.slice(0, 7)).entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const professores = [...somar((h) => h.professorId ?? "").entries()]
    .map(([id, c]) => ({ nome: estudio.equipe.find((m) => m.personalId === id)?.nome ?? "Sem professor", ...c }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  const geral = somar(() => "todos").get("todos")!;

  return (
    <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface px-4 py-3" aria-label="Experimentais">
      <div className="flex items-center gap-2 pb-1">
        <h2 className="flex-1 text-[16px] font-semibold">Experimentais</h2>
        <span className="text-[13px] text-ink-3">conversão</span>
        <span className="text-[19px] font-extrabold text-info">{porcento(geral.mat, geral.des)}</span>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Ver por">
        {(
          [
            [false, "Por mês"],
            [true, "Por professor"],
          ] as const
        ).map(([v, rotulo]) => (
          <button
            key={rotulo}
            type="button"
            aria-pressed={porProfessor === v}
            onClick={() => setPorProfessor(v)}
            className={`rounded-full border px-3 py-1 text-[13.5px] font-semibold ${porProfessor === v ? "border-info bg-info-soft text-info" : "border-line text-ink-2"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {porProfessor
          ? professores.map((p) => <Linha key={p.nome} rotulo={p.nome} c={p} />)
          : meses.map(([mes, c]) => <Linha key={mes} rotulo={`${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`} c={c} />)}
      </ul>
      <p className="text-[12.5px] text-ink-3">A conversão conta só quem já teve resposta (entrou ou desistiu).</p>
    </section>
  );
}
