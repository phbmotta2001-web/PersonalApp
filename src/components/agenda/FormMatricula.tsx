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
  INTERVALO_MAXIMO,
  LIMITE_LOCAL,
  MODALIDADES,
  ordenarHorarios,
  problemasDaMatricula,
  proximaDataNoDia,
  proximoVencimento,
  type DadosMatricula,
  type HorarioOcupado,
  type Matricula,
} from "@/lib/matricula";
import { aulasNoMes, mensalidadeDaTabela, PLANOS_ONLINE, type TabelaDeValores, type TabelaOnline } from "@/lib/precos";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

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
  tabelaOnline,
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
  /** Valor total de cada plano online (mensal, trimestral, semestral, anual). */
  tabelaOnline: TabelaOnline;
  /** "AAAA-MM-DD" em Brasília */
  hoje: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosMatricula>(() => ({
    modalidade: atual?.modalidade ?? "presencial",
    intervaloSemanas: atual?.intervaloSemanas ?? 1,
    cicloMeses: atual?.cicloMeses ?? 1,
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
  const [vencimentoMexido, setVencimentoMexido] = useState(!!atual);
  // Data mostrada no campo; no banco fica o dia do mês (diaVencimento).
  const [vencimento, setVencimento] = useState(() =>
    atual
      ? atual.diaVencimento != null
        ? proximaDataNoDia(hoje, atual.diaVencimento)
        : ""
      : proximoVencimento(hoje, diaDoMes(hoje)),
  );
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const online = dados.modalidade === "online";
  const presencial = dados.modalidade === "presencial";
  // Meses de cada cobrança: presencial é sempre mensal; online e híbrido seguem o plano.
  const ciclo = presencial ? 1 : dados.cicloMeses;
  const problemas = problemasDaMatricula(dados);
  const choques = online ? [] : choquesComOutros(dados.horarios, dados.duracao, ocupados);
  const fora = !online && faixas.length > 0 ? foraDoExpediente(dados.horarios, dados.duracao, faixas) : [];
  const doPlano = tabelaOnline[dados.cicloMeses];
  const tabelaOnlineVazia = Object.keys(tabelaOnline).length === 0;
  const nomeDoPlano = PLANOS_ONLINE.find((pl) => pl.meses === dados.cicloMeses)?.rotulo ?? "Mensal";
  const primeiro = nomeAluno.split(" ")[0];
  const vezes = dados.horarios.length;
  // Presencial e híbrido: pelas aulas presenciais do mês (o híbrido não paga o online à parte).
  const daTabela = mensalidadeDaTabela(tabela, vezes, dados.intervaloSemanas);
  const noMes = String(Math.round(aulasNoMes(vezes, dados.intervaloSemanas) * 10) / 10).replace(".", ",");
  const tabelaVazia = Object.keys(tabela).length === 0;

  const mudar = (parte: Partial<DadosMatricula>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };
  // Novo ciclo ou novo tipo: o 1º vencimento acompanha (se o personal não escolheu à mão).
  const mudarCiclo = (parte: Partial<DadosMatricula>) => {
    const novo = { ...dados, ...parte };
    const novoCiclo = novo.modalidade === "presencial" ? 1 : novo.cicloMeses;
    if (!vencimentoMexido && novo.inicio && novo.diaVencimento != null)
      setVencimento(proximoVencimento(novo.inicio, novo.diaVencimento, novoCiclo));
    setErro(null);
    setDados(novo);
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
        const r = await salvarMatricula(vinculoId, dados);
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold text-ink-2">Tipo de acompanhamento</legend>
        <div className="grid grid-cols-3 gap-2">
          {MODALIDADES.map((m) => (
            <button
              key={m.valor}
              type="button"
              aria-pressed={dados.modalidade === m.valor}
              onClick={() =>
                mudarCiclo({
                  modalidade: m.valor,
                  // Híbrido costuma ser a cada 15 dias; presencial, toda semana.
                  intervaloSemanas: m.valor === "hibrido" ? 2 : m.valor === "presencial" ? 1 : dados.intervaloSemanas,
                })
              }
              className={`min-h-11 rounded-[13px] border text-sm font-bold ${
                dados.modalidade === m.valor ? "border-ink bg-ink text-app" : "border-line bg-surface"
              }`}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">{MODALIDADES.find((m) => m.valor === dados.modalidade)?.texto}</p>
      </fieldset>

      {!online && (
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[13px] font-bold text-ink-2">
          {presencial ? `Dias e horários fixos de ${primeiro}` : `Aulas presenciais de ${primeiro}`}
        </legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Frequência">
          <Chip ativo={dados.intervaloSemanas === 1} onClick={() => mudar({ intervaloSemanas: 1 })}>
            Toda semana
          </Chip>
          <Chip ativo={dados.intervaloSemanas === 2} onClick={() => mudar({ intervaloSemanas: 2 })}>
            A cada 15 dias
          </Chip>
          <Chip ativo={dados.intervaloSemanas > 2} onClick={() => mudar({ intervaloSemanas: 3 })}>
            Personalizada
          </Chip>
        </div>
        {dados.intervaloSemanas > 2 && (
          <div className="flex items-center gap-2">
            <label htmlFor="mat-intervalo" className="text-sm font-semibold">
              Uma vez a cada
            </label>
            <select
              id="mat-intervalo"
              value={dados.intervaloSemanas}
              onChange={(e) => mudar({ intervaloSemanas: Number(e.target.value) })}
              className={estiloSelect}
            >
              {Array.from({ length: INTERVALO_MAXIMO - 2 }, (_, i) => i + 3).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-sm text-ink-2">semanas</span>
          </div>
        )}
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
      )}

      {!online && (
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
      )}

      {!online && (
      <Campo id="mat-local" rotulo="Local" opcional ajuda="Ex.: Academia do Centro, casa do aluno, online.">
        <input
          id="mat-local"
          value={dados.local}
          maxLength={LIMITE_LOCAL}
          onChange={(e) => mudar({ local: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>
      )}

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Mensalidade">
        <p className="text-[13px] font-bold text-ink-2">{online ? "Plano online" : "Mensalidade"}</p>
        {!presencial && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Plano">
            {PLANOS_ONLINE.map((pl) => (
              <Chip key={pl.meses} ativo={dados.cicloMeses === pl.meses} onClick={() => mudarCiclo({ cicloMeses: pl.meses })}>
                {pl.rotulo}
              </Chip>
            ))}
          </div>
        )}
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
            {(online ? !tabelaOnlineVazia : !tabelaVazia) && (
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
            {online ? (
              doPlano != null ? (
                <div>
                  <p className="text-[20px] font-extrabold tabular-nums">
                    {centavosParaReais(doPlano)}
                    {ciclo === 1 ? " por mês" : ` a cada ${ciclo} meses`}
                  </p>
                  <p className="text-xs text-ink-3">Plano {nomeDoPlano.toLowerCase()} da sua tabela online</p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-2">
                  {tabelaOnlineVazia
                    ? "Cadastre seus planos online e o valor sai pronto."
                    : `Sua tabela online não tem o plano ${nomeDoPlano.toLowerCase()}.`}{" "}
                  <Link href="/agenda/valores" className="font-semibold text-brand">
                    {tabelaOnlineVazia ? "Cadastrar planos" : "Completar a tabela"}
                  </Link>
                </p>
              )
            ) : vezes === 0 ? (
              <p className="text-[13px] text-ink-3">Marque os dias para ver o valor.</p>
            ) : daTabela != null ? (
              <div>
                <p className="text-[20px] font-extrabold tabular-nums">
                  {centavosParaReais(daTabela * ciclo)}
                  {ciclo === 1 ? " por mês" : ` a cada ${ciclo} meses`}
                </p>
                <p className="text-xs text-ink-3">
                  {centavosParaReais(tabela[vezes] ?? 0)} por aula × {noMes} aula{noMes === "1" ? "" : "s"} no mês
                  {noMes.includes(",") && " (média)"}
                  {ciclo > 1 && ` × ${ciclo} meses`}
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
        <p className="text-xs text-ink-3">As cobranças saem sozinhas a partir daqui (tela Cobranças).</p>
      </section>

      <section className="flex flex-col gap-3" aria-label="Datas">
        <div className="grid grid-cols-2 gap-3">
          <Campo id="mat-inicio" rotulo={atual ? "Início" : "Início (1º pagamento)"}>
            <input
              id="mat-inicio"
              type="date"
              value={dados.inicio}
              disabled={!!atual}
              onChange={(e) => {
                const inicio = e.target.value;
                if (!inicio) return mudar({ inicio });
                if (!vencimentoMexido) {
                  setVencimento(proximoVencimento(inicio, diaDoMes(inicio), ciclo));
                  return mudar({ inicio, diaVencimento: diaDoMes(inicio) });
                }
                // Dia escolhido à mão: mantém o dia, mas o vencimento nunca fica antes do início.
                if (vencimento <= inicio && dados.diaVencimento != null)
                  setVencimento(proximoVencimento(inicio, dados.diaVencimento, ciclo));
                mudar({ inicio });
              }}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <Campo id="mat-venc" rotulo={atual ? "Próximo vencimento" : "1º vencimento"}>
            <input
              id="mat-venc"
              type="date"
              value={vencimento}
              min={atual ? hoje : dados.inicio}
              onChange={(e) => {
                const data = e.target.value;
                setVencimentoMexido(true);
                setVencimento(data);
                mudar({ diaVencimento: data ? diaDoMes(data) : null });
              }}
              className={ESTILO_CAIXA}
            />
          </Campo>
        </div>
        {dados.diaVencimento != null && (
          <p className="-mt-1 text-xs text-ink-3">
            {atual || vencimentoMexido
              ? ""
              : `Calculado sozinho: ${ciclo === 1 ? "um mês" : `${ciclo} meses`} depois do início. `}
            Depois, vence {ciclo === 1 ? "todo" : `a cada ${ciclo} meses, no`} dia {dados.diaVencimento}
            {dados.diaVencimento > 28 ? " (ou no último dia, nos meses mais curtos)" : ""}. Você pode mudar a data.
          </p>
        )}
        <Campo id="mat-fim" rotulo="Termina em" opcional ajuda="Deixe vazio se a matrícula não tem data para acabar.">
          <input
            id="mat-fim"
            type="date"
            value={dados.fim}
            min={atual ? hoje : dados.inicio}
            onChange={(e) => mudar({ fim: e.target.value })}
            className={ESTILO_CAIXA}
          />
        </Campo>
      </section>

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
