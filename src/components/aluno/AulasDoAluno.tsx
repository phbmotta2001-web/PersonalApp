"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  alunoCancelarAula,
  alunoDesistirPedido,
  alunoMarcarReposicao,
  alunoRemarcarAula,
  alunoResponderSugestao,
  livresParaAluno,
  type RegrasDoPersonal,
} from "@/data/aluno-aulas";
import { textoDeHoras } from "@/lib/aula";
import { curtoDoDia, dataCurta, diaDaSemana, emBrasilia, somarDias } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { Icone } from "../Icone";

export interface AulaDoAluno {
  id: string;
  inicio: string;
  local: string | null;
  origem: string;
  situacao: string;
  /** Pedido pendente: quem propôs o horário (o aluno pediu ou o personal sugeriu). */
  propostaPor: "aluno" | "personal" | null;
  /** Pedido de remarcação: a aula que seria trocada. */
  aulaOriginalId: string | null;
}

export interface PedidoRecusado {
  id: string;
  inicio: string;
  resposta: string | null;
}

type Acao = { tipo: "cancelar" | "remarcar"; aulaId: string } | { tipo: "reposicao" } | null;

/** Próximas aulas do aluno com um personal: cancelar, remarcar e marcar reposição. */
export function AulasDoAluno({
  vinculoId,
  nomePersonal,
  aulas,
  reposicoes,
  recusados,
  regras,
  agora,
}: {
  vinculoId: string;
  nomePersonal: string;
  aulas: AulaDoAluno[];
  /** Validade ("AAAA-MM-DD") de cada reposição disponível, da que vence antes para a que vence depois. */
  reposicoes: string[];
  /** Pedidos recusados ou expirados nos últimos dias. */
  recusados: PedidoRecusado[];
  regras: RegrasDoPersonal;
  /** Instante (ISO) em que a página foi montada no servidor. */
  agora: string;
}) {
  const router = useRouter();
  const [acao, setAcao] = useState<Acao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const primeiro = nomePersonal.split(" ")[0];
  const hoje = emBrasilia(agora).data;
  const horasAte = (inicio: string) => (Date.parse(inicio) - Date.parse(agora)) / 3_600_000;
  const comAntecedencia = (inicio: string) => horasAte(inicio) >= regras.cancelamentoH;

  const executar = (fn: () => Promise<{ ok: true } | { ok: false; erro: string }>, sucesso: string) =>
    iniciar(async () => {
      setErro(null);
      try {
        const r = await fn();
        if (!r.ok) return setErro(r.erro);
        setAcao(null);
        setFeito(sucesso);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {feito && <Aviso tipo="ok">{feito}</Aviso>}

      {reposicoes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-brand-soft p-3 text-brand">
          <p className="text-[14px]">
            Você tem <strong>{reposicoes.length}</strong> {reposicoes.length === 1 ? "reposição" : "reposições"}. A
            primeira vale até {dataCurta(reposicoes[0])}.
          </p>
          {acao?.tipo === "reposicao" ? (
            <EscolherHorario
              vinculoId={vinculoId}
              de={hoje}
              ate={reposicoes.at(-1) ?? hoje}
              ocupado={ocupado}
              textoBotao={(i) => `Marcar reposição ${textoCurto(i)}`}
              onCancelar={() => setAcao(null)}
              onEscolher={(inicio) =>
                executar(
                  () => alunoMarcarReposicao(vinculoId, inicio),
                  `Pedido de reposição enviado para ${textoCurto(inicio)}. ${primeiro} precisa aceitar: a resposta aparece aqui.`,
                )
              }
              antecedenciaH={regras.reposicaoH}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setFeito(null);
                setErro(null);
                setAcao({ tipo: "reposicao" });
              }}
              className="self-start rounded-[11px] bg-brand px-3 py-2 text-[14px] font-bold text-brand-ink"
            >
              Marcar reposição
            </button>
          )}
        </div>
      )}

      {recusados.map((r) => (
        <p key={r.id} className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px] text-ink-2">
          Seu pedido para {textoCurto(r.inicio)} não foi aceito
          {r.resposta ? `: ${r.resposta.replace(/[.!]$/, "")}.` : "."} Se era uma reposição, ela continua com você.
        </p>
      ))}

      {aulas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-ink-3">Próximas aulas</p>
          <ul className="flex flex-col divide-y divide-line">
            {aulas.map((a) => {
              const aberta = acao && "aulaId" in acao && acao.aulaId === a.id ? acao.tipo : null;
              const { data, hora } = emBrasilia(a.inicio);
              const pedida = aulas.find((x) => x.aulaOriginalId === a.id && x.situacao === "pendente");
              if (a.situacao === "pendente")
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-[15px] tabular-nums">
                        <span className="text-ink-2">
                          {curtoDoDia(diaDaSemana(data))} {dataCurta(data)}
                        </span>{" "}
                        <span className="font-bold">{hora}</span>
                        <span className="block text-[13px] text-gold">
                          {a.propostaPor === "personal"
                            ? `${primeiro} sugeriu este horário`
                            : `${a.aulaOriginalId ? "Remarcação" : "Reposição"} pedida · aguardando ${primeiro}`}
                        </span>
                      </span>
                      {a.propostaPor === "aluno" && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => executar(() => alunoDesistirPedido(a.id), "Pedido cancelado.")}
                          className="rounded-[10px] border border-line px-2.5 py-1.5 text-[13px] font-bold"
                        >
                          Desistir
                        </button>
                      )}
                    </div>
                    {a.propostaPor === "personal" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => executar(() => alunoResponderSugestao(a.id, false), "Sugestão recusada.")}
                          className="flex-1 rounded-[12px] border border-line px-3 py-2.5 text-[14px] font-bold"
                        >
                          Recusar
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() =>
                            executar(
                              () => alunoResponderSugestao(a.id, true),
                              `Combinado: aula ${textoCurto(a.inicio)}.`,
                            )
                          }
                          className="flex-1 rounded-[12px] bg-brand px-3 py-2.5 text-[14px] font-bold text-brand-ink"
                        >
                          Aceitar horário
                        </button>
                      </div>
                    )}
                  </li>
                );
              return (
                <li key={a.id} className="flex flex-col gap-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[15px] tabular-nums">
                      <span className="text-ink-2">
                        {curtoDoDia(diaDaSemana(data))} {dataCurta(data)}
                      </span>{" "}
                      <span className="font-bold">{hora}</span>
                      {a.origem === "reposicao" && <span className="text-[13px] text-ink-3"> · reposição</span>}
                    </span>
                    {pedida ? (
                      <span className="text-[13px] text-gold">Troca pedida</span>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={aberta === "remarcar"}
                        onClick={() => {
                          setFeito(null);
                          setErro(null);
                          setAcao(aberta === "remarcar" ? null : { tipo: "remarcar", aulaId: a.id });
                        }}
                        className="rounded-[10px] border border-line px-2.5 py-1.5 text-[13px] font-bold"
                      >
                        Remarcar
                      </button>
                    )}
                    <button
                      type="button"
                      aria-expanded={aberta === "cancelar"}
                      onClick={() => {
                        setFeito(null);
                        setErro(null);
                        setAcao(aberta === "cancelar" ? null : { tipo: "cancelar", aulaId: a.id });
                      }}
                      className="rounded-[10px] border border-line px-2.5 py-1.5 text-[13px] font-bold text-bad"
                    >
                      Cancelar
                    </button>
                  </div>

                  {aberta === "cancelar" && (
                    <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
                      {comAntecedencia(a.inicio) ? (
                        <p className="text-[14px] text-ink-2">
                          Você ganha uma <strong>reposição</strong>, válida até o próximo vencimento da mensalidade.{" "}
                          {primeiro} será avisado.
                        </p>
                      ) : (
                        <p className="text-[14px] text-bad">
                          Faltam menos de {textoDeHoras(regras.cancelamentoH)} para a aula: em cima da hora, ela{" "}
                          <strong>conta como dada, sem reposição</strong>.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAcao(null)}
                          className="flex-1 rounded-[12px] border border-line px-3 py-2.5 text-[14px] font-bold"
                        >
                          Manter aula
                        </button>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() =>
                            iniciar(async () => {
                              setErro(null);
                              try {
                                const r = await alunoCancelarAula(a.id);
                                if (!r.ok) return setErro(r.erro);
                                setAcao(null);
                                setFeito(
                                  r.comReposicao
                                    ? `Aula cancelada. Você ganhou uma reposição${r.validoAte ? `, válida até ${dataCurta(r.validoAte)}` : ""}.`
                                    : "Aula cancelada. Como foi em cima da hora, ela conta como dada.",
                                );
                                router.refresh();
                              } catch {
                                setErro("Não foi possível cancelar agora. Confira sua internet.");
                              }
                            })
                          }
                          className="flex-1 rounded-[12px] bg-bad px-3 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
                        >
                          {ocupado ? "Cancelando…" : "Cancelar aula"}
                        </button>
                      </div>
                    </div>
                  )}

                  {aberta === "remarcar" &&
                    (comAntecedencia(a.inicio) ? (
                      <EscolherHorario
                        vinculoId={vinculoId}
                        de={hoje}
                        ate={somarDias(hoje, 14)}
                        ocupado={ocupado}
                        antecedenciaH={regras.reposicaoH}
                        textoBotao={(i) => `Remarcar para ${textoCurto(i)}`}
                        onCancelar={() => setAcao(null)}
                        onEscolher={(inicio) =>
                          executar(
                            () => alunoRemarcarAula(a.id, inicio),
                            `Pedido de remarcação enviado para ${textoCurto(inicio)}. Até ${primeiro} aceitar, a aula continua no horário de antes.`,
                          )
                        }
                      />
                    ) : (
                      <p className="rounded-[14px] border border-line p-3 text-[14px] text-ink-2">
                        Faltam menos de {textoDeHoras(regras.cancelamentoH)}: para remarcar agora, fale com {primeiro}.
                      </p>
                    ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Aviso>{erro}</Aviso>
    </div>
  );
}

/** "sex 24/10 às 18:00" */
function textoCurto(inicio: string): string {
  const { data, hora } = emBrasilia(inicio);
  return `${curtoDoDia(diaDaSemana(data))} ${dataCurta(data)} às ${hora}`;
}

/** Dias com horários livres do personal e, ao tocar num dia, os horários. */
function EscolherHorario({
  vinculoId,
  de,
  ate,
  ocupado,
  antecedenciaH,
  textoBotao,
  onEscolher,
  onCancelar,
}: {
  vinculoId: string;
  de: string;
  ate: string;
  ocupado: boolean;
  antecedenciaH: number;
  textoBotao: (inicio: string) => string;
  onEscolher: (inicio: string) => void;
  onCancelar: () => void;
}) {
  const [livres, setLivres] = useState<string[] | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    livresParaAluno(vinculoId, de, ate).then((l) => {
      if (!atual) return;
      setLivres(l);
      setDia(l[0] ? emBrasilia(l[0]).data : null);
    });
    return () => {
      atual = false;
    };
  }, [vinculoId, de, ate]);

  const dias = [...new Set((livres ?? []).map((l) => emBrasilia(l).data))];
  const doDia = (livres ?? []).filter((l) => emBrasilia(l).data === dia);

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-3 text-ink">
      <div className="flex items-center gap-2">
        <Icone nome="calendario" className="size-4 text-brand" />
        <p className="flex-1 text-[14px] font-bold">Escolha o novo horário</p>
        <button type="button" onClick={onCancelar} aria-label="Fechar" className="text-ink-3">
          <Icone nome="fechar" className="size-4" />
        </button>
      </div>
      {livres === null ? (
        <p className="text-[13px] text-ink-3">Carregando os horários livres…</p>
      ) : livres.length === 0 ? (
        <p className="text-[13px] text-ink-3">Não há horários livres nesse período. Fale com seu personal.</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dias.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={dia === d}
                onClick={() => {
                  setDia(d);
                  setEscolhido(null);
                }}
                className={`flex shrink-0 flex-col items-center rounded-[12px] border px-2.5 py-1.5 text-[13px] ${
                  dia === d ? "border-ink bg-ink text-app" : "border-line"
                }`}
              >
                <span>{curtoDoDia(diaDaSemana(d))}</span>
                <span className="font-bold tabular-nums">{dataCurta(d)}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {doDia.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={escolhido === l}
                onClick={() => setEscolhido(l)}
                className={`rounded-lg px-2.5 py-1.5 text-[15px] font-bold tabular-nums ${
                  escolhido === l ? "bg-ink text-app" : "bg-brand-soft text-brand"
                }`}
              >
                {emBrasilia(l).hora}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-ink-3">
            Só aparecem horários livres com pelo menos {textoDeHoras(antecedenciaH)} de antecedência.
          </p>
          <button
            type="button"
            disabled={!escolhido || ocupado}
            onClick={() => escolhido && onEscolher(escolhido)}
            className={ESTILO_BOTAO_PRINCIPAL}
          >
            {ocupado ? "Salvando…" : escolhido ? textoBotao(escolhido) : "Escolha um horário"}
          </button>
        </>
      )}
    </div>
  );
}
