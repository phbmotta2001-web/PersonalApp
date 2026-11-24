"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { registrarSeries, treinoDaAula } from "@/data/treino";
import { lerNumero, resumoDoExercicio, rotuloDaMedida, textoDaCarga, type Exercicio, type RegistroDoExercicio, type SerieFeita } from "@/lib/treino";

// Decisões 114 e 117: durante a aula, o treino com o exercício atual em destaque, cada série com a
// carga e as repetições (ou segundos) feitas. Os outros exercícios ficam recolhidos, só com o nome.
// Ao marcar o exercício como feito, ele recolhe e o próximo abre. Personal e aluno marcam no mesmo
// treino: cada um vê o que o outro marcou em alguns segundos.

interface Linha {
  carga: string;
  reps: string;
}
interface Estado {
  feito: boolean;
  series: Linha[];
}

const texto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const primeiroNumero = (r: string | null) => (r ?? "").match(/\d+/)?.[0] ?? "";
/** Decisão 118: mudou em relação ao treino montado ("40" e "40,0" contam como iguais). */
const mudou = (feito: string, previsto: string) => {
  const a = lerNumero(feito);
  const b = lerNumero(previsto);
  return a !== b && !(a != null && b != null && Number.isNaN(a) && Number.isNaN(b));
};
// Guarda quando a linha mudou aqui (fora do render, para o lint do React).
const marcarMudanca = (m: Map<string, number>, id: string) => m.set(id, Date.now());

function prescritas(e: Exercicio): Linha[] {
  return Array.from({ length: Math.max(1, e.series ?? 1) }, () => ({ carga: texto(e.cargaKg), reps: primeiroNumero(e.repeticoes) }));
}
const doRegistro = (series: SerieFeita[]): Linha[] => series.map((s) => ({ carga: texto(s.carga), reps: s.reps == null ? "" : String(s.reps) }));

function estadoInicial(exercicios: Exercicio[], registros: RegistroDoExercicio[]): Record<string, Estado> {
  return Object.fromEntries(
    exercicios.map((e) => {
      const r = registros.find((x) => x.exercicioId === e.id);
      return [e.id!, { feito: r?.feito ?? false, series: r && r.series.length > 0 ? doRegistro(r.series) : prescritas(e) }];
    }),
  );
}

export function TreinoAoVivo({
  aulaId,
  exercicios,
  registros,
  dia,
}: {
  aulaId: string;
  exercicios: Exercicio[];
  registros: RegistroDoExercicio[];
  /** O dia do treino escolhido para a aula (para perceber quando o personal troca). */
  dia: number | null;
}) {
  const router = useRouter();
  const lista = exercicios.filter((e) => e.id);
  const [estado, setEstado] = useState(() => estadoInicial(lista, registros));
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [erro, setErro] = useState<string | null>(null);
  // Linha sendo editada: não é sobrescrita pela atualização automática.
  const editando = useRef<string | null>(null);
  // Linhas mudadas aqui há pouco: a atualização automática pode trazer o valor de antes de salvar.
  const mudouEm = useRef(new Map<string, number>());
  const feitos = lista.filter((e) => estado[e.id!]?.feito).length;
  const atual = lista.find((e) => !estado[e.id!]?.feito)?.id ?? null;

  // A cada 8 s, traz o que a outra pessoa marcou (e percebe se o treino foi trocado ou encerrado).
  useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const novo = await treinoDaAula(aulaId);
      if (novo.encerrado || novo.dia !== dia) return router.refresh();
      setEstado((antes) => {
        const prox = { ...antes };
        for (const r of novo.registros) {
          if (r.exercicioId === editando.current || !prox[r.exercicioId]) continue;
          if (Date.now() - (mudouEm.current.get(r.exercicioId) ?? 0) < 10_000) continue;
          prox[r.exercicioId] = { feito: r.feito, series: r.series.length > 0 ? doRegistro(r.series) : prox[r.exercicioId].series };
        }
        return prox;
      });
    }, 8_000);
    return () => window.clearInterval(t);
  }, [aulaId, dia, router]);

  const salvar = async (id: string, s: Estado) => {
    const series = s.series.map((l) => ({ carga: lerNumero(l.carga), reps: lerNumero(l.reps) }));
    if (series.some((x) => (x.carga != null && Number.isNaN(x.carga)) || (x.reps != null && (Number.isNaN(x.reps) || !Number.isInteger(x.reps))))) {
      return setErro("Use só números na carga e nas repetições (como 40 ou 12,5).");
    }
    marcarMudanca(mudouEm.current, id);
    const r = await registrarSeries(aulaId, id, s.feito, series);
    marcarMudanca(mudouEm.current, id);
    setErro(r.ok ? null : r.erro);
  };

  const mudar = (id: string, s: Estado, gravar = false) => {
    marcarMudanca(mudouEm.current, id);
    setEstado((antes) => ({ ...antes, [id]: s }));
    if (gravar) void salvar(id, s);
  };
  const mudarSerie = (id: string, i: number, parte: Partial<Linha>) => {
    const s = estado[id];
    mudar(id, { ...s, series: s.series.map((l, k) => (k === i ? { ...l, ...parte } : l)) });
  };
  const alternarFeito = (id: string) => {
    const s = estado[id];
    mudar(id, { ...s, feito: !s.feito }, true);
    // Feito: recolhe. Desmarcado: volta a abrir.
    setAbertos((a) => {
      const n = new Set(a);
      if (s.feito) n.add(id);
      else n.delete(id);
      return n;
    });
  };
  const alternarAberto = (id: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13.5px] font-semibold text-ink-3">
        {feitos} de {lista.length} feitos
      </p>
      <ol className="flex flex-col gap-2">
        {lista.map((e, i) => {
          const id = e.id!;
          const s = estado[id];
          // O exercício atual fica aberto; os outros, só se a pessoa abrir.
          const aberto = id === atual ? !abertos.has(`fechar:${id}`) : abertos.has(id);
          const unidadeCurta = e.unidade === "placas" ? "placas" : e.unidade;
          const medida = rotuloDaMedida(e.medida, true);

          if (!aberto)
            return (
              <li key={id} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2">
                <BotaoFeito feito={s.feito} nome={e.nome} pequeno onClick={() => alternarFeito(id)} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15.5px] font-bold ${s.feito ? "text-ink-3 line-through" : ""}`}>
                    {i + 1}. {e.nome}
                  </span>
                  {s.feito && <span className="block text-[13px] text-ink-3">{resumoFeito(s, e)}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => (id === atual ? alternarAberto(`fechar:${id}`) : alternarAberto(id))}
                  aria-label={`Abrir ${e.nome}`}
                  aria-expanded={false}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-[18px] text-ink-2"
                >
                  ▾
                </button>
              </li>
            );

          return (
            <li key={id} className={`flex flex-col gap-3 rounded-[18px] border-2 p-3.5 ${id === atual ? "border-brand" : "border-line"} bg-surface`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {id === atual && <p className="text-[12.5px] font-extrabold tracking-[0.05em] text-brand uppercase">Agora</p>}
                  <p className={`font-display text-[22px] leading-tight font-extrabold ${s.feito ? "text-ink-3 line-through" : ""}`}>
                    {i + 1}. {e.nome}
                  </p>
                  {resumoDoExercicio(e) && <p className="mt-0.5 text-[14px] text-ink-3">{resumoDoExercicio(e)}</p>}
                  {e.obs && <p className="mt-1 rounded-[10px] bg-surface-2 px-2.5 py-1.5 text-[14px] text-ink-2">{e.obs}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => (id === atual ? alternarAberto(`fechar:${id}`) : alternarAberto(id))}
                  aria-label={`Recolher ${e.nome}`}
                  aria-expanded
                  className="grid size-10 shrink-0 place-items-center rounded-full text-[18px] text-ink-2"
                >
                  ▴
                </button>
              </div>

              <ol className="flex flex-col gap-1.5">
                {s.series.map((l, k) => (
                  <li key={k} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2">
                    <span className="text-[14px] font-bold text-ink-3">{k + 1}ª</span>
                    <Campo
                      rotulo={`Carga da ${k + 1}ª série (${unidadeCurta})`}
                      sufixo={unidadeCurta}
                      valor={l.carga}
                      alterado={mudou(l.carga, texto(e.cargaKg))}
                      decimal
                      aoFocar={() => (editando.current = id)}
                      aoMudar={(v) => mudarSerie(id, k, { carga: v })}
                      aoSair={() => {
                        editando.current = null;
                        void salvar(id, estado[id]);
                      }}
                    />
                    <Campo
                      rotulo={`${e.medida === "segundos" ? "Segundos" : "Repetições"} da ${k + 1}ª série`}
                      sufixo={medida}
                      valor={l.reps}
                      alterado={mudou(l.reps, primeiroNumero(e.repeticoes))}
                      aoFocar={() => (editando.current = id)}
                      aoMudar={(v) => mudarSerie(id, k, { reps: v })}
                      aoSair={() => {
                        editando.current = null;
                        void salvar(id, estado[id]);
                      }}
                    />
                  </li>
                ))}
              </ol>
              <div className="flex gap-4 text-[14px] font-semibold text-brand">
                {s.series.length < 20 && (
                  <button type="button" onClick={() => mudar(id, { ...s, series: [...s.series, { ...(s.series.at(-1) ?? { carga: "", reps: "" }) }] }, true)}>
                    + Série
                  </button>
                )}
                {s.series.length > 1 && (
                  <button type="button" className="text-ink-3" onClick={() => mudar(id, { ...s, series: s.series.slice(0, -1) }, true)}>
                    − Tirar a última
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => alternarFeito(id)}
                aria-pressed={s.feito}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-[16px] font-bold ${
                  s.feito ? "border border-line text-ink-2" : "bg-ok text-surface"
                }`}
              >
                {s.feito ? "Desmarcar" : "✓ Exercício feito"}
              </button>
            </li>
          );
        })}
      </ol>
      {lista.length > 0 && feitos === lista.length && <p className="text-[15px] font-bold text-ok">Treino completo!</p>}
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </div>
  );
}

/** "4 séries · até 45 kg" */
function resumoFeito(s: Estado, e: Exercicio) {
  const cargas = s.series.map((l) => lerNumero(l.carga)).filter((n): n is number => n != null && !Number.isNaN(n));
  const max = cargas.length ? Math.max(...cargas) : null;
  return [`${s.series.length} ${s.series.length === 1 ? "série" : "séries"}`, max != null ? `até ${textoDaCarga(max, e.unidade)}` : ""].filter(Boolean).join(" · ");
}

function BotaoFeito({ feito, nome, pequeno, onClick }: { feito: boolean; nome: string; pequeno?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={feito}
      aria-label={`${nome}: ${feito ? "feito" : "a fazer"}`}
      onClick={onClick}
      className={`grid shrink-0 place-items-center rounded-[10px] border-2 font-extrabold ${pequeno ? "size-8 text-[15px]" : "size-9 text-[18px]"} ${
        feito ? "border-ok bg-ok text-surface" : "border-line bg-surface text-transparent"
      }`}
    >
      ✓
    </button>
  );
}

function Campo({
  rotulo,
  sufixo,
  valor,
  alterado,
  decimal,
  aoFocar,
  aoMudar,
  aoSair,
}: {
  rotulo: string;
  sufixo: string;
  valor: string;
  /** Diferente do que estava no treino (carga ou repetições mudaram). */
  alterado?: boolean;
  decimal?: boolean;
  aoFocar: () => void;
  aoMudar: (v: string) => void;
  aoSair: () => void;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{rotulo}</span>
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={valor}
        onFocus={aoFocar}
        onChange={(ev) => aoMudar(ev.target.value)}
        onBlur={aoSair}
        className={`min-h-12 w-full rounded-[12px] border pr-12 pl-3 text-[18px] font-bold text-ink tabular-nums outline-none transition-colors focus:border-brand ${
          alterado ? "border-gold/50 bg-gold-soft" : "border-line bg-surface"
        }`}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-semibold text-ink-3">{sufixo}</span>
    </label>
  );
}
