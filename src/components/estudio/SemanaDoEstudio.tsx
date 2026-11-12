import Link from "next/link";
import type { AulaNaAgendaDoEstudio, EstudioCompleto } from "@/data/estudio";
import { coresDaEquipe } from "@/lib/cores-professor";
import { DIAS, dataCurta, diaDaSemana, emBrasilia, minParaHora, somarDias } from "@/lib/expediente";

const PX_POR_MIN = 1.6;

const minutoDe = (iso: string) => {
  const [h, m] = emBrasilia(iso).hora.split(":").map(Number);
  return h * 60 + m;
};
const fimDe = (a: AulaNaAgendaDoEstudio) => minutoDe(a.fim) || 1440;

/** Itens que se cruzam ficam lado a lado (faixa e quantas faixas tem o grupo). */
function emFaixas<T extends { id: string; inicio: string; fim: string }>(itens: T[], fim: (x: T) => number) {
  const lugar = new Map<string, { faixa: number; total: number }>();
  let grupo: T[] = [];
  let fins: number[] = [];
  let fimDoGrupo = -Infinity;
  const fecha = () => {
    for (const a of grupo) lugar.set(a.id, { faixa: lugar.get(a.id)!.faixa, total: fins.length });
    grupo = [];
    fins = [];
    fimDoGrupo = -Infinity;
  };
  for (const a of [...itens].sort((x, y) => minutoDe(x.inicio) - minutoDe(y.inicio))) {
    const ini = minutoDe(a.inicio);
    if (ini >= fimDoGrupo) fecha();
    let f = fins.findIndex((x) => x <= ini);
    if (f === -1) f = fins.length;
    fins[f] = fim(a);
    fimDoGrupo = Math.max(fimDoGrupo, fim(a));
    lugar.set(a.id, { faixa: f, total: 1 });
    grupo.push(a);
  }
  fecha();
  return lugar;
}

/**
 * Semana da coordenação (decisão 64): uma tabela com os dias lado a lado. O turno de cada
 * professor pinta os horários dele com a cor clara dele; cada aula mostra a modalidade,
 * quantos alunos vão e o professor. Ao lado, a legenda das cores.
 */
export function SemanaDoEstudio({ estudio, aulas, segunda, hoje }: { estudio: EstudioCompleto; aulas: AulaNaAgendaDoEstudio[]; segunda: string; hoje: string }) {
  const cores = coresDaEquipe(estudio.equipe);
  const nomeCurto = new Map(estudio.equipe.map((m) => [m.personalId, m.nome.split(" ")[0]]));
  const segundaDeHoje = somarDias(hoje, -diaDaSemana(hoje)); // domingo desta semana
  const linkSemana = (d: string) => `/estudio/${estudio.id}?aba=agenda${d === segundaDeHoje ? "" : `&semana=${d}`}`;
  const linkDia = (d: string) => `/estudio/${estudio.id}?aba=agenda&dia=${d}`;
  const definido = Object.keys(estudio.config.funcionamento).length > 0;

  const dias = DIAS.map((d, i) => {
    const data = somarDias(segunda, i);
    const doDia = aulas.filter((a) => emBrasilia(a.inicio).data === data);
    return { ...d, data, aberto: estudio.config.funcionamento[d.valor], doDia };
  }).filter((d) => !definido || d.aberto || d.doDia.length > 0);

  // Faixa de horários: do primeiro que abre ao último que fecha (e o que tiver de aula fora).
  let de = Math.min(...dias.map((d) => d.aberto?.inicio ?? 1440), 1440);
  let ate = Math.max(...dias.map((d) => d.aberto?.fim ?? 0), 0);
  if (de >= ate) {
    de = 360;
    ate = 1320;
  }
  for (const a of aulas) {
    de = Math.min(de, Math.floor(minutoDe(a.inicio) / 60) * 60);
    ate = Math.max(ate, Math.ceil(fimDe(a) / 60) * 60);
  }
  const altura = (ate - de) * PX_POR_MIN;
  const horas = Array.from({ length: Math.ceil((ate - de) / 60) }, (_, i) => Math.ceil(de / 60) * 60 + i * 60).filter((h) => h < ate);

  const ativas = aulas.filter((a) => !a.cancelada);
  const turmas = ativas.filter((a) => a.tipo === "turma");
  const vagas = turmas.reduce((s, a) => s + a.vagas, 0);
  const alunos = turmas.reduce((s, a) => s + Math.min(a.alunos, a.vagas), 0);
  const semProfessor = turmas.filter((a) => !a.professorId || !cores.has(a.professorId)).length;
  const fim = somarDias(segunda, 6);

  const legenda = (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2.5" aria-label="Cores dos professores">
      {estudio.equipe.map((m) => {
        const c = cores.get(m.personalId)!;
        const n = turmas.filter((a) => a.professorId === m.personalId).length;
        return (
          <li key={m.personalId} className="flex items-center gap-2 text-[14px]">
            <span className="size-4 shrink-0 rounded-[5px] border-[1.5px]" style={{ background: c.aula, borderColor: c.forte }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{m.nome.split(" ").slice(0, 2).join(" ")}</span>
            <span className="text-[12.5px] text-ink-3">{n} aula{n === 1 ? "" : "s"}</span>
          </li>
        );
      })}
      <li className="flex items-center gap-2 text-[14px]">
        <span className="size-4 shrink-0 rounded-[5px] border-[1.5px] border-bad bg-bad/15" />
        <span className="font-semibold text-bad">Sem professor</span>
      </li>
    </ul>
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Agenda da semana">
      <nav className="flex items-center gap-2" aria-label="Semana">
        <Link href={linkSemana(somarDias(segunda, -7))} scroll={false} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Semana anterior">
          ‹
        </Link>
        <h2 className="flex-1 text-center text-[17px] font-extrabold">
          {dataCurta(segunda)} a {dataCurta(fim)}
        </h2>
        <Link href={linkSemana(somarDias(segunda, 7))} scroll={false} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próxima semana">
          ›
        </Link>
      </nav>

      <div className="grid grid-cols-3 gap-2.5">
        <Numero rotulo="Aulas na semana" valor={String(turmas.length)} />
        <Numero rotulo="Alunos / vagas" valor={vagas ? `${alunos}/${vagas}` : "—"} />
        <Numero rotulo="Sem professor" valor={String(semProfessor)} alerta={semProfessor > 0} />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
        <div className="rounded-[16px] border border-line bg-surface p-3 lg:order-2 lg:sticky lg:top-4">
          <p className="mb-2 text-[12.5px] font-bold tracking-[0.05em] text-ink-3 uppercase">Professores</p>
          {legenda}
          <p className="mt-3 text-[12.5px] text-ink-3">A faixa clara é o turno do professor. Toque num dia para ver por professor; para criar ou mudar aulas, use “Editar” embaixo da agenda.</p>
        </div>

        <div className="max-h-[calc(100dvh-120px)] overflow-auto rounded-[20px] border border-line bg-surface lg:order-1">
          <div className="grid" style={{ gridTemplateColumns: `48px repeat(${dias.length}, minmax(104px, 1fr))` }}>
            <div className="sticky top-0 left-0 z-30 border-b border-line bg-surface" />
            {dias.map((d) => (
              <Link
                key={d.data}
                href={linkDia(d.data)}
                className={`sticky top-0 z-20 flex flex-col items-center border-b border-l border-line bg-surface py-2 text-[13px] font-bold hover:bg-surface-2 ${d.data === hoje ? "text-brand" : "text-ink"}`}
              >
                <span>{d.curto}</span>
                <span className="text-[12px] font-semibold text-ink-3">{dataCurta(d.data)}</span>
              </Link>
            ))}

            <div className="sticky left-0 z-10 bg-surface" style={{ height: altura }}>
              {horas.map((h) => (
                <span key={h} className={`absolute right-1.5 text-[11.5px] text-ink-3 ${h === de ? "translate-y-0.5" : "-translate-y-1/2"}`} style={{ top: (h - de) * PX_POR_MIN }}>
                  {minParaHora(h)}
                </span>
              ))}
            </div>

            {dias.map((d) => {
              const turnos = d.doDia.filter((a) => a.tipo === "turno" && !a.cancelada);
              const aulasDoDia = d.doDia.filter((a) => a.tipo === "turma");
              const faixaTurno = emFaixas(turnos, fimDe);
              const faixaAula = emFaixas(aulasDoDia, fimDe);
              return (
                <div key={d.data} className="relative border-l border-line" style={{ height: altura }}>
                  {/* Fechado e linhas das horas */}
                  {d.aberto && d.aberto.inicio > de && <div className="absolute inset-x-0 top-0 bg-surface-2" style={{ height: (d.aberto.inicio - de) * PX_POR_MIN }} />}
                  {d.aberto && d.aberto.fim < ate && <div className="absolute inset-x-0 bottom-0 bg-surface-2" style={{ height: (ate - d.aberto.fim) * PX_POR_MIN }} />}
                  {horas.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - de) * PX_POR_MIN }} />
                  ))}
                  {/* Turnos: o horário pintado com a cor clara do professor */}
                  {turnos.map((t) => {
                    const c = t.professorId ? cores.get(t.professorId) : undefined;
                    const ini = minutoDe(t.inicio);
                    const { faixa, total } = faixaTurno.get(t.id) ?? { faixa: 0, total: 1 };
                    return (
                      <Link
                        key={t.id}
                        href={`/estudio/aula/${t.id}`}
                        title={`Turno ${t.modalidade}: ${nomeCurto.get(t.professorId ?? "") ?? "sem professor"}, ${emBrasilia(t.inicio).hora}–${emBrasilia(t.fim).hora}`}
                        className="absolute"
                        style={{
                          top: (ini - de) * PX_POR_MIN,
                          height: (fimDe(t) - ini) * PX_POR_MIN,
                          left: `${(faixa / total) * 100}%`,
                          width: `${100 / total}%`,
                          background: c?.turno ?? "color-mix(in srgb, var(--bad) 10%, transparent)",
                          borderLeft: `3px solid ${c?.forte ?? "var(--bad)"}`,
                        }}
                      >
                        <span className="block truncate px-1 pt-0.5 text-[10.5px] font-bold text-ink-2">{nomeCurto.get(t.professorId ?? "") ?? "Sem professor"}</span>
                      </Link>
                    );
                  })}
                  {/* Aulas: modalidade, alunos e professor */}
                  {aulasDoDia.map((a) => {
                    const c = a.professorId ? cores.get(a.professorId) : undefined;
                    const ini = minutoDe(a.inicio);
                    const fimA = Math.max(ini + 30, fimDe(a));
                    const { faixa, total } = faixaAula.get(a.id) ?? { faixa: 0, total: 1 };
                    const cheia = a.alunos >= a.vagas;
                    return (
                      <Link
                        key={a.id}
                        href={`/estudio/aula/${a.id}`}
                        title={`${emBrasilia(a.inicio).hora}–${emBrasilia(a.fim).hora} · ${a.modalidade} · ${a.alunos}/${a.vagas} alunos · ${nomeCurto.get(a.professorId ?? "") ?? "sem professor"}${a.nomes.length ? `
${a.nomes.join(", ")}` : ""}`}
                        className={`absolute z-[5] overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-0.5 text-[12px] leading-tight hover:brightness-95 ${
                          a.cancelada ? "text-ink-3 line-through" : "text-ink"
                        }`}
                        style={{
                          top: (ini - de) * PX_POR_MIN + 2,
                          height: (fimA - ini) * PX_POR_MIN - 4,
                          left: `calc(${(faixa / total) * 100}% + ${total > 1 ? 1 : 10}px)`,
                          width: `calc(${100 / total}% - ${total > 1 ? 2 : 13}px)`,
                          background: a.cancelada ? "var(--surface-2)" : (c?.aula ?? "color-mix(in srgb, var(--bad) 16%, var(--surface))"),
                          borderLeftColor: a.cancelada ? "var(--line)" : (c?.forte ?? "var(--bad)"),
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <span className="min-w-0 flex-1 truncate font-bold">{a.modalidade}</span>
                          {a.extra && <span className="shrink-0 rounded-[4px] bg-ink px-1 text-[9.5px] font-extrabold tracking-wide text-app uppercase">extra</span>}
                          <span className={`shrink-0 font-extrabold tabular-nums ${cheia ? "text-gold" : ""}`}>
                            {a.alunos}/{a.vagas}
                          </span>
                        </span>
                        <span className={`block truncate text-[11.5px] font-semibold ${c ? "text-ink-2" : "text-bad"}`}>
                          {a.cancelada ? "Cancelada" : (nomeCurto.get(a.professorId ?? "") ?? "Sem professor")}
                        </span>
                        {!a.cancelada &&
                          a.nomes.map((n, k) => (
                            <span key={k} className="block truncate text-[10.5px] leading-[12px] text-ink-2">
                              {n}
                            </span>
                          ))}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
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
