"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apagarAvaliacao, salvarAvaliacao } from "@/data/avaliacoes";
import { lerNumero, MEDIDAS, numeroBr, type AvaliacaoFisica as Avaliacao, type Medida } from "@/lib/avaliacao";
import { dataCurta } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const ROTULO = "flex flex-col gap-1 text-[14px] font-bold text-ink-2";

type Indicador = "peso" | "gordura" | Medida;
const NOME: Record<Indicador, string> = {
  peso: "Peso",
  gordura: "% de gordura",
  ...Object.fromEntries(MEDIDAS.map((m) => [m.chave, m.rotulo])),
} as Record<Indicador, string>;
const UNIDADE = (i: Indicador) => (i === "peso" ? " kg" : i === "gordura" ? "%" : " cm");
const valorDe = (a: Avaliacao, i: Indicador) => (i === "peso" ? a.pesoKg : i === "gordura" ? a.gorduraPct : (a.medidas[i] ?? null));
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

/**
 * Decisão 105: avaliação física com evolução. O personal registra (data, peso, % de gordura e
 * medidas); o personal e o aluno veem o último valor de cada item, a diferença para a avaliação
 * anterior e o gráfico. O aluno só vê (\`editavel\` falso).
 */
export function AvaliacaoFisica({
  vinculoId,
  lista,
  hoje,
  editavel,
}: {
  vinculoId: string;
  /** Da mais antiga para a mais nova. */
  lista: Avaliacao[];
  hoje: string;
  editavel: boolean;
}) {
  const [editando, setEditando] = useState<Avaliacao | "nova" | null>(null);
  const [todas, setTodas] = useState(false);
  const indicadores = (["peso", "gordura", ...MEDIDAS.map((m) => m.chave)] as Indicador[]).filter((i) =>
    lista.some((a) => valorDe(a, i) != null),
  );
  const [grafico, setGrafico] = useState<Indicador>(indicadores[0] ?? "peso");
  const atual = indicadores.includes(grafico) ? grafico : (indicadores[0] ?? "peso");

  if (!editavel && lista.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Avaliação física">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-[16px] font-bold">{editavel ? "Avaliação física" : "Sua evolução"}</h3>
        {editavel && !editando && (
          <button type="button" onClick={() => setEditando("nova")} className="text-[14.5px] font-bold text-brand">
            + Nova avaliação
          </button>
        )}
      </div>

      {editando && (
        <FormAvaliacao
          vinculoId={vinculoId}
          hoje={hoje}
          inicial={editando === "nova" ? null : editando}
          ultima={lista[lista.length - 1] ?? null}
          fechar={() => setEditando(null)}
        />
      )}

      {lista.length === 0 && !editando && (
        <p className="text-[14px] text-ink-3">Registre peso, % de gordura e medidas. O aluno acompanha a evolução no app.</p>
      )}

      {lista.length > 0 && (
        <>
          <Resumo lista={lista} indicadores={indicadores} />
          {lista.filter((a) => valorDe(a, atual) != null).length >= 2 && (
            <div className="flex flex-col gap-2">
              {indicadores.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {indicadores.map((i) => (
                    <Chip key={i} ativo={atual === i} onClick={() => setGrafico(i)}>
                      {NOME[i]}
                    </Chip>
                  ))}
                </div>
              )}
              <Grafico pontos={lista.flatMap((a) => (valorDe(a, atual) == null ? [] : [{ data: a.data, valor: valorDe(a, atual)! }]))} unidade={UNIDADE(atual)} />
            </div>
          )}
          <ul className="flex flex-col divide-y divide-line">
            {[...lista]
              .reverse()
              .slice(0, todas ? undefined : 3)
              .map((a) => (
                <li key={a.id} className="flex items-start gap-2 py-2 text-[14px]">
                  <span className="w-[72px] shrink-0 font-bold">{dataBr(a.data)}</span>
                  <span className="min-w-0 flex-1 text-ink-2">
                    {[
                      a.pesoKg != null && `${numeroBr(a.pesoKg)} kg`,
                      a.gorduraPct != null && `${numeroBr(a.gorduraPct)}% gordura`,
                      ...MEDIDAS.filter((m) => a.medidas[m.chave] != null).map((m) => `${m.rotulo.toLowerCase()} ${numeroBr(a.medidas[m.chave]!)}`),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {a.observacao && <span className="block text-[13px] text-ink-3">{a.observacao}</span>}
                  </span>
                  {editavel && (
                    <button type="button" onClick={() => setEditando(a)} className="font-bold text-brand">
                      Editar
                    </button>
                  )}
                </li>
              ))}
          </ul>
          {lista.length > 3 && (
            <button type="button" onClick={() => setTodas(!todas)} className="self-start text-[14px] font-bold text-brand">
              {todas ? "Mostrar só as últimas" : `Ver todas (${lista.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** O último valor de cada item e quanto mudou desde a avaliação anterior que tinha esse item. */
function Resumo({ lista, indicadores }: { lista: Avaliacao[]; indicadores: Indicador[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {indicadores.map((i) => {
        const com = lista.filter((a) => valorDe(a, i) != null);
        const ultimo = com[com.length - 1];
        const anterior = com[com.length - 2];
        const v = valorDe(ultimo, i)!;
        const dif = anterior ? Math.round((v - valorDe(anterior, i)!) * 10) / 10 : null;
        return (
          <div key={i} className="flex flex-col rounded-[14px] bg-surface-2 px-3 py-2">
            <span className="text-[12.5px] font-bold text-ink-3">{NOME[i]}</span>
            <span className="text-[18px] font-extrabold tabular-nums">
              {numeroBr(v)}
              <span className="text-[13px] font-bold">{UNIDADE(i)}</span>
            </span>
            <span className="text-[12.5px] text-ink-3 tabular-nums">
              {dif == null
                ? `em ${dataCurta(ultimo.data)}`
                : dif === 0
                  ? `igual desde ${dataCurta(anterior.data)}`
                  : `${dif > 0 ? "▲" : "▼"} ${numeroBr(Math.abs(dif))}${UNIDADE(i).trim() === "%" ? " p.p." : UNIDADE(i)} desde ${dataCurta(anterior.data)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Linha simples com os valores ao longo do tempo (o primeiro e o último em destaque). */
function Grafico({ pontos, unidade }: { pontos: { data: string; valor: number }[]; unidade: string }) {
  const L = 320;
  const A = 120;
  const m = { x: 14, topo: 18, base: 22 };
  const valores = pontos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const x = (k: number) => m.x + (k * (L - 2 * m.x)) / Math.max(1, pontos.length - 1);
  const y = (v: number) => m.topo + (1 - (v - min) / faixa) * (A - m.topo - m.base);
  const caminho = pontos.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const ultimo = pontos.length - 1;
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full" role="img" aria-label={`Evolução: de ${numeroBr(pontos[0].valor)}${unidade} para ${numeroBr(pontos[ultimo].valor)}${unidade}`}>
      <path d={caminho} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, k) => (
        <circle key={k} cx={x(k)} cy={y(p.valor)} r={k === 0 || k === ultimo ? 4 : 3} fill="var(--brand)" />
      ))}
      {[0, ultimo].map((k) => (
        <g key={k}>
          <text x={x(k)} y={y(pontos[k].valor) - 8} textAnchor={k === 0 ? "start" : "end"} fontSize="12" fontWeight="700" fill="var(--ink)">
            {numeroBr(pontos[k].valor)}
            {unidade.trim()}
          </text>
          <text x={x(k)} y={A - 6} textAnchor={k === 0 ? "start" : "end"} fontSize="11" fill="var(--ink-3)">
            {dataBr(pontos[k].data)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function FormAvaliacao({
  vinculoId,
  hoje,
  inicial,
  ultima,
  fechar,
}: {
  vinculoId: string;
  hoje: string;
  inicial: Avaliacao | null;
  /** A última avaliação: mostra os valores dela como dica. */
  ultima: Avaliacao | null;
  fechar: () => void;
}) {
  const router = useRouter();
  const txt = (n: number | null | undefined) => (n == null ? "" : numeroBr(n));
  const [data, setData] = useState(inicial?.data ?? hoje);
  const [peso, setPeso] = useState(txt(inicial?.pesoKg));
  const [gordura, setGordura] = useState(txt(inicial?.gorduraPct));
  const [medidas, setMedidas] = useState<Record<string, string>>(
    Object.fromEntries(MEDIDAS.map((m) => [m.chave, txt(inicial?.medidas[m.chave])])),
  );
  const [obs, setObs] = useState(inicial?.observacao ?? "");
  const [comMedidas, setComMedidas] = useState(MEDIDAS.some((m) => inicial?.medidas[m.chave] != null || ultima?.medidas[m.chave] != null));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  // Na avaliação nova, o valor da anterior aparece ao lado do nome do campo.
  const antes = (n: number | null | undefined) =>
    n == null || inicial ? null : <span className="font-normal text-ink-3"> · antes {numeroBr(n)}</span>;

  const salvar = () =>
    iniciar(async () => {
      setErro(null);
      const p = lerNumero(peso);
      const g = lerNumero(gordura);
      const ms: Partial<Record<Medida, number>> = {};
      for (const m of MEDIDAS) {
        const v = lerNumero(medidas[m.chave] ?? "");
        if (Number.isNaN(v)) return setErro(`Confira a medida: ${m.rotulo.toLowerCase()}.`);
        if (v != null) ms[m.chave] = v;
      }
      if (Number.isNaN(p) || Number.isNaN(g)) return setErro("Confira o peso e o percentual de gordura (só números).");
      const r = await salvarAvaliacao(vinculoId, inicial?.id ?? null, { data, pesoKg: p, gorduraPct: g, medidas: ms, observacao: obs });
      if (!r.ok) return setErro(r.erro);
      fechar();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border-2 border-brand bg-surface-2 p-3">
      <p className="font-bold">{inicial ? `Avaliação de ${dataBr(inicial.data)}` : "Nova avaliação"}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className={ROTULO + " col-span-2 sm:col-span-1"}>
          Data
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={ESTILO_CAIXA} />
        </label>
        <label className={ROTULO}>
          <span>Peso (kg){antes(ultima?.pesoKg)}</span>
          <input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} className={ESTILO_CAIXA} />
        </label>
        <label className={ROTULO}>
          <span>% de gordura{antes(ultima?.gorduraPct)}</span>
          <input inputMode="decimal" value={gordura} onChange={(e) => setGordura(e.target.value)} className={ESTILO_CAIXA} />
        </label>
      </div>
      {comMedidas ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-bold text-ink-2">Medidas (cm)</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MEDIDAS.map((m) => (
              <label key={m.chave} className={ROTULO}>
                <span>
                  {m.rotulo}
                  {antes(ultima?.medidas[m.chave])}
                </span>
                <input
                  inputMode="decimal"
                  value={medidas[m.chave] ?? ""}
                  onChange={(e) => setMedidas({ ...medidas, [m.chave]: e.target.value })}
                  className={ESTILO_CAIXA}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setComMedidas(true)} className="self-start text-[14.5px] font-bold text-brand">
          + Medidas (cintura, quadril, braço…)
        </button>
      )}
      <label className={ROTULO}>
        Observação <span className="font-normal text-ink-3">(opcional)</span>
        <input maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} className={ESTILO_CAIXA} />
      </label>
      <Aviso>{erro}</Aviso>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" disabled={ocupado} onClick={salvar} className={ESTILO_BOTAO_PRINCIPAL + " flex-1 sm:flex-none"}>
          {ocupado ? "Salvando…" : "Salvar avaliação"}
        </button>
        <button type="button" onClick={fechar} className="font-bold text-ink-3">
          Cancelar
        </button>
        {inicial && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                if (!window.confirm("Apagar esta avaliação?")) return;
                const r = await apagarAvaliacao(inicial.id);
                if (!r.ok) return setErro(r.erro);
                fechar();
                router.refresh();
              })
            }
            className="ml-auto font-bold text-bad"
          >
            Apagar
          </button>
        )}
      </div>
    </div>
  );
}
