"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { criarAula, livresNoDia, type NovaAula, type Reposicao } from "@/data/aulas";
import { dataCurta, DURACOES, minParaHora, opcoesDeHora, type Duracao } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const TIPOS = [
  { valor: "avulsa", rotulo: "Avulsa", texto: "Uma aula extra, fora dos horários fixos." },
  { valor: "reposicao", rotulo: "Reposição", texto: "Usa uma reposição que o aluno ganhou." },
  { valor: "experimental", rotulo: "Experimental", texto: "Para quem ainda não é seu aluno." },
] as const;

/** Marcar uma aula avulsa, de reposição ou experimental. */
export function FormNovaAula({
  alunos,
  reposicoes,
  duracaoPadrao,
  diaInicial,
  horaInicial = -1,
}: {
  alunos: { vinculoId: string; nome: string; local: string | null }[];
  reposicoes: Record<string, Reposicao[]>;
  duracaoPadrao: Duracao;
  /** "AAAA-MM-DD" */
  diaInicial: string;
  /** Horário já escolhido (minutos), ou -1. */
  horaInicial?: number;
}) {
  const router = useRouter();
  const [nova, setNova] = useState<NovaAula>({
    vinculoId: alunos[0]?.vinculoId ?? null,
    nome: "",
    origem: "avulsa",
    data: diaInicial,
    inicioMin: horaInicial,
    duracao: duracaoPadrao,
    local: alunos[0]?.local ?? "",
  });
  const [livres, setLivres] = useState<number[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  useEffect(() => {
    let atual = true;
    livresNoDia(nova.data, nova.duracao).then((l) => {
      if (atual) setLivres(l);
    });
    return () => {
      atual = false;
    };
  }, [nova.data, nova.duracao]);

  const mudar = (parte: Partial<NovaAula>) => {
    setErro(null);
    setNova({ ...nova, ...parte });
  };
  const escolherAluno = (vinculoId: string | null) =>
    mudar({ vinculoId, local: alunos.find((a) => a.vinculoId === vinculoId)?.local ?? nova.local });

  // Na reposição, só aparecem alunos que têm reposição; na experimental, também "quem não é aluno".
  const opcoes = nova.origem === "reposicao" ? alunos.filter((a) => reposicoes[a.vinculoId]?.length) : alunos;
  const credito = nova.vinculoId ? reposicoes[nova.vinculoId]?.[0] : undefined;
  const semAluno = nova.vinculoId === null;
  const pronto = nova.inicioMin >= 0 && (semAluno ? nova.origem === "experimental" && nova.nome.trim().length >= 2 : true);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronto) return setErro(semAluno && nova.origem !== "experimental" ? "Escolha o aluno." : "Escolha o horário.");
    iniciar(async () => {
      try {
        const r = await criarAula(nova);
        if (!r.ok) return setErro(r.erro);
        router.replace(`/agenda/calendario?dia=${nova.data}`);
        router.refresh();
      } catch {
        setErro("Não foi possível marcar agora. Confira sua internet.");
      }
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-bold text-ink-2">Tipo de aula</legend>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={nova.origem === t.valor}
              onClick={() => {
                const lista = t.valor === "reposicao" ? alunos.filter((a) => reposicoes[a.vinculoId]?.length) : alunos;
                const manter = lista.some((a) => a.vinculoId === nova.vinculoId) || (t.valor === "experimental" && semAluno);
                mudar({ origem: t.valor, vinculoId: manter ? nova.vinculoId : (lista[0]?.vinculoId ?? null) });
              }}
              className={`min-h-11 rounded-[13px] border text-[15px] font-bold ${
                nova.origem === t.valor ? "border-ink bg-ink text-app" : "border-line bg-surface"
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-3">{TIPOS.find((t) => t.valor === nova.origem)?.texto}</p>
      </fieldset>

      {nova.origem === "reposicao" && opcoes.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line p-3 text-[14px] text-ink-3">
          Nenhum aluno tem reposição disponível agora. Reposições surgem quando uma aula é cancelada com antecedência.
        </p>
      ) : (
        <Campo id="aula-aluno" rotulo="Aluno">
          <select
            id="aula-aluno"
            value={nova.vinculoId ?? ""}
            onChange={(e) => escolherAluno(e.target.value || null)}
            className={ESTILO_CAIXA}
          >
            {opcoes.map((a) => (
              <option key={a.vinculoId} value={a.vinculoId}>
                {a.nome}
                {reposicoes[a.vinculoId]?.length
                  ? ` (${reposicoes[a.vinculoId].length} reposiç${reposicoes[a.vinculoId].length > 1 ? "ões" : "ão"})`
                  : ""}
              </option>
            ))}
            {nova.origem === "experimental" && <option value="">Quem ainda não é meu aluno</option>}
          </select>
        </Campo>
      )}
      {nova.origem === "reposicao" && credito && (
        <p className="-mt-3 text-[13px] text-ink-3">Usa a reposição que vale até {dataCurta(credito.validoAte)}.</p>
      )}
      {semAluno && nova.origem === "experimental" && (
        <Campo id="aula-nome" rotulo="Nome">
          <input
            id="aula-nome"
            value={nova.nome}
            maxLength={80}
            onChange={(e) => mudar({ nome: e.target.value })}
            className={ESTILO_CAIXA}
          />
        </Campo>
      )}

      <Campo id="aula-data" rotulo="Dia">
        <input
          id="aula-data"
          type="date"
          value={nova.data}
          onChange={(e) => {
            setLivres(null);
            mudar({ data: e.target.value, inicioMin: -1 });
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-[14px] font-bold text-ink-2">Duração</legend>
        <div className="flex flex-wrap gap-2">
          {DURACOES.map((d) => (
            <Chip
              key={d}
              ativo={nova.duracao === d}
              onClick={() => {
                setLivres(null);
                mudar({ duracao: d, inicioMin: -1 });
              }}
            >
              {d} min
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-bold text-ink-2">Horário</legend>
        {livres === null ? (
          <p className="text-[13px] text-ink-3">Carregando seus horários livres…</p>
        ) : livres.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nenhum horário livre neste dia. Escolha outro dia ou um horário abaixo.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {livres.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={nova.inicioMin === m}
                onClick={() => mudar({ inicioMin: m })}
                className={`rounded-lg px-2.5 py-1.5 text-[15px] font-bold tabular-nums ${
                  nova.inicioMin === m ? "bg-ink text-app" : "bg-brand-soft text-brand"
                }`}
              >
                {minParaHora(m)}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-[13px] text-ink-3">
          Outro horário:
          <select
            value={nova.inicioMin}
            onChange={(e) => mudar({ inicioMin: Number(e.target.value) })}
            className="min-h-10 rounded-[11px] border border-line bg-surface px-2 text-[15px] tabular-nums text-ink"
          >
            <option value={-1}>—</option>
            {opcoesDeHora(0, 1440 - nova.duracao).map((m) => (
              <option key={m} value={m}>
                {minParaHora(m)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <Campo id="aula-local" rotulo="Local" opcional>
        <input
          id="aula-local"
          value={nova.local}
          maxLength={80}
          onChange={(e) => mudar({ local: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Aviso>{erro}</Aviso>
      <button
        type="submit"
        disabled={ocupado || (nova.origem === "reposicao" && opcoes.length === 0)}
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado
          ? "Marcando…"
          : nova.inicioMin >= 0
            ? `Marcar aula ${dataCurta(nova.data)} às ${minParaHora(nova.inicioMin)}`
            : "Marcar aula"}
      </button>
    </form>
  );
}
