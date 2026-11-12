"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  convidarProfessor,
  encerrarAlunoEstudio,
  importarAlunos,
  removerDaEquipe,
  salvarTurmasDoAluno,
  type AlunoDoEstudio,
  type EstudioCompleto,
  type TurmaDoEstudio,
} from "@/data/estudio";
import { marcarMensalidade, type FaltasDoProfessor, type FinanceiroDoMes, type MesDoEstudio, type PagamentoDoAluno } from "@/data/estudio-financeiro";
import { textoDoVencimento } from "@/lib/cobranca";
import { centavosParaReais } from "@/lib/matricula";
import { pixCopiaECola, type TipoChavePix } from "@/lib/pix";
import { linkWhatsapp } from "@/lib/convite";
import { DIAS, minParaHora } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { ConviteDoAlunoEstudio } from "./ConviteDoAlunoEstudio";
import { EditarHorarios } from "./EditarHorarios";
import { AjustesDoEstudio, FinanceiroDoEstudio, MensalidadeDoAluno, ValorDoProfessor } from "./FinanceiroDoEstudio";

export type Aba = "agenda" | "turmas" | "equipe" | "alunos" | "financeiro" | "ajustes";

export const rotuloDaTurma = (t: Pick<TurmaDoEstudio, "modalidade" | "diaSemana" | "inicioMin">) =>
  `${t.modalidade} · ${DIAS.find((x) => x.valor === t.diaSemana)?.curto ?? ""} ${minParaHora(t.inicioMin)}`;

/** Coordenação do estúdio: turmas, professores e alunos (decisão 54, etapa 1). */
export function GestaoDoEstudio({
  estudio,
  aba,
  financeiro,
  agenda,
  complemento,
  pagamentos,
  hoje,
}: {
  estudio: EstudioCompleto;
  aba: Aba;
  /** Só na aba Agenda: a grade da semana, montada no servidor. */
  agenda?: React.ReactNode;
  /** Partes montadas no servidor que vão junto da aba (férias e faltas, reposição). */
  complemento?: React.ReactNode;
  /** Só na aba Financeiro: o mês ("AAAA-MM"), hoje e os dados. */
  financeiro?: { mes: string; hoje: string; dados: FinanceiroDoMes; historico: MesDoEstudio[]; faltas: FaltasDoProfessor[] };
  /** Só na aba Alunos (estúdio que cobra mensalidade): a situação de pagamento de cada aluno. */
  pagamentos?: Record<string, PagamentoDoAluno>;
  hoje: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      {aba === "agenda" && complemento}
      {aba === "agenda" && agenda}
      {/* Decisão 68: sem lista de turmas; a agenda mostra tudo e "Editar" adiciona, remove e dá professor. */}
      {aba === "agenda" && <EditarHorarios estudio={estudio} hoje={hoje} atualizar={() => router.refresh()} />}
      {aba === "equipe" && <Equipe estudio={estudio} atualizar={() => router.refresh()} />}
      {aba === "alunos" && <Alunos estudio={estudio} pagamentos={pagamentos} hoje={hoje} atualizar={() => router.refresh()} />}
      {aba === "financeiro" && financeiro && <FinanceiroDoEstudio estudio={estudio} {...financeiro} />}
      {aba === "ajustes" && <AjustesDoEstudio estudio={estudio} />}
      {aba !== "agenda" && complemento}
    </div>
  );
}

// ─── Equipe ─────────────────────────────────────────────────────────────────

function Equipe({ estudio, atualizar }: { estudio: EstudioCompleto; atualizar: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const mensagem = (l: string) => `Oi! Entre na equipe do ${estudio.nome} no P-Bell para ver suas turmas e fazer a chamada: ${l}`;

  return (
    <section className="flex flex-col gap-3" aria-label="Professores">
      <h2 className="text-[18px] font-bold">Professores ({estudio.equipe.length})</h2>
      <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
        {estudio.equipe.map((m) => (
          <li key={m.personalId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">{m.nome}</span>
              <ValorDoProfessor estudio={estudio} membro={m} />
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12.5px] font-bold text-ink-2">
              {m.papel === "coordenacao" ? "coordenação" : "professor"}
            </span>
            {m.papel === "professor" && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    const r = await removerDaEquipe(estudio.id, m.personalId);
                    if (!r.ok) return setErro(r.erro);
                    atualizar();
                  })
                }
                className="text-[14px] font-semibold text-ink-3"
              >
                Remover
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
        <h3 className="font-bold">Convidar professor</h3>
        <p className="text-[14px] text-ink-3">O professor entra com a conta de personal dele no P-Bell (ou cria uma). Cada link serve para uma pessoa e vale 14 dias.</p>
        {link ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={linkWhatsapp("", mensagem(link))} target="_blank" rel="noopener noreferrer" className={ESTILO_BOTAO_PRINCIPAL}>
              Enviar pelo WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopiado(true);
                } catch {
                  window.prompt("Copie o link:", link);
                }
              }}
              className={ESTILO_BOTAO_SECUNDARIO}
            >
              {copiado ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                const r = await convidarProfessor(estudio.id);
                if (!r.ok) return setErro(r.erro);
                setLink(r.link);
                setCopiado(false);
              })
            }
            className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
          >
            {ocupado ? "Criando…" : "Criar link de convite"}
          </button>
        )}
        <Aviso>{erro}</Aviso>
      </div>
    </section>
  );
}

// ─── Alunos ─────────────────────────────────────────────────────────────────

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const SITUACAO_PAGAMENTO: Record<PagamentoDoAluno["situacao"], { rotulo: string; borda: string; selo: string }> = {
  devendo: { rotulo: "Devendo", borda: "border-l-bad", selo: "bg-bad text-white" },
  vencendo: { rotulo: "Vence em até 7 dias", borda: "border-l-star", selo: "bg-gold-soft text-gold" },
  pago: { rotulo: "Pago", borda: "border-l-ok", selo: "bg-ok-soft text-ok" },
  em_dia: { rotulo: "Em dia", borda: "border-l-line", selo: "bg-surface-2 text-ink-2" },
};

/** Mensagem pronta para a coordenação cobrar o aluno pelo WhatsApp (com o Pix do estúdio). */
function mensagemDeCobrancaDoEstudio(estudio: EstudioCompleto, aluno: AlunoDoEstudio, p: PagamentoDoAluno, hoje: string): string {
  const total = p.situacao === "devendo" ? p.devido : p.valor;
  const linhas = [
    `Oi, ${aluno.nome.split(" ")[0]}! ${p.situacao === "devendo" ? "Passando para lembrar" : "Lembrete"} do ${estudio.nome}: a mensalidade de ${centavosParaReais(p.valor)} ${p.vencimento ? textoDoVencimento(p.vencimento, hoje) : "está em aberto"}.`,
  ];
  if (p.situacao === "devendo" && p.devido > p.valor) linhas.push(`Com as anteriores, o total em aberto é ${centavosParaReais(p.devido)}.`);
  const pix = estudio.config.pix;
  if (pix?.chave) {
    try {
      linhas.push("", "Pix copia e cola:", pixCopiaECola({ ...pix, tipo: pix.tipo as TipoChavePix }, total, "MENSALIDADE"));
    } catch {
      linhas.push("", `Pix: ${pix.chave}`);
    }
  }
  linhas.push("", "Obrigado!");
  return linhas.join("\n");
}

function Alunos({
  estudio,
  pagamentos,
  hoje,
  atualizar,
}: {
  estudio: EstudioCompleto;
  pagamentos?: Record<string, PagamentoDoAluno>;
  hoje: string;
  atualizar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<PagamentoDoAluno["situacao"] | null>(null);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const turmaPorId = new Map(estudio.turmas.map((t) => [t.id, t]));
  const situacao = (id: string) => pagamentos?.[id]?.situacao ?? "em_dia";
  const contar = (s: PagamentoDoAluno["situacao"]) => estudio.alunos.filter((a) => situacao(a.id) === s).length;
  // Quem deve vem primeiro, depois quem vence logo; os demais em ordem alfabética.
  const ORDEM = { devendo: 0, vencendo: 1, em_dia: 2, pago: 3 } as const;
  const lista = estudio.alunos
    .filter((a) => !filtro || situacao(a.id) === filtro)
    .sort((x, y) => (pagamentos ? ORDEM[situacao(x.id)] - ORDEM[situacao(y.id)] : 0));

  const recebido = (cobrancaId: string) =>
    iniciar(async () => {
      setErroPagamento(null);
      const r = await marcarMensalidade(cobrancaId, "paga");
      if (!r.ok) return setErroPagamento(r.erro);
      atualizar();
    });

  return (
    <section className="flex flex-col gap-4" aria-label="Alunos">
      {pagamentos && (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pagamentos">
          {(
            [
              ["pago", "Pagos", "text-ok", "border-ok"],
              ["vencendo", "Vencem em 7 dias", "text-gold", "border-star"],
              ["devendo", "Devendo", "text-bad", "border-bad"],
            ] as const
          ).map(([s, rotulo, cor, borda]) => (
            <button
              key={s}
              type="button"
              aria-pressed={filtro === s}
              onClick={() => setFiltro(filtro === s ? null : s)}
              className={`flex flex-col rounded-[18px] border-[1.5px] bg-surface p-3 text-left ${filtro === s ? borda : "border-line"}`}
            >
              <span className={`text-[26px] leading-none font-extrabold ${cor}`}>{contar(s)}</span>
              <span className="mt-1 text-[13px] font-semibold text-ink-2">{rotulo}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[18px] font-bold">
          {filtro ? `${SITUACAO_PAGAMENTO[filtro].rotulo} (${lista.length})` : `Alunos (${estudio.alunos.length})`}
        </h2>
        {filtro && (
          <button type="button" onClick={() => setFiltro(null)} className="text-[14px] font-bold text-brand">
            Ver todos
          </button>
        )}
      </div>
      <Aviso>{erroPagamento}</Aviso>
      {lista.length === 0 ? (
        <p className="text-ink-3">{filtro ? "Ninguém nesta situação." : "Nenhum aluno ainda."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((a) => {
            const p = pagamentos?.[a.id];
            const s = SITUACAO_PAGAMENTO[p?.situacao ?? "em_dia"];
            const cobrar = p && (p.situacao === "devendo" || p.situacao === "vencendo") && p.cobrancaId;
            return (
              <li key={a.id} className={`flex flex-col gap-2 rounded-[18px] border border-l-[5px] border-line bg-surface px-4 py-3 ${pagamentos ? s.borda : ""}`}>
                <button type="button" onClick={() => setAberto(aberto === a.id ? null : a.id)} className="flex items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.nome}</span>
                    <span className="block text-[13px] text-ink-3">
                      {a.turmas.length ? a.turmas.map((id) => (turmaPorId.get(id) ? rotuloDaTurma(turmaPorId.get(id)!) : "")).join(" · ") : "Sem turma"}
                    </span>
                  </span>
                  {!a.comApp && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12.5px] font-bold text-ink-2">sem app</span>}
                  <span className="text-ink-3" aria-hidden="true">
                    {aberto === a.id ? "▴" : "▾"}
                  </span>
                </button>
                {p && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${s.selo}`}>
                      {p.situacao === "pago"
                        ? `Pago${p.pagoEm ? ` em ${dataBr(p.pagoEm)}` : ""}`
                        : p.situacao === "devendo"
                          ? `Devendo ${centavosParaReais(p.devido)}`
                          : p.situacao === "vencendo"
                            ? `${centavosParaReais(p.valor)} · ${textoDoVencimento(p.vencimento!, hoje)}`
                            : `Próxima: ${dataBr(p.vencimento!)}`}
                    </span>
                    {p.situacao === "devendo" && p.vencimento && <span className="text-[13px] text-bad">{textoDoVencimento(p.vencimento, hoje)}</span>}
                    {cobrar && p.alunoAvisou && <span className="text-[13px] font-semibold text-ok">avisou que pagou</span>}
                    {cobrar && (
                      <span className="ml-auto flex items-center gap-3">
                        <a
                          href={linkWhatsapp(a.whatsapp, mensagemDeCobrancaDoEstudio(estudio, a, p, hoje))}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[10px] bg-brand px-3 py-1.5 text-[14px] font-bold text-brand-ink"
                        >
                          Cobrar no WhatsApp
                        </a>
                        <button type="button" disabled={ocupado} onClick={() => recebido(p.cobrancaId!)} className="text-[14px] font-bold text-brand">
                          Recebido
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {aberto === a.id && (
                  <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface-2 p-3">
                    {!a.comApp && <ConviteDoAlunoEstudio alunoId={a.id} nome={a.nome} whatsapp={a.whatsapp} estudio={estudio.nome} />}
                    <TurmasDoAluno alunoId={a.id} turmas={estudio.turmas.filter((t) => t.tipo === "turma")} escolhidas={a.turmas} atualizar={atualizar} />
                    {estudio.config.tipo === "estudio" && <MensalidadeDoAluno estudio={estudio} aluno={a} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
        <h2 className="font-bold">Cadastrar alunos</h2>
        <p className="text-[14px] text-ink-3">
          Cole da planilha: um aluno por linha, com o nome e, se quiser, o WhatsApp separado por vírgula. Ex.: <b>Ana Souza, (21) 98888-1111</b>
        </p>
        <textarea
          value={texto}
          onChange={(e) => {
            setAviso(null);
            setTexto(e.target.value);
          }}
          rows={6}
          className="rounded-[14px] border border-line bg-surface p-3 text-[15px] outline-none focus:border-brand"
          placeholder={"Ana Souza, (21) 98888-1111\nBruno Lima"}
        />
        <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
        <button
          type="button"
          disabled={ocupado || !texto.trim()}
          onClick={() =>
            iniciar(async () => {
              const r = await importarAlunos(estudio.id, texto);
              if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
              const fora = r.linhas - r.criados;
              setAviso({
                tipo: "ok",
                texto: `${r.criados} aluno${r.criados === 1 ? "" : "s"} cadastrado${r.criados === 1 ? "" : "s"}.${fora > 0 ? ` ${fora} já estavam na lista ou sem nome válido.` : ""} Toque no nome de cada um, na lista acima, para escolher dia e horário.`,
              });
              setTexto("");
              atualizar();
            })
          }
          className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
        >
          {ocupado ? "Cadastrando…" : "Cadastrar lista"}
        </button>
      </div>
    </section>
  );
}

/**
 * Turmas do aluno (decisão 70): escolhe o dia e o horário, vê quantos alunos a turma tem (ex.: 3/5)
 * e confirma. Embaixo, as turmas em que ele já está, cada uma com "Tirar".
 */
function TurmasDoAluno({
  alunoId,
  turmas,
  escolhidas,
  atualizar,
}: {
  alunoId: string;
  turmas: TurmaDoEstudio[];
  escolhidas: string[];
  atualizar: () => void;
}) {
  const diasComTurma = DIAS.filter((d) => turmas.some((t) => t.diaSemana === d.valor));
  const [dia, setDia] = useState<number | null>(diasComTurma[0]?.valor ?? null);
  const doDia = turmas.filter((t) => t.diaSemana === dia && !escolhidas.includes(t.id)).sort((a, b) => a.inicioMin - b.inicioMin);
  const [turmaId, setTurmaId] = useState("");
  const turma = doDia.find((t) => t.id === turmaId) ?? doDia[0];
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const cheia = turma ? turma.alunos.length >= turma.vagas : false;
  const salvar = (lista: string[]) =>
    iniciar(async () => {
      setErro(null);
      const r = await salvarTurmasDoAluno(alunoId, lista);
      if (!r.ok) return setErro(r.erro);
      setTurmaId("");
      atualizar();
    });
  const minhas = escolhidas
    .map((id) => turmas.find((t) => t.id === id))
    .filter((t): t is TurmaDoEstudio => !!t)
    .sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin);

  if (turmas.length === 0) return <p className="text-[14px] text-ink-3">Crie as aulas na Agenda primeiro.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-bold text-ink-2">Colocar numa turma</p>
      <div className="flex flex-wrap gap-1.5">
        {diasComTurma.map((d) => (
          <button
            key={d.valor}
            type="button"
            aria-pressed={dia === d.valor}
            onClick={() => {
              setDia(d.valor);
              setTurmaId("");
            }}
            className={`min-h-[40px] min-w-[48px] rounded-full border px-3 text-[14.5px] font-semibold ${
              dia === d.valor ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"
            }`}
          >
            {d.curto}
          </button>
        ))}
      </div>
      {doDia.length === 0 ? (
        <p className="text-[14px] text-ink-3">Nenhuma outra turma neste dia.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[14px] font-bold text-ink-2">
            Horário
            <select value={turma?.id ?? ""} onChange={(e) => setTurmaId(e.target.value)} className={ESTILO_CAIXA}>
              {doDia.map((t) => (
                <option key={t.id} value={t.id}>
                  {minParaHora(t.inicioMin)} · {t.modalidade} ({t.alunos.length}/{t.vagas})
                </option>
              ))}
            </select>
          </label>
          {turma && (
            <span className="flex min-h-[52px] flex-col justify-center">
              <span className={`text-[22px] leading-none font-extrabold ${cheia ? "text-bad" : ""}`}>
                {turma.alunos.length}/{turma.vagas}
              </span>
              <span className="text-[12.5px] text-ink-3">{cheia ? "turma cheia" : "alunos"}</span>
            </span>
          )}
          <button
            type="button"
            disabled={ocupado || !turma || cheia}
            onClick={() => turma && salvar([...escolhidas, turma.id])}
            className="min-h-[52px] rounded-[13px] bg-brand px-4 font-bold text-brand-ink disabled:opacity-50"
          >
            {ocupado ? "Salvando…" : cheia ? "Sem vaga" : "Confirmar"}
          </button>
        </div>
      )}
      {minhas.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-[12px] bg-surface px-3">
          {minhas.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2 text-[14.5px]">
              <span className="flex-1">
                <b>{DIAS.find((d) => d.valor === t.diaSemana)?.curto} {minParaHora(t.inicioMin)}</b> · {t.modalidade}{" "}
                <span className="text-[12.5px] text-ink-3">
                  ({t.alunos.length}/{t.vagas})
                </span>
              </span>
              <button type="button" disabled={ocupado} onClick={() => salvar(escolhidas.filter((x) => x !== t.id))} className="font-bold text-ink-3">
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => {
          if (!confirm("Tirar este aluno do estúdio?")) return;
          iniciar(async () => {
            const r = await encerrarAlunoEstudio(alunoId);
            if (!r.ok) return setErro(r.erro);
            atualizar();
          });
        }}
        className="self-start text-[14px] font-bold text-ink-3"
      >
        Tirar do estúdio
      </button>
    </div>
  );
}
