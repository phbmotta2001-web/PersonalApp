"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarTabelaDeValores } from "@/data/precos";
import { frase } from "@/lib/formato";
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from "@/lib/matricula";
import { aPartirDe, problemasDaTabela, SEMANAS_POR_MES, VEZES_POR_SEMANA, type TabelaDeValores } from "@/lib/precos";
import { ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Tabela de valores: quanto custa cada aula conforme quantas vezes por semana o aluno treina. */
export function FormValores({ inicial, continuar }: { inicial: TabelaDeValores; continuar?: string }) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<number, string>>(() =>
    Object.fromEntries(VEZES_POR_SEMANA.map((v) => [v, centavosParaCampo(inicial[v] ?? null)])),
  );
  const [salvo, setSalvo] = useState(() => JSON.stringify(inicial));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  // Texto vazio = não oferece essa frequência.
  const tabela: TabelaDeValores = Object.fromEntries(
    VEZES_POR_SEMANA.flatMap((v) => {
      const c = reaisParaCentavos(textos[v]);
      return c === null ? [] : [[v, c]];
    }),
  );
  const problemas = problemasDaTabela(tabela);
  const mudou = JSON.stringify(tabela) !== salvo;
  const menor = problemas.length === 0 ? aPartirDe(tabela) : null;

  function salvar() {
    iniciar(async () => {
      try {
        const r = await salvarTabelaDeValores(tabela);
        if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
        if (continuar) return router.push(continuar);
        setSalvo(JSON.stringify(tabela));
        setAviso({ tipo: "ok", texto: "Valores salvos." });
      } catch {
        setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
        <p className="text-[14px] text-ink-2">
          Quanto custa <strong>cada aula</strong> conforme quantas vezes por semana o aluno treina. Deixe em branco o que você
          não oferece. A mensalidade é calculada sozinha na matrícula: valor da aula × vezes por semana × {SEMANAS_POR_MES}.
        </p>

        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {VEZES_POR_SEMANA.map((v) => {
            const aula = tabela[v];
            return (
              <li key={v} className="flex items-center gap-3 py-3">
                <label htmlFor={`valor-${v}`} className="w-[64px] shrink-0 leading-tight">
                  <span className="block text-[17px] font-extrabold">{v}x</span>
                  <span className="block text-[12.5px] text-ink-3">por semana</span>
                </label>
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-3">R$</span>
                  <input
                    id={`valor-${v}`}
                    inputMode="decimal"
                    placeholder="—"
                    value={textos[v]}
                    onChange={(e) => {
                      setAviso(null);
                      setTextos({ ...textos, [v]: e.target.value });
                    }}
                    className={`${ESTILO_CAIXA} min-h-11 pl-9 tabular-nums`}
                    aria-describedby={`mensal-${v}`}
                  />
                </div>
                <span id={`mensal-${v}`} className="w-[84px] shrink-0 text-right text-[12.5px] leading-tight text-ink-3 tabular-nums">
                  {aula != null && !Number.isNaN(aula) ? (
                    <>
                      {centavosParaReais(aula * v * SEMANAS_POR_MES)}
                      <br />
                      por mês
                    </>
                  ) : (
                    "não ofereço"
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {menor != null && (
          <p className="text-[13px] text-ink-3">
            Quando a busca de personais abrir, seu perfil vai mostrar &quot;a partir de {centavosParaReais(menor)} por aula&quot; e
            a tabela completa.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <button
          type="button"
          onClick={salvar}
          disabled={(!mudou && !continuar) || problemas.length > 0 || salvando}
          className={ESTILO_BOTAO_PRINCIPAL}
        >
          {salvando
            ? "Salvando…"
            : !continuar
              ? "Salvar valores"
              : Object.keys(tabela).length > 0
                ? "Salvar e continuar"
                : "Continuar (não dou aulas presenciais)"}
        </button>
        <p aria-live="polite" className="min-h-4 text-center text-[13px] text-ink-3">
          {problemas.length > 0
            ? frase(problemas)
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
