"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelarAusencia,
  marcarAusencia,
  pedirReposicao,
  resumoDaAusencia,
  type Ausencia,
  type ResumoAusencia,
  type TipoAusencia,
} from "@/data/reposicao";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia, dataCurta, emBrasilia } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";

interface Pessoa {
  personalId: string;
  nome: string;
}

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const quando = (iso: string) => {
  const { data, hora } = emBrasilia(iso);
  return `${DIA_CURTO[new Date(`${data}T12:00:00Z`).getUTCDay()]} ${dataCurta(data)} ${hora}`;
};
const periodo = (a: { tipo: TipoAusencia; de: string; ate: string }) =>
  `${a.tipo === "falta" ? "Falta" : "Férias"} ${a.de === a.ate ? `em ${dataCurta(a.de)}` : `de ${dataCurta(a.de)} a ${dataCurta(a.ate)}`}`;

/**
 * Férias e faltas: a coordenação marca as de qualquer professor (equipe) e o professor, as
 * próprias (fixo). Ao marcar, a coordenação é avisada na hora (decisão 79) e aparecem as aulas
 * que ficaram sem professor, com dois botões (avisar os demais professores ou um professor
 * específico) e o × para fechar. Dá para pedir a reposição depois, pela lista.
 */
export function AusenciasDoEstudio({
  estudioId,
  estudioNome,
  equipe,
  fixo,
  ausencias,
}: {
  estudioId: string;
  estudioNome: string;
  equipe: Pessoa[];
  /** O professor marcando as próprias férias/faltas (sem escolher quem). */
  fixo?: Pessoa;
  ausencias: Ausencia[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState<ResumoAusencia | null>(null);
  const [ocupado, iniciar] = useTransition();
  const nomeDe = (id: string) => equipe.find((p) => p.personalId === id)?.nome ?? fixo?.nome ?? "Professor";
  const lista = fixo ? ausencias.filter((a) => a.personalId === fixo.personalId) : ausencias;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Férias e faltas">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Férias e faltas</h2>
          <p className="text-[13px] text-ink-3">
            {fixo ? "Vai faltar ou tirar férias? Marque aqui e peça reposição." : "Marque as férias ou a falta de um professor e peça reposição à equipe."}
          </p>
        </div>
        <button type="button" onClick={() => setAberto(true)} className={ESTILO_BOTAO_SECUNDARIO + " min-h-12! sm:w-auto!"}>
          Marcar férias ou falta
        </button>
      </div>
      {lista.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2 text-[14px]">
              <span className="min-w-0 flex-1">
                {!fixo && <b>{nomeDe(a.personalId).split(" ")[0]} · </b>}
                {periodo(a)}
                {a.avisadoEm && <span className="text-ink-3"> · equipe avisada</span>}
              </span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    setErro(null);
                    const r = await resumoDaAusencia(a.id);
                    if (!r.ok) return setErro(r.erro);
                    setPedindo(r.resumo);
                  })
                }
                className="shrink-0 text-[14px] font-semibold text-brand"
              >
                Pedir reposição
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    if (!confirm("Desmarcar? As aulas que ninguém assumiu voltam para o professor.")) return;
                    const r = await cancelarAusencia(a.id);
                    if (!r.ok) return setErro(r.erro);
                    router.refresh();
                  })
                }
                className="shrink-0 text-[14px] font-semibold text-bad"
              >
                Desmarcar
              </button>
            </li>
          ))}
        </ul>
      )}
      <Aviso>{erro}</Aviso>
      {pedindo && (
        <Janela
          fechar={() => {
            setPedindo(null);
            router.refresh();
          }}
        >
          <Resultado
            resumo={pedindo}
            estudioNome={estudioNome}
            equipe={equipe}
            fechar={() => {
              setPedindo(null);
              router.refresh();
            }}
          />
        </Janela>
      )}
      {aberto && (
        <Janela
          fechar={() => {
            setAberto(false);
            router.refresh();
          }}
        >
          <MarcarAusencia
            estudioId={estudioId}
            estudioNome={estudioNome}
            equipe={equipe}
            fixo={fixo}
            fechar={() => {
              setAberto(false);
              router.refresh();
            }}
          />
        </Janela>
      )}
    </section>
  );
}

function Janela({ fechar, children }: { fechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={fechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-[24px] bg-app p-5 sm:rounded-[24px]"
      >
        {children}
      </div>
    </div>
  );
}

function MarcarAusencia({
  estudioId,
  estudioNome,
  equipe,
  fixo,
  fechar,
}: {
  estudioId: string;
  estudioNome: string;
  equipe: Pessoa[];
  fixo?: Pessoa;
  fechar: () => void;
}) {
  const hoje = agoraEmBrasilia().data;
  const [quem, setQuem] = useState(fixo?.personalId ?? "");
  const [tipo, setTipo] = useState<TipoAusencia>("falta");
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoAusencia | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (resumo) return <Resultado resumo={resumo} estudioNome={estudioNome} equipe={equipe} fechar={fechar} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!quem) return setErro("Escolha o professor.");
        iniciar(async () => {
          const r = await marcarAusencia(estudioId, quem, tipo, de, tipo === "falta" ? de : ate);
          if (!r.ok) return setErro(r.erro);
          setResumo(r.resumo);
        });
      }}
      className="flex flex-col gap-3.5"
    >
      <h2 className="text-[20px] font-extrabold">Férias ou falta</h2>
      {!fixo && (
        <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
          Professor
          <select value={quem} onChange={(e) => setQuem(e.target.value)} className={ESTILO_CAIXA}>
            <option value="">Escolha…</option>
            {equipe.map((p) => (
              <option key={p.personalId} value={p.personalId}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <Chip ativo={tipo === "falta"} onClick={() => setTipo("falta")}>
          Falta
        </Chip>
        <Chip ativo={tipo === "ferias"} onClick={() => setTipo("ferias")}>
          Férias
        </Chip>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
          {tipo === "falta" ? "Dia" : "De"}
          <input
            type="date"
            min={hoje}
            value={de}
            onChange={(e) => {
              setDe(e.target.value);
              if (ate < e.target.value) setAte(e.target.value);
            }}
            className={ESTILO_CAIXA}
          />
        </label>
        {tipo === "ferias" && (
          <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
            Até
            <input type="date" min={de} value={ate} onChange={(e) => setAte(e.target.value)} className={ESTILO_CAIXA} />
          </label>
        )}
      </div>
      <p className="text-[13px] text-ink-3">
        As aulas do período ficam sem professor até alguém da equipe confirmar.{fixo ? " A coordenação é avisada na hora." : ""}
      </p>
      <Aviso>{erro}</Aviso>
      <div className="flex gap-2.5">
        <button type="button" onClick={fechar} className={ESTILO_BOTAO_SECUNDARIO + " flex-1"}>
          Cancelar
        </button>
        <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL + " flex-1"}>
          {ocupado ? "Marcando…" : "Marcar"}
        </button>
      </div>
    </form>
  );
}

function Resultado({ resumo, estudioNome, equipe, fechar }: { resumo: ResumoAusencia; estudioNome: string; equipe: Pessoa[]; fechar: () => void }) {
  const [modo, setModo] = useState<"escolher" | "um" | "feito">("escolher");
  const [escolhido, setEscolhido] = useState("");
  const [avisados, setAvisados] = useState<{ nome: string; whatsapp: string }[]>([]);
  const [link, setLink] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const aulas = resumo.aulas.filter((a) => !a.assumida);
  const total = aulas.reduce((s, a) => s + a.valor, 0);
  const outros = equipe.filter((p) => p.personalId !== resumo.personalId);
  const primeiro = resumo.nome.split(" ")[0];

  const mensagem = (para?: string) =>
    [
      `${para ? `Olá, ${para.split(" ")[0]}! ` : ""}Reposição no ${estudioNome}: ${primeiro} ${resumo.tipo === "falta" ? "vai faltar" : "estará de férias"}.`,
      `${aulas.length} ${aulas.length === 1 ? "aula" : "aulas"}:`,
      ...aulas.map((a) => `• ${quando(a.inicio)} · ${a.modalidade} · ${centavosParaReais(a.valor)}`),
      `Total: ${centavosParaReais(total)}.`,
      `Para confirmar os horários, abra o P-Bell: ${link}`,
    ].join("\n");

  const pedir = (professor: string | null) =>
    iniciar(async () => {
      const r = await pedirReposicao(resumo.id, professor);
      if (!r.ok) return setErro(r.erro);
      setAvisados(r.avisados);
      setLink(r.link);
      setModo("feito");
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-3">{resumo.nome}</p>
          <h2 className="text-[20px] font-extrabold">{periodo(resumo)}</h2>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-[20px] leading-none">
          ×
        </button>
      </div>
      {aulas.length === 0 ? (
        <p className="text-ink-2">Nenhuma aula neste período. Nada para repor.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 rounded-[16px] border border-line bg-surface p-3 text-[14px]">
            {aulas.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {quando(a.inicio)} · {a.modalidade}
                </span>
                <span className="font-semibold">{centavosParaReais(a.valor)}</span>
              </li>
            ))}
            <li className="flex gap-2 border-t border-line pt-1.5 font-bold">
              <span className="flex-1">
                {aulas.length} {aulas.length === 1 ? "aula" : "aulas"} para repor
              </span>
              <span>{centavosParaReais(total)}</span>
            </li>
          </ul>

          {modo === "escolher" && (
            <div className="flex flex-col gap-2">
              <button type="button" disabled={ocupado} onClick={() => pedir(null)} className={ESTILO_BOTAO_PRINCIPAL}>
                Avisar os demais professores
              </button>
              <button type="button" disabled={ocupado} onClick={() => setModo("um")} className={ESTILO_BOTAO_SECUNDARIO}>
                Avisar um professor específico
              </button>
            </div>
          )}

          {modo === "um" && (
            <div className="flex flex-col gap-2">
              <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className={ESTILO_CAIXA} aria-label="Professor">
                <option value="">Escolha o professor…</option>
                {outros.map((p) => (
                  <option key={p.personalId} value={p.personalId}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <button type="button" disabled={ocupado || !escolhido} onClick={() => pedir(escolhido)} className={ESTILO_BOTAO_PRINCIPAL}>
                Avisar
              </button>
            </div>
          )}

          {modo === "feito" && (
            <div className="flex flex-col gap-2 rounded-[16px] bg-ok-soft p-3.5 text-[14px]">
              <p className="font-bold text-ok">
                {avisados.length > 0 ? `Aviso enviado pelo app para ${avisados.map((p) => p.nome.split(" ")[0]).join(", ")}.` : "Ninguém para avisar na equipe."}
              </p>
              <p className="text-ink-2">Quem tem as notificações ligadas recebe na hora. Mande também pelo WhatsApp:</p>
              {escolhido && avisados[0] ? (
                <a href={linkWhatsapp(avisados[0].whatsapp, mensagem(avisados[0].nome))} target="_blank" rel="noreferrer" className={ESTILO_BOTAO_PRINCIPAL}>
                  WhatsApp para {avisados[0].nome.split(" ")[0]}
                </a>
              ) : (
                <a href={`https://wa.me/?text=${encodeURIComponent(mensagem())}`} target="_blank" rel="noreferrer" className={ESTILO_BOTAO_PRINCIPAL}>
                  Enviar no WhatsApp (grupo da equipe)
                </a>
              )}
            </div>
          )}
        </>
      )}
      <Aviso>{erro}</Aviso>
    </div>
  );
}
