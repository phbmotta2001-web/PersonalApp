"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { avisarFaltaNoEstudio, desfazerFaltaNoEstudio, trocarHorarioNoEstudio } from "@/data/aluno-estudio";
import { aulasDoEstudio, type AlunoNaChamada, type AulaNaAgendaDoEstudio } from "@/data/estudio";
import { emBrasilia, instante, somarDias } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const BOTAO = "shrink-0 rounded-[10px] border px-2.5 py-1 text-[13.5px] font-semibold";

/**
 * Antes da chamada: a lista da aula. O professor avisa a falta de um aluno por ele ou, decisão 100,
 * troca o aluno de horário só neste dia (o lugar dele na turma continua o mesmo).
 */
export function AlunosAntesDaAula({
  aulaId,
  alunos,
  estudioId,
  dataDaAula,
  equipe,
}: {
  aulaId: string;
  alunos: AlunoNaChamada[];
  estudioId: string;
  /** "AAAA-MM-DD" desta aula. */
  dataDaAula: string;
  equipe: { personalId: string; nome: string }[];
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const primeiro = (nome: string) => nome.split(" ")[0];

  const rotulo = (a: AlunoNaChamada) =>
    a.situacao === "falta_avisada"
      ? a.trocou
        ? { texto: "Trocou de horário neste dia", cor: "text-info" }
        : { texto: "Vai faltar", cor: "text-gold" }
      : a.troca
        ? { texto: "Veio de outro horário", cor: "text-info" }
        : a.reposicao
          ? { texto: "Reposição", cor: "text-estudio" }
          : null;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {alunos.map((a) => {
          const r = rotulo(a);
          const daTurma = !a.reposicao && !a.experimental && !a.troca;
          return (
            <li key={a.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.nome}</span>
                  {r && <span className={`block text-[13px] font-semibold ${r.cor}`}>{r.texto}</span>}
                  {/* Decisão 106: o treino do aluno neste dia. */}
                  {a.treino && <span className="mt-0.5 block text-[14px] whitespace-pre-line text-ink-2"><b className="text-estudio">Treino:</b> {a.treino}</span>}
                </span>
                {daTurma && a.situacao !== "falta_avisada" && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => {
                      setAviso(null);
                      setTrocando(trocando === a.id ? null : a.id);
                    }}
                    className={`${BOTAO} ${trocando === a.id ? "border-info bg-info-soft text-info" : "border-line text-ink-2"}`}
                  >
                    Trocar horário
                  </button>
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    iniciar(async () => {
                      setTrocando(null);
                      if (a.situacao === "falta_avisada") {
                        const x = await desfazerFaltaNoEstudio(aulaId, a.id);
                        setAviso(x.ok ? { tipo: "ok", texto: `${primeiro(a.nome)} volta para a aula.` } : { tipo: "erro", texto: x.erro });
                      } else {
                        if (!confirm(`Avisar que ${primeiro(a.nome)} vai faltar?`)) return;
                        const x = await avisarFaltaNoEstudio(aulaId, a.id);
                        setAviso(
                          x.ok
                            ? { tipo: "ok", texto: x.credito ? `Falta avisada: ${primeiro(a.nome)} ganhou uma reposição.` : "Falta avisada (fora do prazo: sem reposição)." }
                            : { tipo: "erro", texto: x.erro },
                        );
                      }
                      router.refresh();
                    })
                  }
                  className={`${BOTAO} ${a.situacao === "falta_avisada" ? "border-brand text-brand" : "border-line text-ink-2"}`}
                >
                  {/* Botão (não é aviso): o professor registra a falta que o aluno avisou fora do app. */}
                  {a.situacao === "falta_avisada" ? (a.trocou ? "Desfazer troca" : "Desfazer falta") : "Marcar falta"}
                </button>
              </div>
              {trocando === a.id && (
                <TrocarHorario
                  aulaId={aulaId}
                  aluno={a}
                  estudioId={estudioId}
                  dataDaAula={dataDaAula}
                  equipe={equipe}
                  terminar={(texto) => {
                    setTrocando(null);
                    setAviso({ tipo: "ok", texto });
                    router.refresh();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
    </div>
  );
}

/** Escolher a aula (com vaga) para onde o aluno vai só neste dia. */
function TrocarHorario({
  aulaId,
  aluno,
  estudioId,
  dataDaAula,
  equipe,
  terminar,
}: {
  aulaId: string;
  aluno: AlunoNaChamada;
  estudioId: string;
  dataDaAula: string;
  equipe: { personalId: string; nome: string }[];
  terminar: (texto: string) => void;
}) {
  const [data, setData] = useState(dataDaAula);
  const [aulas, setAulas] = useState<AulaNaAgendaDoEstudio[] | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, carregar] = useTransition();
  const [ocupado, iniciar] = useTransition();
  const professor = (id: string | null) => equipe.find((m) => m.personalId === id)?.nome.split(" ")[0];

  const buscar = (d: string) =>
    carregar(async () => {
      const lista = await aulasDoEstudio(estudioId, instante(d, 0).toISOString(), instante(somarDias(d, 1), 0).toISOString());
      const agora = Date.now();
      setAulas(lista.filter((x) => x.id !== aulaId && !x.cancelada && x.tipo === "turma" && Date.parse(x.inicio) > agora && x.alunos < x.vagas));
    });
  const escolherDia = (d: string) => {
    setData(d);
    setDestino(null);
    setAulas(null);
    setErro(null);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) buscar(d);
  };

  // Abre já no dia desta aula.
  useEffect(() => {
    buscar(dataDaAula);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-info-soft/60 p-3">
      <p className="text-[13.5px] text-ink-2">
        Só neste dia: nas outras semanas, {aluno.nome.split(" ")[0]} continua no horário dele. O professor da outra aula é avisado.
      </p>
      <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
        Dia
        <input type="date" value={data} onChange={(e) => escolherDia(e.target.value)} className={ESTILO_CAIXA} />
      </label>
      {carregando && <p className="text-[14px] text-ink-3">Buscando as aulas…</p>}
      {aulas && aulas.length === 0 && <p className="text-[14px] text-ink-3">Nenhuma outra aula com vaga neste dia.</p>}
      {aulas && aulas.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1 text-[14px] font-bold text-ink-2">Aula</legend>
          {aulas.map((x) => (
            <label
              key={x.id}
              className={`flex items-center gap-3 rounded-[12px] border bg-surface px-3 py-2.5 text-[15px] ${destino === x.id ? "border-info" : "border-line"}`}
            >
              <input type="radio" name={`troca-${aluno.id}`} checked={destino === x.id} onChange={() => setDestino(x.id)} />
              <span className="flex-1">
                <b>{emBrasilia(x.inicio).hora}</b> · {x.modalidade}
                {professor(x.professorId) && <span className="text-ink-3"> · {professor(x.professorId)}</span>}
              </span>
              <span className="text-[13px] text-ink-3">
                {x.alunos}/{x.vagas}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <Aviso>{erro}</Aviso>
      {destino && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              setErro(null);
              const r = await trocarHorarioNoEstudio(aulaId, aluno.id, destino);
              if (!r.ok) return setErro(r.erro);
              terminar(`${aluno.nome.split(" ")[0]} vai à aula de ${r.aula}.`);
            })
          }
          className={ESTILO_BOTAO_PRINCIPAL}
        >
          {ocupado ? "Trocando…" : "Confirmar troca"}
        </button>
      )}
    </div>
  );
}
