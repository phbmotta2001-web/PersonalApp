"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { encerrarMatricula, salvarMatricula } from "@/data/matriculas";
import { DIAS, DURACOES, minParaHora, nomeDoDia, opcoesDeHora, type Duracao, type Faixa } from "@/lib/expediente";
import { frase, juntarComE } from "@/lib/formato";
import {
  centavosParaCampo,
  centavosParaReais,
  choquesComOutros,
  diaDoMes,
  foraDoExpediente,
  LIMITE_LOCAL,
  ordenarHorarios,
  problemasDaMatricula,
  proximoVencimento,
  type DadosMatricula,
  type HorarioOcupado,
  type Matricula,
} from "@/lib/matricula";
import { mensalidadeDaTabela, SEMANAS_POR_MES, type TabelaDeValores } from "@/lib/precos";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

/** "2026-11-16" → "16/11/2026" */
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const estiloSelect = "min-h-11 rounded-[11px] border border-line bg-surface px-2 text-sm tabular-nums";

/** Criar ou alterar a matrícula de um aluno: dias e horas fixos, duração, local, mensalidade e datas. */
export function FormMatricula({
  vinculoId,
  nomeAluno,
  atual,
  duracaoPadrao,
  faixas,
  ocupados,
  tabela,
  hoje,
}: {
  vinculoId: string;
  nomeAluno: string;
  atual: Matricula | null;
  duracaoPadrao: Duracao;
  faixas: Faixa[];
  ocupados: HorarioOcupado[];
  /** Valor de cada aula por vezes na semana (tela Valores). */
  tabela: TabelaDeValores;
  /** "AAAA-MM-DD" em Brasília */
  hoje: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosMatricula>(() => ({
    horarios: atual?.horarios.length ? ordenarHorarios(atual.horarios) : [],
    duracao: atual?.duracao ?? duracaoPadrao,
    local: atual?.local ?? "",
    valorForaDoPadrao: atual?.valorForaDoPadrao ?? false,
    valor: atual?.valorForaDoPadrao ? centavosParaCampo(atual.valorCentavos) : "",
    // Novo: vence no mesmo dia do início (um mês depois); o personal pode trocar.
    diaVencimento: atual ? atual.diaVencimento : diaDoMes(hoje),
    inicio: atual?.inicio ?? hoje,
    fim: atual?.fim ?? "",
  }));
  // Marcar um dia já traz a hora do último dia mexido (ou 07:00).
  const [ultimaHora, setUltimaHora] = useState(atual?.horarios.at(-1)?.inicioMin ?? 420);
  const [aPartir, setAPartir] = useState(hoje);
  const [vencimentoMexido, setVencimentoMexido] = useState(!!atual);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const problemas = problemasDaMatricula(dados);
  const choques = choquesComOutros(dados.horarios, dados.duracao, ocupados);
  const fora = faixas.length > 0 ? foraDoExpediente(dados.horarios, dados.duracao, faixas) : [];
  const primeiro = nomeAluno.split(" ")[0];
  const vezes = dados.horarios.length;
  const daTabela = mensalidadeDaTabela(tabela, vezes);
  const tabelaVazia = Object.keys(tabela).length === 0;

  const mudar = (parte: Partial<DadosMatricula>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };
  const marcado = (dia: number) => dados.horarios.some((h) => h.dia === dia);
  const marcarDia = (dia: number) =>
    mudar({
      horarios: marcado(dia)
        ? dados.horarios.filter((h) => h.dia !== dia)
        : ordenarHorarios([...dados.horarios, { dia, inicioMin: ultimaHora }]),
    });
  const mudarHora = (dia: number, inicioMin: number) => {
    setUltimaHora(inicioMin);
    mudar({ horarios: dados.horarios.map((h) => (h.dia === dia ? { ...h, inicioMin } : h)) });
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
        <legend className="mb-2 text-[13px] font-bold text-ink-2">Dias e horários fixos de {primeiro}</legend>
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d) => {
            const ativo = marcado(d.valor);
            return (
              <button
                key={d.valor}
                type="button"
                role="checkbox"
                aria-checked={ativo}
                aria-label={d.nome}
                onClick={() => marcarDia(d.valor)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[12px] border text-[12.5px] font-bold ${
                  ativo ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-4 place-items-center rounded-[5px] border ${ativo ? "border-brand-ink" : "border-ink-3"}`}
                >
                  {ativo && <Icone nome="certo" className="size-3" />}
                </span>
                {d.curto}
              </button>
            );
          })}
        </div>
        {dados.horarios.map((h) => (
          <div key={h.dia} className="flex items-center gap-2">
            <label htmlFor={`mat-hora-${h.dia}`} className="flex-1 text-sm font-semibold">
              {nomeDoDia(h.dia)}
            </label>
            <span className="text-sm text-ink-2">às</span>
            <select
              id={`mat-hora-${h.dia}`}
              value={h.inicioMin}
              onChange={(e) => mudarHora(h.dia, Number(e.target.value))}
              className={estiloSelect}
            >
              {opcoesDeHora(0, 1410).map((m) => (
                <option key={m} value={m}>{minParaHora(m)}</option>
              ))}
            </select>
          </div>
        ))}
        {vezes === 0 && <p className="text-xs text-ink-3">Toque nos dias em que {primeiro} treina.</p>}
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

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Mensalidade">
        <p className="text-[13px] font-bold text-ink-2">Mensalidade</p>
        {dados.valorForaDoPadrao ? (
          <>
            <label htmlFor="mat-valor" className="sr-only">
              Valor mensal
            </label>
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
            {!tabelaVazia && (
              <button
                type="button"
                onClick={() => mudar({ valorForaDoPadrao: false })}
                className="self-start text-[13px] font-semibold text-brand"
              >
                Usar o valor da minha tabela
              </button>
            )}
          </>
        ) : (
          <>
            {vezes === 0 ? (
              <p className="text-[13px] text-ink-3">Marque os dias para ver o valor.</p>
            ) : daTabela != null ? (
              <div>
                <p className="text-[20px] font-extrabold tabular-nums">{centavosParaReais(daTabela)} por mês</p>
                <p className="text-xs text-ink-3">
                  {vezes}x por semana · {centavosParaReais(tabela[vezes] ?? 0)} por aula × {SEMANAS_POR_MES} semanas
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-ink-2">
                {tabelaVazia
                  ? "Cadastre seus valores por aula e a mensalidade sai pronta."
                  : `Sua tabela não tem valor para ${vezes}x por semana.`}{" "}
                <Link href="/agenda/valores" className="font-semibold text-brand">
                  {tabelaVazia ? "Cadastrar valores" : "Completar a tabela"}
                </Link>
              </p>
            )}
            <button
              type="button"
              onClick={() => mudar({ valorForaDoPadrao: true })}
              className="self-start text-[13px] font-semibold text-brand"
            >
              Valor fora do padrão
            </button>
          </>
        )}
        <Campo
          id="mat-venc"
          rotulo="Vencimento"
          ajuda={
            dados.diaVencimento != null && /^\d{4}-\d{2}-\d{2}$/.test(dados.inicio)
              ? atual
                ? `Vence todo dia ${dados.diaVencimento}.`
                : `1ª mensalidade no início (${dataBr(dados.inicio)}); a próxima vence em ${dataBr(
                    proximoVencimento(dados.inicio, dados.diaVencimento),
                  )} e depois todo dia ${dados.diaVencimento}.`
              : undefined
          }
        >
          <select
            id="mat-venc"
            value={dados.diaVencimento ?? ""}
            onChange={(e) => {
              setVencimentoMexido(true);
              mudar({ diaVencimento: e.target.value ? Number(e.target.value) : null });
            }}
            className={ESTILO_CAIXA}
          >
            {dados.diaVencimento == null && <option value="">—</option>}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
          </select>
        </Campo>
        <p className="text-xs text-ink-3">Por enquanto só fica anotado. As cobranças chegam numa próxima versão.</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="mat-inicio" rotulo="Início">
          <input
            id="mat-inicio"
            type="date"
            value={dados.inicio}
            disabled={!!atual}
            onChange={(e) =>
              mudar({
                inicio: e.target.value,
                ...(!vencimentoMexido && e.target.value ? { diaVencimento: diaDoMes(e.target.value) } : {}),
              })
            }
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
