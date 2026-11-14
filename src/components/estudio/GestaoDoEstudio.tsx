"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  convidarProfessor,
  encerrarAlunoEstudio,
  importarAlunos,
  matricularExperimental,
  removerDaEquipe,
  salvarTurmasDoAluno,
  type AlunoDoEstudio,
  type EstudioCompleto,
  type TurmaDoEstudio,
} from "@/data/estudio";
import { marcarMensalidade, type FinanceiroDoMes, type MesDeAlunos, type ResumoDoProfessor, type MesDoEstudio, type PagamentoDoAluno } from "@/data/estudio-financeiro";
import { textoDoVencimento } from "@/lib/cobranca";
import { centavosParaReais } from "@/lib/matricula";
import { pixCopiaECola, type TipoChavePix } from "@/lib/pix";
import { linkWhatsapp } from "@/lib/convite";
import { juntarComE } from "@/lib/formato";
import { DIAS, minParaHora } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { ConviteDoAlunoEstudio } from "./ConviteDoAlunoEstudio";
import { LinkDeAlunos } from "./LinkDeAlunos";
import { AlunosEmExperimental, ConversaoDasExperimentais } from "./ExperimentaisDoEstudio";
import { AgendarExperimental } from "./AgendarExperimental";
import { EditarHorarios } from "./EditarHorarios";
import { FichaDoAlunoEstudio } from "./FichaDoAlunoEstudio";
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
  professores,
  hoje,
  cadastrar,
}: {
  estudio: EstudioCompleto;
  aba: Aba;
  /** Aluno em experimental para abrir já no "Cadastrar aluno" (vindo do Início, decisão 93). */
  cadastrar?: string;
  /** Só na aba Professores: faltas no mês e previsão do pagamento (decisão 83). */
  professores?: ResumoDoProfessor[];
  /** Só na aba Agenda: a grade da semana, montada no servidor. */
  agenda?: React.ReactNode;
  /** Partes montadas no servidor que vão junto da aba (férias e faltas, reposição). */
  complemento?: React.ReactNode;
  /** Só na aba Financeiro: o mês ("AAAA-MM"), hoje e os dados. */
  financeiro?: { mes: string; hoje: string; dados: FinanceiroDoMes; historico: MesDoEstudio[]; crescimento: MesDeAlunos[]; previsao: Record<string, number> | null };
  /** Só na aba Alunos (estúdio que cobra mensalidade): a situação de pagamento de cada aluno. */
  pagamentos?: Record<string, PagamentoDoAluno>;
  hoje: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      {aba === "agenda" && (
        <>
          <AgendarExperimental
            estudioId={estudio.id}
            estudioNome={estudio.nome}
            equipe={estudio.equipe.map((m) => ({ personalId: m.personalId, nome: m.nome }))}
            hoje={hoje}
          />
          <AlunosEmExperimental
            estudio={estudio}
            hoje={hoje}
            atualizar={() => router.refresh()}
            escolherTurmas={(id) => (
              <TurmasDoAluno
                alunoId={id}
                turmas={estudio.turmas.filter((t) => t.tipo === "turma")}
                escolhidas={[]}
                atualizar={() => router.refresh()}
                gravar={matricularExperimental}
              />
            )}
          />
        </>
      )}
      {aba === "agenda" && complemento}
      {aba === "agenda" && agenda}
      {/* Decisão 68: sem lista de turmas; a agenda mostra tudo e "Editar" adiciona, remove e dá professor. */}
      {aba === "agenda" && <EditarHorarios estudio={estudio} hoje={hoje} atualizar={() => router.refresh()} />}
      {aba === "equipe" && <Equipe estudio={estudio} resumo={professores ?? []} atualizar={() => router.refresh()} />}
      {aba === "alunos" && <Alunos estudio={estudio} pagamentos={pagamentos} hoje={hoje} cadastrar={cadastrar} atualizar={() => router.refresh()} />}
      {aba === "financeiro" && financeiro && <FinanceiroDoEstudio estudio={estudio} {...financeiro} />}
      {aba === "ajustes" && <AjustesDoEstudio estudio={estudio} />}
      {aba !== "agenda" && complemento}
    </div>
  );
}

// ─── Equipe ─────────────────────────────────────────────────────────────────

/** Decisão 83: faltas no mês, ocupação das turmas e quanto deve receber no fim do mês. */
function NumerosDoProfessor({ estudio, personalId, resumo }: { estudio: EstudioCompleto; personalId: string; resumo?: ResumoDoProfessor }) {
  const turmas = estudio.turmas.filter((t) => t.tipo === "turma" && t.professorId === personalId);
  const vagas = turmas.reduce((s, t) => s + t.vagas, 0);
  const ocupadas = turmas.reduce((s, t) => s + Math.min(t.alunos.length, t.vagas), 0);
  const pct = vagas ? Math.round((ocupadas / vagas) * 100) : 0;
  const faltas = resumo?.faltas ?? 0;
  return (
    <span className="grid basis-full grid-cols-3 gap-1.5 text-[12.5px]">
      <span className="flex flex-col rounded-[10px] bg-surface-2 px-2 py-1.5">
        <span className="text-ink-3">Faltas no mês</span>
        <b className={`text-[15px] ${faltas > 0 ? "text-bad" : ""}`}>{faltas}</b>
      </span>
      <span className="flex flex-col rounded-[10px] bg-surface-2 px-2 py-1.5">
        <span className="text-ink-3">Ocupação</span>
        {vagas ? (
          <>
            <b className="text-[15px]">{pct}%</b>
            <span className="text-ink-3">
              {vagas - ocupadas} {vagas - ocupadas === 1 ? "vaga livre" : "vagas livres"} de {vagas}
            </span>
          </>
        ) : (
          <b className="text-[15px]">—</b>
        )}
      </span>
      <span className="flex flex-col rounded-[10px] bg-surface-2 px-2 py-1.5">
        <span className="text-ink-3">A receber</span>
        <b className="text-[15px]">{resumo?.previsto != null ? centavosParaReais(resumo.previsto) : "—"}</b>
        <span className="text-ink-3">previsto no mês</span>
      </span>
    </span>
  );
}

function Equipe({ estudio, resumo, atualizar }: { estudio: EstudioCompleto; resumo: ResumoDoProfessor[]; atualizar: () => void }) {
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
            <NumerosDoProfessor estudio={estudio} personalId={m.personalId} resumo={resumo.find((x) => x.personalId === m.personalId)} />
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
  cadastrar,
  atualizar,
}: {
  estudio: EstudioCompleto;
  pagamentos?: Record<string, PagamentoDoAluno>;
  hoje: string;
  cadastrar?: string;
  atualizar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<PagamentoDoAluno["situacao"] | null>(null);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const turmaPorId = new Map(estudio.turmas.map((t) => [t.id, t]));
  // Decisão 77: os professores das turmas do aluno, pelo primeiro nome ("Paulo e Cláudia").
  const professoresDe = (turmas: string[]) =>
    juntarComE(
      [...new Set(turmas.map((id) => turmaPorId.get(id)?.professorId).filter((p): p is string => !!p))]
        .map((p) => estudio.equipe.find((m) => m.personalId === p)?.nome.split(" ")[0])
        .filter((n): n is string => !!n)
        .sort((x, y) => x.localeCompare(y, "pt-BR")),
    );
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

      <AlunosEmExperimental
        estudio={estudio}
        hoje={hoje}
        inicial={cadastrar}
        atualizar={atualizar}
        escolherTurmas={(id) => (
          <TurmasDoAluno alunoId={id} turmas={estudio.turmas.filter((t) => t.tipo === "turma")} escolhidas={[]} atualizar={atualizar} gravar={matricularExperimental} />
        )}
      />

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
                    <span className={`block font-semibold ${p?.situacao === "devendo" ? "text-bad" : ""}`}>
                      {a.nome}
                      {professoresDe(a.turmas) && <span className="font-normal text-ink-2"> · {professoresDe(a.turmas)}</span>}
                    </span>
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
                    <FichaDoAlunoEstudio alunoId={a.id} />
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

      <ConversaoDasExperimentais estudio={estudio} />

      <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
        <h2 className="font-bold">Cadastrar alunos</h2>
        <LinkDeAlunos estudioId={estudio.id} estudio={estudio.nome} />
        <p className="mt-2 text-[14px] text-ink-3">
          Ou cole da planilha: um aluno por linha, com o nome e, se quiser, o WhatsApp separado por vírgula. Ex.: <b>Ana Souza, (21) 98888-1111</b>
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
 * Turmas do aluno (decisões 70 e 71): marca vários dias, um horário para todos (dá para trocar
 * o de um dia só), vê a lotação de cada turma (ex.: 3/5) e confirma. Embaixo, as turmas dele com "Tirar".
 */
function TurmasDoAluno({
  alunoId,
  turmas,
  escolhidas,
  atualizar,
  gravar = salvarTurmasDoAluno,
}: {
  alunoId: string;
  turmas: TurmaDoEstudio[];
  escolhidas: string[];
  atualizar: () => void;
  /** Outra forma de gravar (o "Cadastrar aluno" da aula experimental). */
  gravar?: (alunoId: string, turmas: string[]) => Promise<{ ok: true } | { ok: false; erro: string }>;
}) {
  const diasComTurma = DIAS.filter((d) => turmas.some((t) => t.diaSemana === d.valor));
  const [dias, setDias] = useState<number[]>([]);
  const [horario, setHorario] = useState<number | null>(null);
  // Troca de horário num dia só: dia → turma escolhida.
  const [trocas, setTrocas] = useState<Record<number, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const livres = (d: number) => turmas.filter((t) => t.diaSemana === d && !escolhidas.includes(t.id)).sort((a, b) => a.inicioMin - b.inicioMin);
  const horarios = [...new Set(dias.flatMap((d) => livres(d).map((t) => t.inicioMin)))].sort((a, b) => a - b);
  const h = horario != null && horarios.includes(horario) ? horario : (horarios[0] ?? null);
  const linhas = [...dias]
    .sort((a, b) => a - b)
    .map((d) => {
      const opcoes = livres(d);
      const turma = opcoes.find((t) => t.id === trocas[d]) ?? opcoes.find((t) => t.inicioMin === h) ?? null;
      return { dia: d, opcoes, turma, cheia: !!turma && turma.alunos.length >= turma.vagas };
    });
  const confirmaveis = linhas.filter((l) => l.turma && !l.cheia).map((l) => l.turma!.id);
  const salvar = (lista: string[]) =>
    iniciar(async () => {
      setErro(null);
      const r = await gravar(alunoId, lista);
      if (!r.ok) return setErro(r.erro);
      setDias([]);
      setTrocas({});
      atualizar();
    });
  const minhas = escolhidas
    .map((id) => turmas.find((t) => t.id === id))
    .filter((t): t is TurmaDoEstudio => !!t)
    .sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin);

  if (turmas.length === 0) return <p className="text-[14px] text-ink-3">Crie as aulas na Agenda primeiro.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-bold text-ink-2">Colocar em turmas · escolha os dias</p>
      <div className="flex flex-wrap gap-1.5">
        {diasComTurma.map((d) => {
          const marcado = dias.includes(d.valor);
          return (
            <button
              key={d.valor}
              type="button"
              aria-pressed={marcado}
              onClick={() => setDias(marcado ? dias.filter((x) => x !== d.valor) : [...dias, d.valor])}
              className={`min-h-[40px] min-w-[48px] rounded-full border px-3 text-[14.5px] font-semibold ${
                marcado ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2"
              }`}
            >
              {d.curto}
            </button>
          );
        })}
      </div>
      {dias.length > 0 && (
        <>
          {horarios.length > 0 && (
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2 sm:max-w-[220px]">
              Horário
              <select
                value={h ?? ""}
                onChange={(e) => {
                  setHorario(Number(e.target.value));
                  setTrocas({});
                }}
                className={ESTILO_CAIXA}
              >
                {horarios.map((m) => (
                  <option key={m} value={m}>
                    {minParaHora(m)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="flex flex-col gap-1.5">
            {linhas.map((l) => (
              <li key={l.dia} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-bold">{DIAS.find((d) => d.valor === l.dia)?.curto}</span>
                {l.opcoes.length === 0 ? (
                  <span className="flex-1 text-[14px] text-ink-3">Já está em todas deste dia.</span>
                ) : (
                  <select
                    value={l.turma?.id ?? ""}
                    onChange={(e) => setTrocas({ ...trocas, [l.dia]: e.target.value })}
                    className={ESTILO_CAIXA + " min-w-0 flex-1"}
                    aria-label={`Horário de ${DIAS.find((d) => d.valor === l.dia)?.nome}`}
                  >
                    {!l.turma && <option value="">Sem turma às {h != null ? minParaHora(h) : ""}: escolha</option>}
                    {l.opcoes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {minParaHora(t.inicioMin)} · {t.modalidade} ({t.alunos.length}/{t.vagas})
                      </option>
                    ))}
                  </select>
                )}
                {l.turma && (
                  <span className={`w-12 shrink-0 text-right text-[17px] font-extrabold ${l.cheia ? "text-bad" : ""}`} title={l.cheia ? "Turma cheia" : undefined}>
                    {l.turma.alunos.length}/{l.turma.vagas}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {linhas.some((l) => l.cheia) && <p className="text-[13.5px] text-bad">Turma cheia (em vermelho): escolha outro horário nesse dia ou ela fica de fora.</p>}
          <button
            type="button"
            disabled={ocupado || confirmaveis.length === 0}
            onClick={() => salvar([...escolhidas, ...confirmaveis])}
            className="min-h-[52px] rounded-[13px] bg-brand px-4 font-bold text-brand-ink disabled:opacity-50 sm:self-start"
          >
            {ocupado ? "Salvando…" : confirmaveis.length === 0 ? "Sem vaga" : `Confirmar em ${confirmaveis.length} ${confirmaveis.length === 1 ? "dia" : "dias"}`}
          </button>
        </>
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
