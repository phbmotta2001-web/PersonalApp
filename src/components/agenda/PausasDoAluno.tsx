"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarPausa, registrarPausa, type Pausa } from "@/data/pausas";
import { somarDias } from "@/lib/expediente";
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from "@/lib/matricula";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000) + 1;

/** Pausas da matrícula na ficha do aluno: registrar (datas, com ou sem desconto) e cancelar. */
export function PausasDoAluno({
  vinculoId,
  nome,
  pausas,
  diasUsados,
  limite,
  valorMensalCentavos,
  hoje,
}: {
  vinculoId: string;
  nome: string;
  pausas: Pausa[];
  /** Dias com desconto já usados neste ano. */
  diasUsados: number;
  /** Máximo de dias com desconto por ano (Regras). */
  limite: number;
  /** Valor de um mês da matrícula (null: sem valor). */
  valorMensalCentavos: number | null;
  hoje: string;
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [de, setDe] = useState(somarDias(hoje, 1));
  const [ate, setAte] = useState(somarDias(hoje, 7));
  const [comDesconto, setComDesconto] = useState(true);
  const [motivo, setMotivo] = useState("");
  // Desconto escolhido à mão (vazio: usa a sugestão, que acompanha as datas).
  const [descontoTexto, setDescontoTexto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const primeiro = nome.split(" ")[0];
  const dias = de && ate && ate >= de ? diasEntre(de, ate) : 0;
  const restam = Math.max(0, limite - diasUsados);
  const diasDesconto = comDesconto ? Math.min(dias, restam) : 0;
  const estimativa = valorMensalCentavos != null ? Math.round((valorMensalCentavos * diasDesconto) / 30) : 0;
  const escolhido = descontoTexto == null ? null : reaisParaCentavos(descontoTexto);
  const descontoInvalido = escolhido != null && (Number.isNaN(escolhido) || escolhido < 0);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Pausas">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-[16px] font-bold">Pausas</h3>
        {!abrindo && (
          <button type="button" onClick={() => setAbrindo(true)} className="text-[14px] font-semibold text-brand">
            Registrar pausa
          </button>
        )}
      </div>

      {pausas.length === 0 && !abrindo && (
        <p className="text-[14px] text-ink-3">
          Viagem, doença ou ausência: as aulas do período saem da agenda e o horário fica livre para reposição.
        </p>
      )}

      {pausas.map((p) => (
        <LinhaDaPausa key={p.id} pausa={p} />
      ))}

      {abrindo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!dias) return setAviso({ tipo: "erro", texto: "Confira as datas da pausa." });
            iniciar(async () => {
              setAviso(null);
              try {
                if (descontoInvalido) return setAviso({ tipo: "erro", texto: "Confira o valor do desconto." });
                const r = await registrarPausa(vinculoId, de, ate, comDesconto, motivo, escolhido);
                if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
                setAviso({
                  tipo: "ok",
                  texto:
                    `Pausa registrada: ${r.aulas} aula${r.aulas === 1 ? "" : "s"} em pausa.` +
                    (r.descontoCentavos > 0 ? ` Desconto de ${centavosParaReais(r.descontoCentavos)} na mensalidade.` : ""),
                });
                setAbrindo(false);
                setMotivo("");
                setDescontoTexto(null);
                router.refresh();
              } catch {
                setAviso({ tipo: "erro", texto: "Não foi possível registrar agora. Confira sua internet." });
              }
            });
          }}
          className="flex flex-col gap-3 border-t border-line pt-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo id="pausa-de" rotulo="De">
              <input
                id="pausa-de"
                type="date"
                min={hoje}
                value={de}
                onChange={(e) => {
                  setDe(e.target.value);
                  if (e.target.value && ate < e.target.value) setAte(e.target.value);
                }}
                className={ESTILO_CAIXA}
              />
            </Campo>
            <Campo id="pausa-ate" rotulo="Até">
              <input
                id="pausa-ate"
                type="date"
                min={de || hoje}
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                className={ESTILO_CAIXA}
              />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Desconto">
            <Chip ativo={comDesconto} onClick={() => setComDesconto(true)}>
              Com desconto
            </Chip>
            <Chip ativo={!comDesconto} onClick={() => setComDesconto(false)}>
              Sem desconto
            </Chip>
          </div>
          {comDesconto && valorMensalCentavos != null ? (
            <div className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3">
              <label htmlFor="pausa-desconto" className="text-[14px] font-bold text-ink-2">
                Desconto na próxima mensalidade
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">R$</span>
                <input
                  id="pausa-desconto"
                  inputMode="decimal"
                  value={descontoTexto ?? centavosParaCampo(estimativa)}
                  onChange={(e) => setDescontoTexto(e.target.value)}
                  className={`${ESTILO_CAIXA} pl-10 tabular-nums`}
                />
              </div>
              <p className="text-[13px] text-ink-3">
                <strong>Sugestão do Kout: {centavosParaReais(estimativa)}</strong>. É proporcional aos dias parados:{" "}
                {centavosParaReais(valorMensalCentavos)} por mês ÷ 30 × {diasDesconto} dia{diasDesconto === 1 ? "" : "s"}.
                {diasDesconto < dias &&
                  (diasDesconto === 0
                    ? ` ${primeiro} já usou os ${limite} dias com desconto deste ano.`
                    : ` Só ${diasDesconto} dos ${dias} dias entram: o limite é de ${limite} dias com desconto por ano e ${primeiro} já usou ${diasUsados}.`)}{" "}
                Assim o aluno paga só pelas aulas que teve e o limite protege a sua renda. Você pode trocar o valor.
              </p>
              {descontoTexto != null && (
                <button type="button" onClick={() => setDescontoTexto(null)} className="self-start text-[13px] font-semibold text-brand">
                  Usar a sugestão
                </button>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">
              {dias > 0 && `${dias} dia${dias === 1 ? "" : "s"}. `}
              {comDesconto ? "A matrícula não tem valor, então não há desconto." : `${primeiro} paga a mensalidade normal.`}
            </p>
          )}
          <Campo id="pausa-motivo" rotulo="Motivo" opcional>
            <input
              id="pausa-motivo"
              maxLength={120}
              placeholder="Viagem, doença…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
            {ocupado ? "Registrando…" : "Registrar pausa"}
          </button>
          <button type="button" onClick={() => setAbrindo(false)} className="text-[14px] font-semibold text-ink-3">
            Cancelar
          </button>
        </form>
      )}
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto ?? null}</Aviso>
    </section>
  );
}

function LinhaDaPausa({ pausa: p }: { pausa: Pausa }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-dashed border-info bg-info-soft/50 px-3 py-2.5 text-[14px]">
      <p>
        <strong>
          {dataBr(p.inicio)} a {dataBr(p.fim)}
        </strong>
        {p.motivo && ` · ${p.motivo}`}
      </p>
      <p className="text-[13px] text-ink-2">
        {p.descontoCentavos > 0
          ? `Desconto de ${centavosParaReais(p.descontoCentavos)} ${p.descontoAplicado ? "na mensalidade" : "na próxima mensalidade"}`
          : "Sem desconto"}
      </p>
      {confirmando ? (
        <span className="flex gap-4 text-[14px] font-bold">
          <button type="button" onClick={() => setConfirmando(false)} className="text-ink-3">
            Manter
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                try {
                  const r = await cancelarPausa(p.id);
                  if (!r.ok) return setErro(r.erro);
                  router.refresh();
                } catch {
                  setErro("Não foi possível cancelar agora. Confira sua internet.");
                }
              })
            }
            className="text-bad"
          >
            {ocupado ? "Cancelando…" : "Cancelar pausa"}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="self-start text-[13px] font-semibold text-ink-3">
          Cancelar pausa (as aulas voltam)
        </button>
      )}
      <Aviso>{erro}</Aviso>
    </div>
  );
}
