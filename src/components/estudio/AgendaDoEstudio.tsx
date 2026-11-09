import Link from "next/link";
import type { AulaNaAgendaDoEstudio, EstudioCompleto } from "@/data/estudio";
import { DIAS, dataCurta, diaDaSemana, emBrasilia, minParaHora, somarDias } from "@/lib/expediente";

const PX_POR_MIN = 1.2;
const minutoDe = (iso: string) => {
  const [h, m] = emBrasilia(iso).hora.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Distribui as aulas do dia em colunas: aulas no mesmo horário ficam lado a lado, e cada grupo
 * de aulas que se cruzam divide a largura só entre elas.
 */
function emColunas(aulas: AulaNaAgendaDoEstudio[]) {
  const lugar = new Map<string, { coluna: number; total: number }>();
  let grupo: AulaNaAgendaDoEstudio[] = [];
  let fins: number[] = [];
  let fimDoGrupo = -Infinity;
  const fecha = () => {
    for (const a of grupo) lugar.set(a.id, { coluna: lugar.get(a.id)!.coluna, total: fins.length });
    grupo = [];
    fins = [];
  };
  for (const a of [...aulas].sort((x, y) => Date.parse(x.inicio) - Date.parse(y.inicio))) {
    const ini = Date.parse(a.inicio);
    if (ini >= fimDoGrupo) fecha();
    let c = fins.findIndex((f) => f <= ini);
    if (c === -1) c = fins.length;
    fins[c] = Date.parse(a.fim);
    fimDoGrupo = Math.max(ini >= fimDoGrupo ? -Infinity : fimDoGrupo, Date.parse(a.fim));
    lugar.set(a.id, { coluna: c, total: 1 });
    grupo.push(a);
  }
  fecha();
  return lugar;
}

/**
 * Agenda de horários da coordenação: todas as turmas da semana, com professor e ocupação.
 * No computador, a grade da semana; no celular, a lista dia a dia. Toque na aula para ver os
 * alunos e a chamada.
 */
export function AgendaDoEstudio({
  estudio,
  aulas,
  inicioSemana,
  semana,
  hoje,
}: {
  estudio: EstudioCompleto;
  aulas: AulaNaAgendaDoEstudio[];
  /** Segunda-feira da semana ("AAAA-MM-DD"). */
  inicioSemana: string;
  /** 0 = esta semana, -1 = a anterior, 1 = a próxima… */
  semana: number;
  hoje: string;
}) {
  const dias = DIAS.map((_, i) => somarDias(inicioSemana, i));
  const doDia = (data: string) => aulas.filter((a) => emBrasilia(a.inicio).data === data);
  const nomeDe = (id: string | null) => estudio.equipe.find((m) => m.personalId === id)?.nome.split(" ")[0] ?? null;
  const link = (n: number) => `/estudio/${estudio.id}?aba=agenda${n ? `&semana=${n}` : ""}`;
  const ativas = aulas.filter((a) => !a.cancelada);
  const vagas = ativas.reduce((s, a) => s + a.vagas, 0);
  const ocupadas = ativas.reduce((s, a) => s + Math.min(a.alunos, a.vagas), 0);
  const semProfessor = ativas.filter((a) => !a.professorId).length;

  const tom = (a: AulaNaAgendaDoEstudio) =>
    a.cancelada
      ? "border-line bg-surface-2 text-ink-3 line-through"
      : !a.professorId
        ? "border-bad bg-bad/10 text-bad"
        : "border-estudio bg-estudio-soft text-estudio";

  const inicios = aulas.map((a) => minutoDe(a.inicio));
  const de = inicios.length ? Math.floor(Math.min(...inicios) / 60) * 60 : 360;
  const ate = aulas.length ? Math.ceil(Math.max(...aulas.map((a) => minutoDe(a.fim) || 1440)) / 60) * 60 : 1260;
  const horas = Array.from({ length: (ate - de) / 60 }, (_, i) => de + i * 60);

  return (
    <section className="flex flex-col gap-4" aria-label="Agenda de horários">
      <nav className="flex items-center gap-2" aria-label="Semana">
        <Link href={link(semana - 1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Semana anterior">
          ‹
        </Link>
        <h2 className="flex-1 text-center text-[17px] font-bold">
          {dataCurta(dias[0])} a {dataCurta(dias[6])}
          {semana !== 0 && (
            <Link href={link(0)} scroll={false} className="ml-2 text-[14px] font-semibold text-brand">
              hoje
            </Link>
          )}
        </h2>
        <Link href={link(semana + 1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próxima semana">
          ›
        </Link>
      </nav>

      <div className="grid grid-cols-3 gap-2.5">
        <Numero rotulo="Aulas" valor={String(ativas.length)} />
        <Numero rotulo="Ocupação" valor={vagas ? `${Math.round((ocupadas / vagas) * 100)}%` : "—"} />
        <Numero rotulo="Sem professor" valor={String(semProfessor)} alerta={semProfessor > 0} />
      </div>

      {aulas.length === 0 ? (
        <p className="text-ink-3">
          Nenhuma aula nesta semana.{" "}
          <Link href={`/estudio/${estudio.id}?aba=turmas`} className="font-semibold text-brand">
            Criar turmas
          </Link>
        </p>
      ) : (
        <>
          {/* Celular: dia a dia */}
          <div className="flex flex-col gap-4 md:hidden">
            {dias.map((d) => {
              const lista = doDia(d);
              if (lista.length === 0) return null;
              return (
                <div key={d} className="flex flex-col gap-1.5">
                  <h3 className={`text-[14px] font-extrabold tracking-[0.04em] uppercase ${d === hoje ? "text-brand" : "text-ink-3"}`}>
                    {DIAS[diaDaSemana(d) === 0 ? 6 : diaDaSemana(d) - 1].nome} · {dataCurta(d)}
                    {d === hoje && " · hoje"}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {lista.map((a) => (
                      <li key={a.id}>
                        <Link href={`/estudio/aula/${a.id}`} className={`flex items-center gap-3 rounded-[14px] border-l-[3px] px-3 py-2.5 ${tom(a)}`}>
                          <span className="w-12 shrink-0 text-[15px] font-extrabold">{emBrasilia(a.inicio).hora}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-bold">{a.modalidade}</span>
                            <span className="block truncate text-[13px] opacity-85">{nomeDe(a.professorId) ?? "Sem professor"}</span>
                          </span>
                          <Ocupacao a={a} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Computador: grade da semana */}
          <div className="hidden overflow-x-auto rounded-[20px] border border-line bg-surface md:block">
            <div className="grid min-w-[900px] grid-cols-[52px_repeat(7,1fr)]">
              <div />
              {dias.map((d, i) => (
                <div key={d} className={`border-b border-l border-line px-2 py-2 text-center text-[13px] font-bold ${d === hoje ? "text-brand" : "text-ink-2"}`}>
                  {DIAS[i].curto} {dataCurta(d)}
                </div>
              ))}
              <div className="relative" style={{ height: (ate - de) * PX_POR_MIN }}>
                {horas.map((h) => (
                  <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11.5px] text-ink-3" style={{ top: (h - de) * PX_POR_MIN }}>
                    {minParaHora(h)}
                  </span>
                ))}
              </div>
              {dias.map((d) => {
                const lista = doDia(d);
                const lugar = emColunas(lista);
                return (
                  <div key={d} className={`relative border-l border-line ${d === hoje ? "bg-brand-soft/30" : ""}`} style={{ height: (ate - de) * PX_POR_MIN }}>
                    {horas.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - de) * PX_POR_MIN }} />
                    ))}
                    {lista.map((a) => {
                      const ini = minutoDe(a.inicio);
                      const fim = Math.max(ini + 25, minutoDe(a.fim) || 1440);
                      const { coluna: c, total } = lugar.get(a.id) ?? { coluna: 0, total: 1 };
                      return (
                        <Link
                          key={a.id}
                          href={`/estudio/aula/${a.id}`}
                          title={`${emBrasilia(a.inicio).hora} · ${a.modalidade} · ${nomeDe(a.professorId) ?? "sem professor"} · ${a.alunos}/${a.vagas}`}
                          className={`absolute overflow-hidden rounded-[8px] border-l-[3px] px-1.5 py-1 text-[12px] leading-tight font-bold hover:brightness-95 ${tom(a)}`}
                          style={{
                            top: (ini - de) * PX_POR_MIN + 1,
                            height: (fim - ini) * PX_POR_MIN - 2,
                            left: `calc(${(c / total) * 100}% + 2px)`,
                            width: `calc(${100 / total}% - 4px)`,
                          }}
                        >
                          <span className="block truncate">{a.modalidade}</span>
                          <span className="block truncate text-[11px] font-semibold opacity-85">{emBrasilia(a.inicio).hora}</span>
                          <span className="block truncate text-[11px] font-semibold opacity-85">{nomeDe(a.professorId) ?? "sem professor"}</span>
                          <span className="block text-[11px] font-semibold opacity-85">
                            {a.alunos}/{a.vagas} alunos
                            {a.chamadaEm && " · ✓"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[13px] text-ink-3">Vermelho: aula sem professor. Toque numa aula para ver os alunos e a chamada.</p>
        </>
      )}
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

function Ocupacao({ a }: { a: AulaNaAgendaDoEstudio }) {
  const cheia = a.alunos >= a.vagas;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-bold ${cheia ? "bg-gold-soft text-gold" : "bg-surface text-ink-2"}`}>
      {a.alunos}/{a.vagas}
      {a.chamadaEm && " ✓"}
    </span>
  );
}
