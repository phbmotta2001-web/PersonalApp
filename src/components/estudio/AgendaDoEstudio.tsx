"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarTurmaNosDias, type AulaNaAgendaDoEstudio, type EstudioCompleto, type TipoDeHorario } from "@/data/estudio";
import { coresDaEquipe } from "@/lib/cores-professor";
import { DIAS, dataCurta, diaDaSemana, emBrasilia, minParaHora, opcoesDeHora, somarDias } from "@/lib/expediente";
import { Chip } from "../Chip";
import { EscolhaDeDias } from "./EscolhaDeDias";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";

const PX_POR_MIN = 1.6;
const PASSO = 30;
const DURACOES_TURMA = [30, 45, 50, 60, 75, 90, 120];
const SEM_PROFESSOR = "sem";

const minutoDe = (iso: string) => {
  const [h, m] = emBrasilia(iso).hora.split(":").map(Number);
  return h * 60 + m;
};
const fimDe = (a: AulaNaAgendaDoEstudio) => minutoDe(a.fim) || 1440;
const textoDuracao = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);

/** Aulas que se cruzam na mesma coluna ficam lado a lado. */
function emFaixas(aulas: AulaNaAgendaDoEstudio[]) {
  const lugar = new Map<string, { faixa: number; total: number }>();
  let grupo: AulaNaAgendaDoEstudio[] = [];
  let fins: number[] = [];
  let fimDoGrupo = -Infinity;
  const fecha = () => {
    for (const a of grupo) lugar.set(a.id, { faixa: lugar.get(a.id)!.faixa, total: fins.length });
    grupo = [];
    fins = [];
    fimDoGrupo = -Infinity;
  };
  for (const a of [...aulas].sort((x, y) => minutoDe(x.inicio) - minutoDe(y.inicio))) {
    const ini = minutoDe(a.inicio);
    if (ini >= fimDoGrupo) fecha();
    let f = fins.findIndex((x) => x <= ini);
    if (f === -1) f = fins.length;
    fins[f] = fimDe(a);
    fimDoGrupo = Math.max(fimDoGrupo, fimDe(a));
    lugar.set(a.id, { faixa: f, total: 1 });
    grupo.push(a);
  }
  fecha();
  return lugar;
}

interface Novo {
  professorId: string | null;
  inicioMin: number;
}

/**
 * Agenda do dia da coordenação: uma coluna por profissional, dentro do horário de funcionamento.
 * Toque num horário livre para dar um turno ou uma turma ao profissional; toque num bloco para
 * ver o turno ou a turma (alunos e chamada).
 */
export function AgendaDoEstudio({ estudio, aulas, dia, hoje }: { estudio: EstudioCompleto; aulas: AulaNaAgendaDoEstudio[]; dia: string; hoje: string }) {
  const [novo, setNovo] = useState<Novo | null>(null);
  const semana = diaDaSemana(dia);
  const segunda = somarDias(dia, -((semana + 6) % 7));
  const link = (d: string) => `/estudio/${estudio.id}?aba=agenda&dia=${d}`;
  const aberto = estudio.config.funcionamento[semana];
  const definido = Object.keys(estudio.config.funcionamento).length > 0;

  // Faixa do dia: o funcionamento, ampliada para caber alguma aula fora dele.
  let de = aberto?.inicio ?? 360;
  let ate = aberto?.fim ?? 1320;
  for (const a of aulas) {
    de = Math.min(de, Math.floor(minutoDe(a.inicio) / 60) * 60);
    ate = Math.max(ate, Math.ceil(fimDe(a) / 60) * 60);
  }
  const altura = (ate - de) * PX_POR_MIN;
  const horas = Array.from({ length: Math.ceil((ate - de) / 60) }, (_, i) => Math.ceil(de / 60) * 60 + i * 60).filter((h) => h < ate);
  const slots = Array.from({ length: Math.floor((ate - de) / PASSO) }, (_, i) => de + i * PASSO);

  const colunas: { id: string; nome: string; professorId: string | null }[] = estudio.equipe.map((m) => ({
    id: m.personalId,
    nome: m.nome.split(" ").slice(0, 2).join(" "),
    professorId: m.personalId,
  }));
  const naColuna = (id: string) =>
    aulas.filter((a) => (id === SEM_PROFESSOR ? !a.professorId || !estudio.equipe.some((m) => m.personalId === a.professorId) : a.professorId === id));
  if (naColuna(SEM_PROFESSOR).length > 0) colunas.push({ id: SEM_PROFESSOR, nome: "Sem professor", professorId: null });

  const ativas = aulas.filter((a) => !a.cancelada);
  const turmas = ativas.filter((a) => a.tipo === "turma");
  const vagas = turmas.reduce((s, a) => s + a.vagas, 0);
  const ocupadas = turmas.reduce((s, a) => s + Math.min(a.alunos, a.vagas), 0);
  const semProfessor = ativas.filter((a) => !a.professorId).length;

  // Cada professor com a cor clara dele (a mesma da semana); turno mais claro que aula.
  const cores = coresDaEquipe(estudio.equipe);
  const tom = (a: AulaNaAgendaDoEstudio) =>
    a.cancelada ? "border-line bg-surface-2 text-ink-3 line-through" : !a.professorId || !cores.has(a.professorId) ? "border-bad bg-bad/10 text-bad" : "text-ink";
  const estilo = (a: AulaNaAgendaDoEstudio): React.CSSProperties => {
    const c = !a.cancelada && a.professorId ? cores.get(a.professorId) : undefined;
    return c ? { background: a.tipo === "turno" ? c.turno : c.aula, borderLeftColor: c.forte } : {};
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Agenda do dia">
      <nav className="flex items-center gap-2" aria-label="Dia">
        <Link href={link(somarDias(dia, -7))} scroll={false} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Semana anterior">
          ‹
        </Link>
        <ol className="flex flex-1 gap-1 overflow-x-auto">
          {DIAS.map((d, i) => {
            const data = somarDias(segunda, i);
            const ativo = data === dia;
            const fechado = definido && !estudio.config.funcionamento[d.valor];
            return (
              <li key={data} className="min-w-12 flex-1">
                <Link
                  href={link(data)}
                  scroll={false}
                  aria-current={ativo ? "date" : undefined}
                  className={`flex flex-col items-center rounded-[14px] px-1 py-1.5 text-[13px] font-bold ${
                    ativo ? "bg-brand text-brand-ink" : data === hoje ? "bg-brand-soft text-brand" : fechado ? "text-ink-3/60" : "text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  <span>{d.curto}</span>
                  <span className="text-[15px]">{data.slice(8, 10)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <Link href={link(somarDias(dia, 7))} scroll={false} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próxima semana">
          ›
        </Link>
      </nav>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[19px] font-extrabold">
          {DIAS[(semana + 6) % 7].nome}, {dataCurta(dia)}
          {dia === hoje && <span className="text-brand"> · hoje</span>}
        </h2>
        <span className="text-[14px] text-ink-3">
          {aberto ? `Aberto das ${minParaHora(aberto.inicio)} às ${minParaHora(aberto.fim)}` : definido ? "Fechado neste dia" : "Horário de funcionamento não definido"}
        </span>
        <Link href={`/estudio/${estudio.id}?aba=agenda&semana=${segunda}`} scroll={false} className="text-[14px] font-semibold text-brand">
          Ver a semana
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Numero rotulo="Turmas" valor={String(turmas.length)} />
        <Numero rotulo="Turnos" valor={String(ativas.length - turmas.length)} />
        <Numero rotulo="Ocupação das turmas" valor={vagas ? `${Math.round((ocupadas / vagas) * 100)}%` : "—"} />
        <Numero rotulo="Sem professor" valor={String(semProfessor)} alerta={semProfessor > 0} />
      </div>

      {!definido && (
        <p className="rounded-[16px] bg-gold-soft px-3.5 py-2.5 text-[14px] text-ink-2">
          Defina os dias e horários de funcionamento em{" "}
          <Link href={`/estudio/${estudio.id}?aba=ajustes`} className="font-semibold text-brand">
            Ajustes
          </Link>{" "}
          para a agenda seguir o horário do estúdio.
        </p>
      )}

      {colunas.length === 0 ? (
        <p className="text-ink-3">
          Ninguém na equipe ainda.{" "}
          <Link href={`/estudio/${estudio.id}?aba=equipe`} className="font-semibold text-brand">
            Convidar professores
          </Link>
        </p>
      ) : definido && !aberto && aulas.length === 0 ? (
        <p className="text-ink-3">O estúdio não abre neste dia.</p>
      ) : (
        <div className="max-h-[calc(100dvh-140px)] overflow-auto rounded-[20px] border border-line bg-surface">
          <div className="grid" style={{ gridTemplateColumns: `56px repeat(${colunas.length}, minmax(150px, 1fr))` }}>
            <div className="sticky top-0 left-0 z-30 border-b border-line bg-surface" />
            {colunas.map((c) => (
              <div
                key={c.id}
                className={`sticky top-0 z-20 truncate border-b border-l border-line bg-surface px-2 py-2.5 text-center text-[14px] font-bold ${c.id === SEM_PROFESSOR ? "text-bad" : "text-ink"}`}
              >
                <span className="inline-flex max-w-full items-center gap-1.5">
                  {c.professorId && cores.get(c.professorId) && (
                    <span className="size-3 shrink-0 rounded-[4px]" style={{ background: cores.get(c.professorId)!.forte }} />
                  )}
                  <span className="truncate">{c.nome}</span>
                </span>
              </div>
            ))}

            <div className="sticky left-0 z-10 bg-surface" style={{ height: altura }}>
              {horas.map((h) => (
                <span key={h} className={`absolute right-2 text-[12px] text-ink-3 ${h === de ? "translate-y-0.5" : "-translate-y-1/2"}`} style={{ top: (h - de) * PX_POR_MIN }}>
                  {minParaHora(h)}
                </span>
              ))}
            </div>

            {colunas.map((c) => {
              const lista = naColuna(c.id);
              const lugar = emFaixas(lista);
              return (
                <div key={c.id} className="relative border-l border-line" style={{ height: altura }}>
                  {slots.map((s) => {
                    const fora = definido && (!aberto || s < aberto.inicio || s >= aberto.fim);
                    return fora || c.id === SEM_PROFESSOR ? (
                      <div
                        key={s}
                        className={`absolute inset-x-0 border-t ${s % 60 ? "border-line/30" : "border-line/70"} ${fora ? "bg-surface-2" : ""}`}
                        style={{ top: (s - de) * PX_POR_MIN, height: PASSO * PX_POR_MIN }}
                      />
                    ) : (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNovo({ professorId: c.professorId, inicioMin: s })}
                        aria-label={`${c.nome}, ${minParaHora(s)}: novo horário`}
                        className={`group absolute inset-x-0 border-t text-left ${s % 60 ? "border-line/30" : "border-line/70"} hover:bg-brand-soft/50`}
                        style={{ top: (s - de) * PX_POR_MIN, height: PASSO * PX_POR_MIN }}
                      >
                        <span className="hidden px-2 text-[12px] font-bold text-brand group-hover:inline">+ {minParaHora(s)}</span>
                      </button>
                    );
                  })}
                  {lista.map((a) => {
                    const ini = minutoDe(a.inicio);
                    const fim = Math.max(ini + 20, fimDe(a));
                    const { faixa, total } = lugar.get(a.id) ?? { faixa: 0, total: 1 };
                    return (
                      <Link
                        key={a.id}
                        href={`/estudio/aula/${a.id}`}
                        title={`${emBrasilia(a.inicio).hora}–${emBrasilia(a.fim).hora} · ${a.tipo === "turno" ? "Turno" : "Turma"} ${a.modalidade}`}
                        className={`absolute z-[5] overflow-hidden rounded-[10px] border-l-[3px] px-2 py-1 text-[13px] leading-tight font-bold shadow-sm hover:brightness-95 ${tom(a)}`}
                        style={{
                          top: (ini - de) * PX_POR_MIN + 1,
                          height: (fim - ini) * PX_POR_MIN - 2,
                          left: `calc(${(faixa / total) * 100}% + 3px)`,
                          width: `calc(${100 / total}% - 6px)`,
                          ...estilo(a),
                        }}
                      >
                        <span className="block truncate">{a.modalidade}</span>
                        <span className="block truncate text-[12px] font-semibold opacity-85">
                          {emBrasilia(a.inicio).hora}–{emBrasilia(a.fim).hora}
                        </span>
                        <span className="block truncate text-[12px] font-semibold opacity-85">
                          {a.tipo === "turno" ? "Turno" : `${a.alunos}/${a.vagas} alunos${a.chamadaEm ? " · ✓" : ""}`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
        <span>Cor mais clara: turno · mais forte: aula</span>
        <Legenda cor="bg-bad">Sem professor</Legenda>
        <span>Toque num horário livre para dar um turno ou uma turma ao profissional. Repete toda semana.</span>
      </p>

      {novo && <NovoHorario estudio={estudio} dia={semana} novo={novo} aberto={aberto} fechar={() => setNovo(null)} />}
    </section>
  );
}

function NovoHorario({
  estudio,
  dia,
  novo,
  aberto,
  fechar,
}: {
  estudio: EstudioCompleto;
  dia: number;
  novo: Novo;
  aberto: { inicio: number; fim: number } | undefined;
  fechar: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeHorario>("turno");
  const [modalidade, setModalidade] = useState("");
  const [dias, setDias] = useState([dia]);
  const [inicio, setInicio] = useState(novo.inicioMin);
  const [duracao, setDuracao] = useState(240);
  const [vagas, setVagas] = useState(Math.min(10, estudio.config.maxAlunosTurma));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const fecha = aberto?.fim ?? 1440;
  const turno = tipo === "turno";
  const duracoes = DURACOES_TURMA.filter((m) => inicio + m <= fecha);
  // Turno: "das … às …", de 1 h a 12 h, sem passar do fechamento.
  const finsDoTurno = opcoesDeHora(Math.min(inicio + 60, fecha), Math.min(inicio + 720, fecha));
  const duracaoValida = turno
    ? Math.min(Math.max(duracao, finsDoTurno[0] - inicio), finsDoTurno.at(-1)! - inicio)
    : duracoes.includes(duracao)
      ? duracao
      : (duracoes.at(-1) ?? 30);
  const nome = estudio.equipe.find((m) => m.personalId === novo.professorId)?.nome ?? "Sem professor";

  const mudarTipo = (t: TipoDeHorario) => {
    setTipo(t);
    setDuracao(t === "turno" ? 240 : 60);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={fechar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await salvarTurmaNosDias(
              estudio.id,
              {
              id: null,
              tipo,
              modalidade,
              diaSemana: dia,
              inicioMin: inicio,
              duracaoMin: duracaoValida,
              vagas,
              professorId: novo.professorId,
              },
              dias,
            );
            if (!r.ok) return setErro(r.erro);
            fechar();
            router.refresh();
          });
        }}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-[24px] bg-app p-5 sm:rounded-[24px]"
        aria-label="Novo horário"
      >
        <div>
          <p className="text-[13px] text-ink-3">
            {nome} · repete toda semana
          </p>
          <h2 className="text-[20px] font-extrabold">Novo horário</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={turno} onClick={() => mudarTipo("turno")}>
            Turno de trabalho
          </Chip>
          <Chip ativo={!turno} onClick={() => mudarTipo("turma")}>
            Turma (com alunos)
          </Chip>
        </div>
        <EscolhaDeDias valor={dias} mudar={setDias} abertos={Object.keys(estudio.config.funcionamento).map(Number)} />
        <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
          {turno ? "Função" : "Modalidade"}
          <input
            autoFocus
            maxLength={60}
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            placeholder={turno ? "Ex.: Musculação" : "Ex.: Funcional"}
            className={ESTILO_CAIXA}
          />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
            {turno ? "Das" : "Início"}
            <select value={inicio} onChange={(e) => setInicio(Number(e.target.value))} className={ESTILO_CAIXA}>
              {opcoesDeHora(aberto?.inicio ?? 0, fecha - 30).map((m) => (
                <option key={m} value={m}>
                  {minParaHora(m)}
                </option>
              ))}
            </select>
          </label>
          {turno ? (
            <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
              Às
              <select value={inicio + duracaoValida} onChange={(e) => setDuracao(Number(e.target.value) - inicio)} className={ESTILO_CAIXA}>
                {finsDoTurno.map((m) => (
                  <option key={m} value={m}>
                    {minParaHora(m)} ({textoDuracao(m - inicio)})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
              Duração
              <select value={duracaoValida} onChange={(e) => setDuracao(Number(e.target.value))} className={ESTILO_CAIXA}>
                {duracoes.map((m) => (
                  <option key={m} value={m}>
                    {textoDuracao(m)} (até {minParaHora(inicio + m)})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!turno && (
          <label className="flex flex-col gap-1.5 text-[14px] font-bold text-ink-2">
            Vagas
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={estudio.config.maxAlunosTurma}
              value={vagas}
              onChange={(e) => setVagas(Number(e.target.value))}
              className={ESTILO_CAIXA}
            />
          </label>
        )}
        <Aviso>{erro}</Aviso>
        <div className="flex gap-2.5">
          <button type="button" onClick={fechar} className={ESTILO_BOTAO_SECUNDARIO + " flex-1"}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={ESTILO_BOTAO_PRINCIPAL + " flex-1"}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-3">
      <p className="text-[13px] text-ink-3">{rotulo}</p>
      <p className={`text-[20px] font-extrabold ${alerta ? "text-bad" : ""}`}>{valor}</p>
    </div>
  );
}

function Legenda({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${cor}`} />
      {children}
    </span>
  );
}
