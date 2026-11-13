"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assumirReposicoes, recusarReposicao, type ReposicaoAberta } from "@/data/reposicao";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { centavosParaReais } from "@/lib/matricula";
import { Aviso } from "../Formulario";

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const horario = (r: ReposicaoAberta) => {
  const { data, hora } = emBrasilia(r.inicio);
  return `${DIA_CURTO[new Date(`${data}T12:00:00Z`).getUTCDay()]} ${dataCurta(data)} · ${hora}–${emBrasilia(r.fim).hora} · ${r.modalidade}`;
};

/**
 * Aulas sem professor por férias/falta. Decisão 79: um pedido de substituição por falta/férias,
 * com uma caixinha em cada horário (todas marcadas), o valor de cada um e o total; o professor
 * confirma os que pode ou recusa. Quem confirmar primeiro fica com cada horário.
 */
export function ReposicoesAbertas({ reposicoes, podeAssumir = true }: { reposicoes: ReposicaoAberta[]; podeAssumir?: boolean }) {
  if (reposicoes.length === 0) return null;
  const pedidos = new Map<string, ReposicaoAberta[]>();
  for (const r of reposicoes) pedidos.set(r.ausenciaId, [...(pedidos.get(r.ausenciaId) ?? []), r]);
  return (
    <div className="flex flex-col gap-3">
      {[...pedidos.entries()].map(([id, aulas]) => (
        <Pedido key={id} ausenciaId={id} aulas={aulas} podeAssumir={podeAssumir} />
      ))}
    </div>
  );
}

function Pedido({ ausenciaId, aulas, podeAssumir }: { ausenciaId: string; aulas: ReposicaoAberta[]; podeAssumir: boolean }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(aulas.map((a) => a.aulaId)));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const escolhidas = aulas.filter((a) => marcadas.has(a.aulaId));
  const total = escolhidas.reduce((s, a) => s + a.valor, 0);
  const todas = escolhidas.length === aulas.length;
  const nome = aulas[0].ausente.split(" ")[0];
  const alternar = (id: string) => {
    setAviso(null);
    const novo = new Set(marcadas);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setMarcadas(novo);
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] border-2 border-bad/40 bg-bad/5 p-4" aria-label={`Substituição de ${nome}`}>
      <h2 className="font-bold">
        {nome} precisa de substituição · {aulas.length} {aulas.length === 1 ? "horário" : "horários"}
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {aulas.map((a) => (
          <li key={a.aulaId}>
            {podeAssumir ? (
              <label className="flex cursor-pointer items-center gap-3 py-2 text-[14.5px]">
                <input type="checkbox" checked={marcadas.has(a.aulaId)} onChange={() => alternar(a.aulaId)} className="size-5 shrink-0 accent-[var(--brand)]" />
                <span className="min-w-0 flex-1 truncate font-semibold">{horario(a)}</span>
                <span className="shrink-0">{centavosParaReais(a.valor)}</span>
              </label>
            ) : (
              <p className="flex items-center gap-3 py-2 text-[14.5px]">
                <span className="min-w-0 flex-1 truncate font-semibold">{horario(a)}</span>
                <span className="shrink-0">{centavosParaReais(a.valor)}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
      {podeAssumir ? (
        <>
          <p className="flex justify-between border-t border-line pt-2 font-bold">
            <span>
              {todas ? "Total" : `Total de ${escolhidas.length} ${escolhidas.length === 1 ? "horário" : "horários"}`}
            </span>
            <span>{centavosParaReais(total)}</span>
          </p>
          <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={ocupado || escolhidas.length === 0}
              onClick={() =>
                iniciar(async () => {
                  const r = await assumirReposicoes(escolhidas.map((a) => a.aulaId));
                  if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
                  setAviso({
                    tipo: r.assumidas ? "ok" : "erro",
                    texto:
                      (r.assumidas ? `Pronto: ${r.assumidas === 1 ? "o horário é seu" : `os ${r.assumidas} horários são seus`}. ${nome} e a coordenação foram avisados.` : "") +
                      (r.jaPegas ? ` ${r.jaPegas === 1 ? "Um horário já tinha" : `${r.jaPegas} horários já tinham`} sido pego por outro professor.` : ""),
                  });
                  router.refresh();
                })
              }
              className="min-h-[46px] flex-1 rounded-[14px] bg-brand px-4 font-bold text-brand-ink disabled:opacity-50"
            >
              {ocupado ? "Confirmando…" : todas ? "Confirmar todos" : `Confirmar ${escolhidas.length}`}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  if (!confirm(`Recusar a substituição de ${nome}? Quem pediu será avisado.`)) return;
                  const r = await recusarReposicao(ausenciaId);
                  if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
                  router.refresh();
                })
              }
              className="min-h-[46px] rounded-[14px] border border-line bg-surface px-4 font-bold text-ink-2"
            >
              Recusar
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink-3">A equipe confirma pela página do estúdio. Você é avisado a cada confirmação.</p>
      )}
    </section>
  );
}
