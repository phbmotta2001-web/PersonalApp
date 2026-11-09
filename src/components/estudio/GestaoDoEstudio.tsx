"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  convidarProfessor,
  encerrarAlunoEstudio,
  encerrarTurma,
  importarAlunos,
  removerDaEquipe,
  salvarTurma,
  salvarTurmasDoAluno,
  type DadosTurma,
  type EstudioCompleto,
  type TurmaDoEstudio,
} from "@/data/estudio";
import type { FinanceiroDoMes } from "@/data/estudio-financeiro";
import { linkWhatsapp } from "@/lib/convite";
import { DIAS, minParaHora, opcoesDeHora } from "@/lib/expediente";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { AjustesDoEstudio, FinanceiroDoEstudio, MensalidadeDoAluno, ValorDoProfessor } from "./FinanceiroDoEstudio";

export type Aba = "agenda" | "turmas" | "equipe" | "alunos" | "financeiro" | "ajustes";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "agenda", rotulo: "Agenda" },
  { valor: "turmas", rotulo: "Turmas" },
  { valor: "equipe", rotulo: "Professores" },
  { valor: "alunos", rotulo: "Alunos" },
  { valor: "financeiro", rotulo: "Financeiro" },
  { valor: "ajustes", rotulo: "Ajustes" },
];

const nomeDoDia = (d: number) => DIAS.find((x) => x.valor === d)?.nome ?? "";
export const rotuloDaTurma = (t: Pick<TurmaDoEstudio, "modalidade" | "diaSemana" | "inicioMin">) =>
  `${t.modalidade} · ${DIAS.find((x) => x.valor === t.diaSemana)?.curto ?? ""} ${minParaHora(t.inicioMin)}`;

/** Coordenação do estúdio: turmas, professores e alunos (decisão 54, etapa 1). */
export function GestaoDoEstudio({
  estudio,
  aba,
  financeiro,
  agenda,
}: {
  estudio: EstudioCompleto;
  aba: Aba;
  /** Só na aba Agenda: a grade da semana, montada no servidor. */
  agenda?: React.ReactNode;
  /** Só na aba Financeiro: o mês ("AAAA-MM"), hoje e os dados. */
  financeiro?: { mes: string; hoje: string; dados: FinanceiroDoMes };
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <nav className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1" aria-label="Partes do estúdio">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/estudio/${estudio.id}?aba=${a.valor}`}
            scroll={false}
            aria-current={aba === a.valor ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-[15px] font-bold ${
              aba === a.valor ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink-2"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      {aba === "agenda" && agenda}
      {aba === "turmas" && <Turmas estudio={estudio} atualizar={() => router.refresh()} />}
      {aba === "equipe" && <Equipe estudio={estudio} atualizar={() => router.refresh()} />}
      {aba === "alunos" && <Alunos estudio={estudio} atualizar={() => router.refresh()} />}
      {aba === "financeiro" && financeiro && <FinanceiroDoEstudio estudio={estudio} {...financeiro} />}
      {aba === "ajustes" && <AjustesDoEstudio estudio={estudio} />}
    </div>
  );
}

// ─── Turmas ─────────────────────────────────────────────────────────────────

const NOVA: Omit<DadosTurma, "vagas"> = { id: null, tipo: "turma", modalidade: "", diaSemana: 1, inicioMin: 1080, duracaoMin: 60, professorId: null };
/** Turma: 30 min a 2 h. Turno: até 12 h. */
const DURACOES_TURMA = [30, 45, 50, 60, 75, 90, 120];
const DURACOES_TURNO = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720];
const textoDuracao = (m: number) => (m < 60 || m % 60 ? `${m} min` : `${m / 60} h`);

function Turmas({ estudio, atualizar }: { estudio: EstudioCompleto; atualizar: () => void }) {
  const [editando, setEditando] = useState<DadosTurma | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const professores = estudio.equipe;
  const nomeDe = (id: string | null) => professores.find((p) => p.personalId === id)?.nome ?? "Sem professor";

  const salvar = () =>
    editando &&
    iniciar(async () => {
      setErro(null);
      const r = await salvarTurma(estudio.id, editando);
      if (!r.ok) return setErro(r.erro);
      setEditando(null);
      atualizar();
    });

  return (
    <section className="flex flex-col gap-3" aria-label="Turmas">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[18px] font-bold">Turmas e turnos ({estudio.turmas.length})</h2>
        {!editando && (
          <button type="button" onClick={() => setEditando({ ...NOVA, vagas: estudio.config.maxAlunosTurma, professorId: professores[0]?.personalId ?? null })} className="rounded-[12px] bg-brand px-4 py-2 font-bold text-brand-ink">
            + Turma ou turno
          </button>
        )}
      </div>

      {editando && (
        <div className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-brand bg-surface p-4">
          <h3 className="font-bold">{editando.id ? (editando.tipo === "turno" ? "Alterar turno" : "Alterar turma") : "Novo horário"}</h3>
          <div className="flex flex-wrap gap-2">
            {(["turma", "turno"] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                aria-pressed={editando.tipo === tp}
                onClick={() =>
                  setEditando({
                    ...editando,
                    tipo: tp,
                    duracaoMin: tp === "turno" ? Math.max(editando.duracaoMin, 240) : Math.min(editando.duracaoMin, 60),
                  })
                }
                className={`rounded-full border px-3.5 py-1.5 text-[14.5px] font-semibold ${editando.tipo === tp ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink-2"}`}
              >
                {tp === "turma" ? "Turma (com alunos)" : "Turno de trabalho"}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              {editando.tipo === "turno" ? "Função" : "Modalidade"}
              <input
                value={editando.modalidade}
                onChange={(e) => setEditando({ ...editando, modalidade: e.target.value })}
                placeholder={editando.tipo === "turno" ? "Ex.: Musculação" : "Ex.: Funcional"}
                maxLength={40}
                className={ESTILO_CAIXA}
              />
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              Professor
              <select
                value={editando.professorId ?? ""}
                onChange={(e) => setEditando({ ...editando, professorId: e.target.value || null })}
                className={ESTILO_CAIXA}
              >
                <option value="">Sem professor</option>
                {professores.map((p) => (
                  <option key={p.personalId} value={p.personalId}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              Dia
              <select value={editando.diaSemana} onChange={(e) => setEditando({ ...editando, diaSemana: Number(e.target.value) })} className={ESTILO_CAIXA}>
                {DIAS.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              Horário
              <select value={editando.inicioMin} onChange={(e) => setEditando({ ...editando, inicioMin: Number(e.target.value) })} className={ESTILO_CAIXA}>
                {opcoesDeHora(300, 1380).map((m) => (
                  <option key={m} value={m}>
                    {minParaHora(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              Duração
              <select value={editando.duracaoMin} onChange={(e) => setEditando({ ...editando, duracaoMin: Number(e.target.value) })} className={ESTILO_CAIXA}>
                {(editando.tipo === "turno" ? DURACOES_TURNO : DURACOES_TURMA).map((m) => (
                  <option key={m} value={m}>
                    {textoDuracao(m)}
                  </option>
                ))}
              </select>
            </label>
            {editando.tipo === "turma" && (
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink-2">
              Vagas
              <input
                type="number"
                min={1}
                max={estudio.config.maxAlunosTurma}
                value={editando.vagas}
                onChange={(e) => setEditando({ ...editando, vagas: Number(e.target.value) })}
                className={ESTILO_CAIXA}
              />
            </label>
            )}
          </div>
          <Aviso>{erro}</Aviso>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={ocupado} onClick={salvar} className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}>
              {ocupado ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(null)} className="px-3 font-semibold text-ink-3">
              Cancelar
            </button>
          </div>
          <p className="text-[13px] text-ink-3">O app cria as aulas das próximas 8 semanas. Mudar dia ou horário refaz as aulas futuras sem chamada.</p>
        </div>
      )}

      {estudio.turmas.length === 0 && !editando ? (
        <p className="text-ink-3">Nenhuma turma ainda. Comece por &quot;+ Turma&quot;.</p>
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {estudio.turmas.map((t) => (
            <li key={t.id} className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-surface p-4">
              <div className="flex items-start gap-2">
                <span className="flex-1">
                  <span className="block font-bold">{t.modalidade}</span>
                  <span className="block text-[14px] text-ink-2">
                    {nomeDoDia(t.diaSemana)}, {minParaHora(t.inicioMin)} às {minParaHora(t.inicioMin + t.duracaoMin)}
                  </span>
                </span>
                {t.tipo === "turno" ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[12.5px] font-bold text-brand">turno</span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${t.alunos.length >= t.vagas ? "bg-bad/10 text-bad" : "bg-estudio-soft text-estudio"}`}>
                    {t.alunos.length}/{t.vagas}
                  </span>
                )}
              </div>
              <span className="text-[13.5px] text-ink-3">{nomeDe(t.professorId)}</span>
              <div className="flex gap-3 text-[14px] font-semibold">
                <button type="button" onClick={() => setEditando({ ...t, vagas: t.vagas || estudio.config.maxAlunosTurma })} className="text-brand">
                  Alterar
                </button>
                <EncerrarTurma turmaId={t.id} atualizar={atualizar} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EncerrarTurma({ turmaId, atualizar }: { turmaId: string; atualizar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, iniciar] = useTransition();
  if (!confirmando)
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-ink-3">
        Encerrar
      </button>
    );
  return (
    <span className="flex gap-3">
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            await encerrarTurma(turmaId);
            atualizar();
          })
        }
        className="text-bad"
      >
        Confirmar encerrar
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-ink-3">
        Manter
      </button>
    </span>
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

function Alunos({ estudio, atualizar }: { estudio: EstudioCompleto; atualizar: () => void }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const turmaPorId = new Map(estudio.turmas.map((t) => [t.id, t]));

  return (
    <section className="flex flex-col gap-4" aria-label="Alunos">
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
                texto: `${r.criados} aluno${r.criados === 1 ? "" : "s"} cadastrado${r.criados === 1 ? "" : "s"}.${fora > 0 ? ` ${fora} já estavam na lista ou sem nome válido.` : ""} Agora escolha as turmas de cada um abaixo.`,
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

      <h2 className="text-[18px] font-bold">Alunos ({estudio.alunos.length})</h2>
      {estudio.alunos.length === 0 ? (
        <p className="text-ink-3">Nenhum aluno ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {estudio.alunos.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 py-3">
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
              {aberto === a.id && (
                <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface-2 p-3">
                  <TurmasDoAluno alunoId={a.id} turmas={estudio.turmas.filter((t) => t.tipo === "turma")} escolhidas={a.turmas} atualizar={atualizar} />
                  {estudio.config.tipo === "estudio" && <MensalidadeDoAluno estudio={estudio} aluno={a} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
  const [marcadas, setMarcadas] = useState(escolhidas);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {turmas.length === 0 ? (
        <p className="text-[14px] text-ink-3">Crie as turmas primeiro.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {turmas.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-[14.5px]">
              <input
                type="checkbox"
                checked={marcadas.includes(t.id)}
                onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, t.id] : marcadas.filter((x) => x !== t.id))}
                className="size-4 accent-[var(--brand)]"
              />
              {rotuloDaTurma(t)}
              <span className="text-[12.5px] text-ink-3">
                ({t.alunos.length}/{t.vagas})
              </span>
            </label>
          ))}
        </div>
      )}
      <Aviso>{erro}</Aviso>
      <div className="flex flex-wrap gap-3 text-[14px] font-bold">
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarTurmasDoAluno(alunoId, marcadas);
              if (!r.ok) return setErro(r.erro);
              atualizar();
            })
          }
          className="rounded-[10px] bg-brand px-3 py-1.5 text-brand-ink"
        >
          {ocupado ? "Salvando…" : "Salvar turmas"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await encerrarAlunoEstudio(alunoId);
              if (!r.ok) return setErro(r.erro);
              atualizar();
            })
          }
          className="text-ink-3"
        >
          Tirar do estúdio
        </button>
      </div>
    </div>
  );
}
