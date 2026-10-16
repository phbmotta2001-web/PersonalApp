"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { encerrarMatricula, salvarMatricula } from "@/data/matriculas";
import { DIAS, DURACOES, minParaHora, nomeDoDia, opcoesDeHora, type Duracao, type Faixa } from "@/lib/expediente";
import { frase, juntarComE } from "@/lib/formato";
import {
  centavosParaCampo,
  choquesComOutros,
  foraDoExpediente,
  LIMITE_LOCAL,
  MAX_HORARIOS,
  ordenarHorarios,
  problemasDaMatricula,
  type DadosMatricula,
  type HorarioFixo,
  type HorarioOcupado,
  type Matricula,
} from "@/lib/matricula";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

const estiloSelect = "min-h-11 rounded-[11px] border border-line bg-surface px-2 text-sm tabular-nums";

/** Criar ou alterar a matrícula de um aluno: horários fixos, duração, local, valor e datas. */
export function FormMatricula({
  vinculoId,
  nomeAluno,
  atual,
  duracaoPadrao,
  faixas,
  ocupados,
  hoje,
}: {
  vinculoId: string;
  nomeAluno: string;
  atual: Matricula | null;
  duracaoPadrao: Duracao;
  faixas: Faixa[];
  ocupados: HorarioOcupado[];
  /** "AAAA-MM-DD" em Brasília */
  hoje: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosMatricula>(() => ({
    horarios: atual?.horarios.length ? ordenarHorarios(atual.horarios) : [{ dia: 1, inicioMin: 420 }],
    duracao: atual?.duracao ?? duracaoPadrao,
    local: atual?.local ?? "",
    valor: centavosParaCampo(atual?.valorCentavos ?? null),
    diaVencimento: atual?.diaVencimento ?? null,
    inicio: atual?.inicio ?? hoje,
    fim: atual?.fim ?? "",
  }));
  const [aPartir, setAPartir] = useState(hoje);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const problemas = problemasDaMatricula(dados);
  const choques = choquesComOutros(dados.horarios, dados.duracao, ocupados);
  const fora = faixas.length > 0 ? foraDoExpediente(dados.horarios, dados.duracao, faixas) : [];
  const primeiro = nomeAluno.split(" ")[0];

  const mudar = (parte: Partial<DadosMatricula>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };
  const mudarHorario = (i: number, parte: Partial<HorarioFixo>) =>
    mudar({ horarios: dados.horarios.map((h, j) => (j === i ? { ...h, ...parte } : h)) });
  const adicionarHorario = () => {
    const usados = new Set(dados.horarios.map((h) => h.dia));
    const livre = DIAS.find((d) => !usados.has(d.valor))?.valor ?? 1;
    mudar({ horarios: [...dados.horarios, { dia: livre, inicioMin: dados.horarios.at(-1)?.inicioMin ?? 420 }] });
  };

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (problemas.length > 0 || choques.length > 0) return;
    iniciar(async () => {
      try {
        const r = await salvarMatricula(vinculoId, dados, atual ? aPartir : undefined);
        if (!r.ok) return setErro(r.erro);
        router.replace(`/agenda/alunos/${vinculoId}`);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[13px] font-bold text-ink-2">Horários fixos de {primeiro}</legend>
        {dados.horarios.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`mat-dia-${i}`}>Dia</label>
            <select
              id={`mat-dia-${i}`}
              value={h.dia}
              onChange={(e) => mudarHorario(i, { dia: Number(e.target.value) })}
              className={`${estiloSelect} flex-1`}
            >
              {DIAS.map((d) => (
                <option key={d.valor} value={d.valor}>{d.nome}</option>
              ))}
            </select>
            <span className="text-sm text-ink-2">às</span>
            <label className="sr-only" htmlFor={`mat-hora-${i}`}>Hora</label>
            <select
              id={`mat-hora-${i}`}
              value={h.inicioMin}
              onChange={(e) => mudarHorario(i, { inicioMin: Number(e.target.value) })}
              className={estiloSelect}
            >
              {opcoesDeHora(0, 1410).map((m) => (
                <option key={m} value={m}>{minParaHora(m)}</option>
              ))}
            </select>
            {dados.horarios.length > 1 && (
              <button
                type="button"
                onClick={() => mudar({ horarios: dados.horarios.filter((_, j) => j !== i) })}
                aria-label="Remover este horário"
                className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
              >
                <Icone nome="fechar" className="size-4" />
              </button>
            )}
          </div>
        ))}
        {dados.horarios.length < MAX_HORARIOS && (
          <button type="button" onClick={adicionarHorario} className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-brand">
            <Icone nome="mais" className="size-4" /> Adicionar horário
          </button>
        )}
        {choques.length > 0 && (
          <Aviso>Já {choques.length === 1 ? "é" : "são"} de outro aluno: {juntarComE(choques)}. Escolha outro horário.</Aviso>
        )}
        {fora.length > 0 && (
          <p className="rounded-[13px] bg-gold-soft px-3.5 py-2.5 text-[13px] text-gold">
            Fora do seu horário de trabalho:{" "}
            {juntarComE(fora.map((h) => `${nomeDoDia(h.dia).toLowerCase()} às ${minParaHora(h.inicioMin)}`))}. Pode salvar assim
            mesmo.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-[13px] font-bold text-ink-2">Duração da aula</legend>
        <div className="flex flex-wrap gap-2">
          {DURACOES.map((d) => (
            <Chip key={d} ativo={dados.duracao === d} onClick={() => mudar({ duracao: d })}>
              {d} min{d === duracaoPadrao ? " (padrão)" : ""}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Campo id="mat-local" rotulo="Local" opcional ajuda="Ex.: Academia do Centro, casa do aluno, online.">
        <input
          id="mat-local"
          value={dados.local}
          maxLength={LIMITE_LOCAL}
          onChange={(e) => mudar({ local: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="mat-valor" rotulo="Valor mensal" opcional>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">R$</span>
            <input
              id="mat-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={dados.valor}
              onChange={(e) => mudar({ valor: e.target.value })}
              className={`${ESTILO_CAIXA} pl-10 tabular-nums`}
            />
          </div>
        </Campo>
        <Campo id="mat-venc" rotulo="Vencimento" opcional>
          <select
            id="mat-venc"
            value={dados.diaVencimento ?? ""}
            onChange={(e) => mudar({ diaVencimento: e.target.value ? Number(e.target.value) : null })}
            className={ESTILO_CAIXA}
          >
            <option value="">—</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Dia {d}</option>
            ))}
          </select>
        </Campo>
      </div>
      <p className="-mt-3 text-xs text-ink-3">Por enquanto só fica anotado. As cobranças chegam numa próxima versão.</p>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="mat-inicio" rotulo="Início">
          <input
            id="mat-inicio"
            type="date"
            value={dados.inicio}
            disabled={!!atual}
            onChange={(e) => mudar({ inicio: e.target.value })}
            className={ESTILO_CAIXA}
          />
        </Campo>
        <Campo id="mat-fim" rotulo="Fim" opcional>
          <input
            id="mat-fim"
            type="date"
            value={dados.fim}
            min={atual ? hoje : dados.inicio}
            onChange={(e) => mudar({ fim: e.target.value })}
            className={ESTILO_CAIXA}
          />
        </Campo>
      </div>

      {atual && (
        <Campo
          id="mat-apartir"
          rotulo="As mudanças nos horários valem a partir de"
          ajuda="As aulas antes dessa data ficam como estão."
        >
          <input
            id="mat-apartir"
            type="date"
            value={aPartir}
            min={hoje}
            onChange={(e) => setAPartir(e.target.value || hoje)}
            className={ESTILO_CAIXA}
          />
        </Campo>
      )}

      <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
      <button type="submit" disabled={ocupado || choques.length > 0} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Salvando…" : atual ? "Salvar mudanças" : "Criar matrícula"}
      </button>

      {atual &&
        (encerrando ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-bad/40 bg-surface p-3.5">
            <p className="text-[13px] text-ink-2">
              Ao encerrar, as aulas futuras de {primeiro} saem da agenda e os horários dele ficam livres. {primeiro} continua
              sendo seu aluno.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEncerrando(false)}
                className="flex-1 rounded-[13px] border border-line px-3 py-2.5 text-[13px] font-bold"
              >
                Manter
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    const r = await encerrarMatricula(atual.id);
                    if (!r.ok) return setErro(r.erro);
                    router.replace(`/agenda/alunos/${vinculoId}`);
                    router.refresh();
                  })
                }
                className="flex-1 rounded-[13px] bg-bad px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
              >
                {ocupado ? "Encerrando…" : "Encerrar"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setEncerrando(true)} className="self-start text-[13px] font-semibold text-bad">
            Encerrar matrícula
          </button>
        ))}
    </form>
  );
}
