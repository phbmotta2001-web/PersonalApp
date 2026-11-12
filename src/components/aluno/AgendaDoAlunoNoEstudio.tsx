"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  avisarFaltaNoEstudio,
  desfazerFaltaNoEstudio,
  marcarReposicaoNoEstudio,
  type AulaNaAgendaDoAluno,
  type EstudioDoAluno,
  type ReposicaoDoAluno,
} from "@/data/aluno-estudio";
import { DIAS, dataCurta, diaDaSemana, emBrasilia, somarDias } from "@/lib/expediente";
import { Aviso } from "../Formulario";

const mesma = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Agenda do estúdio para o aluno: as turmas da semana com a ocupação (ex.: 4/5), sem nomes.
 * Na turma dele: "Vou faltar" (com antecedência, ganha reposição). Em turma com vaga da mesma
 * modalidade: toque para repor. O professor é avisado; ninguém precisa responder.
 */
export function AgendaDoAlunoNoEstudio({
  estudio,
  aulas,
  reposicoes,
  inicio,
  hoje,
  agora,
}: {
  estudio: EstudioDoAluno;
  aulas: AulaNaAgendaDoAluno[];
  reposicoes: ReposicaoDoAluno[];
  /** Primeiro dia mostrado ("AAAA-MM-DD"). */
  inicio: string;
  hoje: string;
  /** Agora, em milissegundos (vem do servidor). */
  agora: number;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string; aula: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  // Aula tocada: mostra "Entrar na turma" embaixo dela.
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const definido = Object.keys(estudio.funcionamento).length > 0;
  const creditoPara = (modalidade: string) => reposicoes.find((r) => mesma(r.modalidade, modalidade));

  const agir = (aula: string, fazer: () => Promise<{ ok: true; texto: string } | { ok: false; erro: string }>) =>
    iniciar(async () => {
      const r = await fazer();
      setAviso(r.ok ? { tipo: "ok", texto: r.texto, aula } : { tipo: "erro", texto: r.erro, aula });
      if (r.ok) router.refresh();
    });

  const faltar = (a: AulaNaAgendaDoAluno) => {
    const noPrazo = Date.parse(a.inicio) - agora >= estudio.faltaH * 3_600_000;
    const pergunta =
      a.minha === "reposicao"
        ? noPrazo
          ? "Desmarcar a reposição? Ela volta para você usar em outra aula."
          : `Faltam menos de ${estudio.faltaH} h: se desmarcar agora, você perde esta reposição. Desmarcar mesmo assim?`
        : noPrazo
          ? `Avisar que vai faltar? Você ganha uma reposição de ${a.modalidade} (vale ${estudio.validadeDias} dias).`
          : `Faltam menos de ${estudio.faltaH} h: a falta é avisada ao professor, mas não gera reposição. Avisar mesmo assim?`;
    if (!confirm(pergunta)) return;
    agir(a.id, async () => {
      const r = await avisarFaltaNoEstudio(a.id);
      if (!r.ok) return r;
      return {
        ok: true,
        texto: !r.fixo
          ? r.credito
            ? "Reposição desmarcada. Ela está livre de novo."
            : "Falta avisada."
          : r.credito
            ? `Falta avisada. Você ganhou uma reposição de ${a.modalidade}.`
            : "Falta avisada ao professor.",
      };
    });
  };

  const repor = (a: AulaNaAgendaDoAluno) => {
    const credito = creditoPara(a.modalidade);
    if (!credito)
      return setAviso({
        tipo: "erro",
        aula: a.id,
        texto: `Você não tem reposição de ${a.modalidade}. Avise a falta numa aula sua com ${estudio.faltaH} h de antecedência para ganhar uma.`,
      });
    if (Date.parse(a.inicio) - agora < estudio.marcarH * 3_600_000)
      return setAviso({ tipo: "erro", aula: a.id, texto: `Marque com pelo menos ${estudio.marcarH} h de antecedência.` });
    setEscolhida(null);
    agir(a.id, async () => {
      const r = await marcarReposicaoNoEstudio(a.id);
      return r.ok ? { ok: true, texto: "Reposição marcada. O professor já foi avisado." } : r;
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-7 lg:gap-2">
      {dias.map((d) => {
        const doDia = aulas.filter((a) => emBrasilia(a.inicio).data === d);
        const fechado = definido && !estudio.funcionamento[diaDaSemana(d)];
        const nome = DIAS[diaDaSemana(d)];
        return (
          <section key={d} className="flex flex-col gap-1.5" aria-label={`${nome.nome}, ${dataCurta(d)}`}>
            <h2 className={`text-[14px] font-extrabold tracking-[0.04em] uppercase ${d === hoje ? "text-brand" : "text-ink-3"}`}>
              <span className="lg:hidden">{nome.nome}</span>
              <span className="hidden lg:inline">{nome.curto}</span> · {dataCurta(d)}
              {d === hoje && " · hoje"}
            </h2>
            {doDia.length === 0 ? (
              <p className="text-[14px] text-ink-3">{fechado ? "Fechado" : "Sem turmas"}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {doDia.map((a) => {
                  const passou = Date.parse(a.inicio) <= agora;
                  const lotada = a.ocupadas >= a.vagas;
                  const minha = a.minha !== null;
                  const podeRepor = !minha && !passou && !lotada && !a.cancelada;
                  const tom = a.cancelada || passou
                    ? "border-line bg-surface-2 text-ink-3"
                    : minha && !a.aviseiFalta
                      ? "border-estudio bg-estudio-soft text-estudio"
                      : podeRepor
                        ? "border-line bg-surface hover:border-brand"
                        : "border-line bg-surface text-ink-3";
                  const conteudo = (
                    <>
                      <span className="flex items-center gap-2">
                        <span className="flex-1 text-[15px] font-extrabold tabular-nums">{emBrasilia(a.inicio).hora}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-bold ${
                            lotada ? "bg-gold-soft text-gold" : "bg-surface-2 text-ink-2"
                          }`}
                        >
                          {a.ocupadas}/{a.vagas}
                        </span>
                      </span>
                      <span className="block truncate text-[15px] font-bold">{a.modalidade}</span>
                      <span className="block truncate text-[13px] opacity-85">
                        {a.cancelada
                          ? "Cancelada"
                          : a.minha === "fixa"
                            ? a.aviseiFalta
                              ? "Sua turma · falta avisada"
                              : "Sua turma"
                            : a.minha === "reposicao"
                              ? a.aviseiFalta
                                ? "Reposição · falta avisada"
                                : "Sua reposição"
                              : lotada
                                ? "Lotada"
                                : passou
                                  ? (a.professor ?? "")
                                  : `Vaga${a.professor ? ` · com ${a.professor}` : ""}`}
                      </span>
                    </>
                  );
                  return (
                    <li key={a.id} className="flex flex-col gap-1">
                      {podeRepor ? (
                        <button
                          type="button"
                          disabled={ocupado}
                          aria-expanded={escolhida === a.id}
                          onClick={() => setEscolhida(escolhida === a.id ? null : a.id)}
                          className={`flex flex-col rounded-[14px] border px-3 py-2 text-left ${tom} ${escolhida === a.id ? "border-brand" : ""}`}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        <div className={`flex flex-col rounded-[14px] border border-l-[3px] px-3 py-2 ${tom}`}>{conteudo}</div>
                      )}
                      {podeRepor && escolhida === a.id && (
                        <div className="flex flex-col gap-1 px-1">
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => repor(a)}
                            className="min-h-[44px] rounded-[12px] bg-brand px-3 text-[14.5px] font-bold text-brand-ink"
                          >
                            {ocupado ? "Entrando…" : "Entrar na turma"}
                          </button>
                          <span className="text-[12.5px] text-ink-3">Usa uma reposição de {a.modalidade}.</span>
                        </div>
                      )}
                      {minha && !passou && !a.cancelada && (
                        <div className="flex gap-3 px-1 text-[13.5px] font-semibold">
                          {!a.aviseiFalta ? (
                            <button type="button" disabled={ocupado} onClick={() => faltar(a)} className="text-bad">
                              {a.minha === "reposicao" ? "Desmarcar reposição" : "Vou faltar"}
                            </button>
                          ) : (
                            a.minha === "fixa" && (
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() =>
                                  agir(a.id, async () => {
                                    const r = await desfazerFaltaNoEstudio(a.id);
                                    return r.ok ? { ok: true, texto: "Pronto: você continua na aula." } : r;
                                  })
                                }
                                className="text-brand"
                              >
                                Desfazer: vou à aula
                              </button>
                            )
                          )}
                        </div>
                      )}
                      {aviso?.aula === a.id && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
