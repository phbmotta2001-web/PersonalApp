"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarTabelaOnline } from "@/data/precos";
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from "@/lib/matricula";
import { PLANOS_ONLINE, type TabelaOnline } from "@/lib/precos";
import { ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Planos dos alunos online e híbridos: valor TOTAL de cada período. */
export function FormPlanosOnline({ inicial, continuar }: { inicial: TabelaOnline; continuar?: string }) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<number, string>>(() =>
    Object.fromEntries(PLANOS_ONLINE.map((p) => [p.meses, centavosParaCampo(inicial[p.meses] ?? null)])),
  );
  const [salvo, setSalvo] = useState(() => JSON.stringify(inicial));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  // Texto vazio = não oferece esse plano.
  const tabela: TabelaOnline = Object.fromEntries(
    PLANOS_ONLINE.flatMap((p) => {
      const c = reaisParaCentavos(textos[p.meses]);
      return c === null ? [] : [[p.meses, c]];
    }),
  );
  const invalido = Object.values(tabela).some((v) => v == null || Number.isNaN(v) || v < 100);
  const mudou = JSON.stringify(tabela) !== salvo;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
        <p className="text-[14px] text-ink-2">
          Para alunos <strong>online e híbridos</strong>. Digite o valor <strong>total</strong> de cada plano (ex.: trimestral
          R$ 900 = uma cobrança de R$ 900 a cada 3 meses). Deixe em branco o que você não oferece.
        </p>
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {PLANOS_ONLINE.map((p) => {
            const valor = tabela[p.meses];
            return (
              <li key={p.meses} className="flex items-center gap-3 py-3">
                <label htmlFor={`plano-${p.meses}`} className="w-[86px] shrink-0 text-[15px] font-bold">
                  {p.rotulo}
                </label>
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-3">R$</span>
                  <input
                    id={`plano-${p.meses}`}
                    inputMode="decimal"
                    placeholder="—"
                    value={textos[p.meses]}
                    onChange={(e) => {
                      setAviso(null);
                      setTextos({ ...textos, [p.meses]: e.target.value });
                    }}
                    className={`${ESTILO_CAIXA} min-h-11 pl-9 tabular-nums`}
                  />
                </div>
                <span className="w-[84px] shrink-0 text-right text-[12.5px] leading-tight text-ink-3 tabular-nums">
                  {valor != null && !Number.isNaN(valor) && p.meses > 1 ? (
                    <>
                      {centavosParaReais(Math.round(valor / p.meses))}
                      <br />
                      por mês
                    </>
                  ) : valor == null ? (
                    "não ofereço"
                  ) : (
                    ""
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <button
          type="button"
          disabled={(!mudou && !continuar) || invalido || salvando}
          onClick={() =>
            iniciar(async () => {
              try {
                const r = await salvarTabelaOnline(tabela);
                if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
                if (continuar) return router.push(continuar);
                setSalvo(JSON.stringify(tabela));
                setAviso({ tipo: "ok", texto: "Planos online salvos." });
                router.refresh();
              } catch {
                setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
              }
            })
          }
          className={ESTILO_BOTAO_PRINCIPAL}
        >
          {salvando ? "Salvando…" : continuar ? "Salvar e continuar" : "Salvar planos online"}
        </button>
        <p aria-live="polite" className="min-h-4 text-center text-[13px] text-ink-3">
          {invalido
            ? "Confira os valores (a partir de R$ 1,00)."
            : aviso?.tipo === "erro"
              ? aviso.texto
              : mudou
                ? "Você tem alterações não salvas."
                : (aviso?.texto ?? (Object.keys(tabela).length > 0 ? "Tudo salvo." : ""))}
        </p>
      </div>
    </div>
  );
}
