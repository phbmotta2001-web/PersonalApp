"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agendarAulaExperimental, aulasDoEstudio, type AulaNaAgendaDoEstudio } from "@/data/estudio";
import { linkWhatsapp } from "@/lib/convite";
import { curtoDoDia, dataCurta, diaDaSemana, emBrasilia, instante, somarDias } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/**
 * Decisão 92: o professor (ou a coordenação) agenda uma aula experimental numa aula de turma,
 * numa data só. O aluno entra como "experimental" e recebe o link de cadastro.
 * Decisão 99: o professor só vê as aulas dele; ParQ e anamnese vão junto (pode desligar).
 */
export function AgendarExperimental({
  estudioId,
  estudioNome,
  equipe,
  hoje,
  soDoProfessor = null,
}: {
  estudioId: string;
  estudioNome: string;
  equipe: { personalId: string; nome: string }[];
  hoje: string;
  /** Professor (não coordenação): só as aulas dele. */
  soDoProfessor?: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [aulas, setAulas] = useState<AulaNaAgendaDoEstudio[] | null>(null);
  const [aulaId, setAulaId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [formularios, setFormularios] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ nome: string; whatsapp: string; quando: string; link: string; formularios: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const [carregando, carregar] = useTransition();

  const professor = (id: string | null) => equipe.find((m) => m.personalId === id)?.nome.split(" ")[0];
  const quando = (a: AulaNaAgendaDoEstudio) => {
    const b = emBrasilia(a.inicio);
    return `${curtoDoDia(diaDaSemana(b.data))}, ${dataCurta(b.data)} às ${b.hora}`;
  };

  const escolherDia = (d: string) => {
    setData(d);
    setAulaId(null);
    setAulas(null);
    setErro(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    carregar(async () => {
      const lista = await aulasDoEstudio(estudioId, instante(d, 0).toISOString(), instante(somarDias(d, 1), 0).toISOString());
      const agora = Date.now();
      setAulas(lista.filter((a) => !a.cancelada && a.tipo === "turma" && new Date(a.inicio).getTime() > agora && a.alunos < a.vagas && (!soDoProfessor || a.professorId === soDoProfessor)));
    });
  };

  const agendar = () => {
    const aula = aulas?.find((a) => a.id === aulaId);
    if (!aula) return setErro("Escolha a aula.");
    if (nome.trim().length < 2) return setErro("Escreva o nome do aluno.");
    setErro(null);
    iniciar(async () => {
      const r = await agendarAulaExperimental(aula.id, nome, zap, formularios);
      if (!r.ok) return setErro(r.erro);
      setFeito({ nome: nome.trim(), whatsapp: zap.replace(/\D/g, ""), quando: `${quando(aula)} (${aula.modalidade})`, link: r.link, formularios });
      setData("");
      setAulas(null);
      setAulaId(null);
      setNome("");
      setZap("");
      router.refresh();
    });
  };

  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="rounded-[16px] border border-info bg-info-soft px-4 py-3 text-left font-bold text-info">
        + Agendar aula experimental
      </button>
    );

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-info bg-surface p-4" aria-label="Agendar aula experimental">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-bold">Aula experimental</h2>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setFeito(null);
            setErro(null);
          }}
          className="text-[14px] font-bold text-ink-3"
        >
          Fechar
        </button>
      </div>

      {feito ? (
        <div className="flex flex-col gap-2 text-[14.5px]">
          <p>
            <b>{feito.nome}</b> está agendado para {feito.quando}.
          </p>
          <p className="text-ink-3">
            Envie o link para o aluno fazer o cadastro no app (vale 14 dias)
            {feito.formularios ? ". Ao entrar, ele responde o ParQ e a anamnese:" : ":"}
          </p>
          <div className="flex flex-wrap gap-3 font-bold">
            <a
              href={linkWhatsapp(
                feito.whatsapp || null,
                `Olá, ${feito.nome.split(" ")[0]}! Sua aula experimental no ${estudioNome} está marcada para ${feito.quando}. Faça seu cadastro no P-Bell por este link: ${feito.link}${feito.formularios ? " Antes da aula, responda no app o ParQ e a anamnese (leva poucos minutos)." : ""}`,
              )}
              target="_blank"
              rel="noreferrer"
              className="text-brand"
            >
              Enviar no WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(feito.link);
                  setCopiado(true);
                } catch {
                  setCopiado(false);
                }
              }}
              className="text-brand"
            >
              {copiado ? "Copiado" : "Copiar link"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setFeito(null);
              setCopiado(false);
            }}
            className="self-start text-[14px] font-bold text-info"
          >
            Agendar outra
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
            Dia
            <input type="date" value={data} min={hoje} onChange={(e) => escolherDia(e.target.value)} className={ESTILO_CAIXA} />
          </label>
          {carregando && <p className="text-[14px] text-ink-3">Buscando as aulas…</p>}
          {aulas && aulas.length === 0 && (
            <p className="text-[14px] text-ink-3">{soDoProfessor ? "Nenhuma aula sua com vaga neste dia." : "Nenhuma aula com vaga neste dia."}</p>
          )}
          {aulas && aulas.length > 0 && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="pb-1 text-[14px] font-bold text-ink-2">Aula</legend>
              {aulas.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-[15px] ${aulaId === a.id ? "border-info bg-info-soft" : "border-line"}`}
                >
                  <input type="radio" name="aula-experimental" checked={aulaId === a.id} onChange={() => setAulaId(a.id)} />
                  <span className="flex-1">
                    <b>{emBrasilia(a.inicio).hora}</b> · {a.modalidade}
                    {professor(a.professorId) && <span className="text-ink-3"> · {professor(a.professorId)}</span>}
                  </span>
                  <span className="text-[13px] text-ink-3">
                    {a.alunos}/{a.vagas}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {aulaId && (
            <>
              <input type="text" aria-label="Nome do aluno" placeholder="Nome do aluno" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className={ESTILO_CAIXA} />
              <input
                type="tel"
                inputMode="tel"
                aria-label="WhatsApp do aluno (opcional)"
                placeholder="WhatsApp com DDD (opcional)"
                value={zap}
                onChange={(e) => setZap(e.target.value)}
                className={ESTILO_CAIXA}
              />
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" checked={formularios} onChange={(e) => setFormularios(e.target.checked)} className="size-5 shrink-0 accent-[var(--info)]" />
                Enviar ParQ e anamnese
              </label>
              <button type="button" onClick={agendar} disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
                {ocupado ? "Agendando…" : "Agendar"}
              </button>
            </>
          )}
          <Aviso>{erro}</Aviso>
        </>
      )}
    </section>
  );
}
