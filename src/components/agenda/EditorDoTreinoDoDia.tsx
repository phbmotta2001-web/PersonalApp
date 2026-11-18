"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarTreinoDoDia } from "@/data/treino";
import { DESCANSOS, lerNumero, type Exercicio } from "@/lib/treino";
import { Aviso, ESTILO_CAIXA } from "../Formulario";

// Decisão 114: o personal monta o treino de um dia: o que será trabalhado (aparece no "próximo
// treino") e os exercícios, um por linha, com séries, repetições, carga e descanso.

interface Linha {
  chave: number;
  id?: string;
  nome: string;
  series: string;
  repeticoes: string;
  carga: string;
  descanso: string;
}

let proximaChave = 1;
const paraLinha = (e: Exercicio): Linha => ({
  chave: proximaChave++,
  id: e.id,
  nome: e.nome,
  series: e.series ? String(e.series) : "",
  repeticoes: e.repeticoes ?? "",
  carga: e.cargaKg != null ? String(e.cargaKg).replace(".", ",") : "",
  descanso: e.descansoSeg != null ? String(e.descansoSeg) : "",
});
const linhaVazia = (): Linha => ({ chave: proximaChave++, nome: "", series: "3", repeticoes: "", carga: "", descanso: "60" });

const CAMPO = "min-h-11 rounded-[10px] border border-line bg-surface px-2.5 text-[15px] text-ink outline-none focus:border-brand";

export function EditorDoTreinoDoDia({
  vinculoId,
  dia,
  focoInicial,
  exerciciosIniciais,
  outrosDias = [],
  voltar,
}: {
  vinculoId: string;
  dia: number;
  focoInicial: string;
  exerciciosIniciais: Exercicio[];
  /** Os outros dias de aula do aluno, para usar o mesmo treino neles. */
  outrosDias?: { dia: number; nome: string; temTreino: boolean }[];
  voltar: string;
}) {
  const router = useRouter();
  const [foco, setFoco] = useState(focoInicial);
  const [linhas, setLinhas] = useState<Linha[]>(() => (exerciciosIniciais.length ? exerciciosIniciais.map(paraLinha) : [linhaVazia()]));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  // Dias que recebem uma cópia deste treino ao salvar.
  const [copiarPara, setCopiarPara] = useState<number[]>([]);
  const [ocupado, iniciar] = useTransition();
  const temTreino = focoInicial.trim() !== "" || exerciciosIniciais.length > 0;

  const nomeDe = (d: number) => (outrosDias.find((o) => o.dia === d)?.nome ?? "").toLowerCase();
  const juntar = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

  const mudar = (chave: number, parte: Partial<Linha>) => {
    setAviso(null);
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  };
  const mover = (i: number, d: -1 | 1) =>
    setLinhas((ls) => {
      const n = [...ls];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  const enviar = (fp: string, ex: Exercicio[], depois: () => void) =>
    iniciar(async () => {
      const r = await salvarTreinoDoDia(vinculoId, dia, fp, ex);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      depois();
    });

  const salvar = () => {
    // Linhas totalmente vazias são ignoradas.
    const usadas = linhas.filter((l) => l.nome.trim() || l.repeticoes.trim() || l.carga.trim());
    if (usadas.some((l) => !l.nome.trim())) return setAviso({ tipo: "erro", texto: "Escreva o nome de cada exercício." });
    const ex: Exercicio[] = usadas.map((l) => ({
      id: l.id,
      nome: l.nome,
      series: l.series ? Number(l.series) : null,
      repeticoes: l.repeticoes.trim() || null,
      cargaKg: lerNumero(l.carga),
      descansoSeg: l.descanso ? Number(l.descanso) : null,
    }));
    if (ex.some((e) => e.cargaKg != null && Number.isNaN(e.cargaKg))) return setAviso({ tipo: "erro", texto: "Confira as cargas (só números, como 40 ou 12,5)." });
    if (!foco.trim() && ex.length === 0) return setAviso({ tipo: "erro", texto: "Escreva o que será trabalhado ou adicione um exercício." });
    iniciar(async () => {
      const r = await salvarTreinoDoDia(vinculoId, dia, foco, ex);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      // A cópia vai sem os ids: cada dia fica com os próprios exercícios.
      const copia = ex.map((e) => ({ ...e, id: undefined }));
      for (const d of copiarPara) {
        const c = await salvarTreinoDoDia(vinculoId, d, foco, copia);
        if (!c.ok) return setAviso({ tipo: "erro", texto: `Salvo aqui, mas não em ${nomeDe(d)}. Tente de novo.` });
      }
      const nomes = copiarPara.map(nomeDe);
      setCopiarPara([]);
      router.refresh();
      setAviso({ tipo: "ok", texto: nomes.length ? `Treino salvo aqui e em ${juntar(nomes)}.` : "Treino salvo." });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold text-ink-2">O que será trabalhado</span>
        <input
          value={foco}
          maxLength={120}
          onChange={(e) => {
            setAviso(null);
            setFoco(e.target.value);
          }}
          placeholder="Ex.: peito e tríceps"
          className={ESTILO_CAIXA}
        />
        <span className="text-[13px] text-ink-3">Aparece para você e para o aluno no próximo treino.</span>
      </label>

      <section className="flex flex-col gap-2" aria-label="Exercícios">
        <h2 className="text-[14px] font-bold text-ink-2">Exercícios</h2>
        <ol className="flex flex-col gap-2.5">
          {linhas.map((l, i) => (
            <li key={l.chave} className="flex flex-col gap-2 rounded-[16px] border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-2">{i + 1}</span>
                <input
                  aria-label={`Exercício ${i + 1}`}
                  value={l.nome}
                  maxLength={80}
                  onChange={(e) => mudar(l.chave, { nome: e.target.value })}
                  placeholder="Ex.: supino reto"
                  className={`${CAMPO} min-w-0 flex-1 font-semibold`}
                />
                <button
                  type="button"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  aria-label={`Tirar o exercício ${i + 1}`}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-[20px] text-ink-3"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                  Séries
                  <select value={l.series} onChange={(e) => mudar(l.chave, { series: e.target.value })} className={CAMPO}>
                    <option value="">—</option>
                    {Array.from({ length: 10 }, (_, k) => (
                      <option key={k + 1} value={k + 1}>
                        {k + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                  Repetições
                  <input
                    value={l.repeticoes}
                    maxLength={20}
                    onChange={(e) => mudar(l.chave, { repeticoes: e.target.value })}
                    placeholder="10 ou 8-12"
                    className={CAMPO}
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                  Carga (kg)
                  <input
                    value={l.carga}
                    inputMode="decimal"
                    onChange={(e) => mudar(l.chave, { carga: e.target.value })}
                    placeholder="—"
                    className={`${CAMPO} tabular-nums`}
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-3">
                  Descanso
                  <select value={l.descanso} onChange={(e) => mudar(l.chave, { descanso: e.target.value })} className={CAMPO}>
                    <option value="">—</option>
                    {DESCANSOS.map((d) => (
                      <option key={d.valor} value={d.valor}>
                        {d.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {linhas.length > 1 && (
                <div className="flex gap-3 text-[13px] font-semibold text-ink-3">
                  {i > 0 && (
                    <button type="button" onClick={() => mover(i, -1)}>
                      ↑ Subir
                    </button>
                  )}
                  {i < linhas.length - 1 && (
                    <button type="button" onClick={() => mover(i, 1)}>
                      ↓ Descer
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
          className="min-h-11 rounded-[12px] border border-dashed border-brand text-[15px] font-bold text-brand"
        >
          + Adicionar exercício
        </button>
      </section>

      {outrosDias.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Usar este treino em outros dias">
          <h2 className="text-[14px] font-bold text-ink-2">Usar o mesmo treino também em</h2>
          <div className="flex flex-wrap gap-2">
            {outrosDias.map((o) => {
              const ativo = copiarPara.includes(o.dia);
              return (
                <button
                  key={o.dia}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setAviso(null);
                    setCopiarPara((xs) => (ativo ? xs.filter((x) => x !== o.dia) : [...xs, o.dia].sort((a, b) => a - b)));
                  }}
                  className={`min-h-10 rounded-full border px-3.5 text-[14px] font-semibold ${
                    ativo ? "border-ink bg-ink text-app" : "border-line bg-surface text-ink-2"
                  }`}
                >
                  {o.nome}
                </button>
              );
            })}
          </div>
          {copiarPara.some((d) => outrosDias.find((o) => o.dia === d)?.temTreino) && (
            <p className="text-[13px] text-ink-3">O treino que já estava nesses dias será substituído.</p>
          )}
        </section>
      )}

      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={salvar}
        className="min-h-12 rounded-[14px] bg-brand text-[15.5px] font-bold text-brand-ink"
      >
        {ocupado ? "Salvando…" : "Salvar treino"}
      </button>

      {temTreino &&
        (confirmarApagar ? (
          <div className="flex flex-col gap-2 rounded-[16px] border border-bad/40 p-3">
            <p className="text-[14.5px]">Apagar o treino deste dia? O que já foi registrado nas aulas continua no gráfico.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => enviar("", [], () => router.push(voltar))}
                className="min-h-11 rounded-[12px] bg-bad font-bold text-white"
              >
                Apagar
              </button>
              <button type="button" onClick={() => setConfirmarApagar(false)} className="min-h-11 rounded-[12px] border border-line font-bold">
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmarApagar(true)} className="self-center text-[14px] font-semibold text-bad">
            Apagar o treino deste dia
          </button>
        ))}
    </div>
  );
}
