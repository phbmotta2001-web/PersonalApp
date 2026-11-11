"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { alterarAula, type AlcanceDaAula } from "@/data/estudio";
import { DIAS } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/**
 * Coordenação (decisão 63): altera ou remove uma aula escolhendo o alcance — só nesta data
 * (exceção), toda semana neste dia e horário, ou todos os dias neste horário. As duas
 * últimas mudam a grade e valem para os meses seguintes.
 */
export function AlterarAulaDoEstudio({
  aula,
  equipe,
}: {
  aula: {
    id: string;
    estudioId: string;
    data: string;
    hora: string;
    diaSemana: number;
    modalidade: string;
    vagas: number;
    turno: boolean;
    professorId: string | null;
    cancelada: boolean;
    chamadaFeita: boolean;
  };
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [alcance, setAlcance] = useState<AlcanceDaAula>("semana");
  const [professor, setProfessor] = useState(aula.professorId ?? "");
  const [modalidade, setModalidade] = useState(aula.modalidade);
  const [vagas, setVagas] = useState(aula.vagas);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const dia = DIAS.find((d) => d.valor === aula.diaSemana)?.nome.toLowerCase() ?? "";
  const ALCANCES: { valor: AlcanceDaAula; rotulo: string; texto: string }[] = [
    { valor: "dia", rotulo: `Só em ${aula.data}`, texto: "Exceção: as outras semanas continuam iguais." },
    { valor: "semana", rotulo: `Toda ${dia} às ${aula.hora}`, texto: "Vira o padrão deste horário nos próximos meses." },
    { valor: "horario", rotulo: `Todos os dias às ${aula.hora}`, texto: "Vale para todas as aulas que começam neste horário." },
  ];
  const soDia = alcance === "dia";

  const fazer = (acao: "alterar" | "remover" | "reativar") =>
    iniciar(async () => {
      setErro(null);
      const mudancas = {
        professor: professor !== (aula.professorId ?? "") || soDia ? { id: professor || null } : undefined,
        modalidade: !soDia && modalidade.trim() !== aula.modalidade ? modalidade : null,
        vagas: !soDia && !aula.turno && vagas !== aula.vagas ? vagas : null,
      };
      const r = await alterarAula(aula.id, alcance, acao, mudancas);
      if (!r.ok) return setErro(r.erro);
      // Removida da grade: a aula some, volta para a agenda.
      if (acao === "remover" && !soDia) return router.replace(`/estudio/${aula.estudioId}?aba=agenda`);
      setAberto(false);
      router.refresh();
    });

  if (aula.chamadaFeita) return null;
  if (!aberto)
    return (
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setAberto(true)} className="text-[15px] font-bold text-brand">
          Alterar ou remover esta aula
        </button>
        {aula.cancelada && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              setAlcance("dia");
              iniciar(async () => {
                const r = await alterarAula(aula.id, "dia", "reativar");
                if (!r.ok) return setErro(r.erro);
                router.refresh();
              });
            }}
            className="text-[15px] font-bold text-brand"
          >
            Reativar esta aula
          </button>
        )}
        <Aviso>{erro}</Aviso>
      </div>
    );

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-brand bg-surface p-4" aria-label="Alterar esta aula">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] font-bold text-ink-2">Aplicar a</legend>
        {ALCANCES.map((a) => (
          <label
            key={a.valor}
            className={`flex cursor-pointer items-start gap-3 rounded-[14px] border px-3 py-2.5 ${alcance === a.valor ? "border-brand bg-brand-soft" : "border-line"}`}
          >
            <input type="radio" name="alcance" checked={alcance === a.valor} onChange={() => setAlcance(a.valor)} className="mt-1 size-4" />
            <span>
              <span className="block font-semibold">{a.rotulo}</span>
              <span className="block text-[13px] text-ink-3">{a.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
        Professor
        <select value={professor} onChange={(e) => setProfessor(e.target.value)} className={ESTILO_CAIXA}>
          <option value="">Sem professor</option>
          {equipe.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      {!soDia && (
        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
            {aula.turno ? "Função" : "Modalidade"}
            <input value={modalidade} maxLength={60} onChange={(e) => setModalidade(e.target.value)} className={ESTILO_CAIXA} />
          </label>
          {!aula.turno && (
            <label className="flex w-24 flex-col gap-1.5 text-[14px] font-bold text-ink-2">
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
          )}
        </div>
      )}
      {soDia && <p className="text-[13px] text-ink-3">Só nesta data dá para trocar o professor ou cancelar a aula.</p>}

      <Aviso>{erro}</Aviso>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={ocupado} onClick={() => fazer("alterar")} className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}>
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
        {!(soDia && aula.cancelada) && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const alvo = ALCANCES.find((a) => a.valor === alcance)!.rotulo.toLowerCase();
              const pergunta = soDia
                ? `Cancelar a aula de ${aula.data}? As outras semanas continuam.`
                : `Remover da grade as aulas de ${alvo}? Os alunos dessas turmas saem delas.`;
              if (confirm(pergunta)) fazer("remover");
            }}
            className="px-2 py-2 text-[15px] font-bold text-bad"
          >
            {soDia ? "Cancelar só esta aula" : "Remover aula"}
          </button>
        )}
        <button type="button" onClick={() => setAberto(false)} className="px-2 py-2 text-[15px] font-semibold text-ink-3">
          Fechar
        </button>
      </div>
    </section>
  );
}
