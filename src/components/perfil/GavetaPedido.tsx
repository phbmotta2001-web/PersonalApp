"use client";

import { useState, useTransition } from "react";
import { enviarPedido } from "@/data/pedidos";
import { LOCAIS, type Personal } from "@/data/personais";
import { alternar } from "@/lib/filtros";
import { formatarReais, tratamento } from "@/lib/formato";
import { DIAS, juntarComE, LIMITE_MENSAGEM, oQueFalta, PERIODOS, type Pedido } from "@/lib/pedido";
import { Chip } from "../Chip";
import { Gaveta, GrupoDaGaveta } from "../Gaveta";
import { Icone } from "../Icone";

function pedidoInicial(personal: Personal): Pedido {
  const planos = personal.perfil.planos;
  return {
    slug: personal.slug,
    vezesPorSemana: (planos.find((pl) => pl.maisEscolhido) ?? planos[0]).vezesPorSemana,
    dias: [],
    periodos: [],
    locais: [],
    mensagem: "",
  };
}

/** Formulário "Pedido para a Camila", que abre ao clicar em "Tenho interesse". */
export function GavetaPedido({
  personal,
  aberta,
  aoFechar,
  aoEnviar,
}: {
  personal: Personal;
  aberta: boolean;
  aoFechar: () => void;
  aoEnviar: () => void;
}) {
  const [pedido, setPedido] = useState(() => pedidoInicial(personal));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const t = tratamento(personal);
  const falta = oQueFalta(pedido, personal);
  const mudar = (parte: Partial<Pedido>) => {
    setErro(null);
    setPedido({ ...pedido, ...parte });
  };

  function enviar() {
    iniciarEnvio(async () => {
      try {
        const resposta = await enviarPedido(pedido);
        if (resposta.ok) aoEnviar();
        else setErro(resposta.erro);
      } catch {
        setErro("Não foi possível enviar agora. Confira sua internet e tente de novo.");
      }
    });
  }

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={`Pedido para ${t.artigo} ${t.nome}`}
      rodape={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={enviar}
            disabled={falta.length > 0 || enviando}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
          >
            <Icone nome="enviar" className="size-4" />
            {enviando ? "Enviando…" : `Enviar para ${t.artigo} ${t.nome}`}
          </button>
          <p aria-live="polite" className="text-center text-xs text-ink-3">
            {erro ?? (falta.length > 0 && `Para enviar, escolha ${juntarComE(falta)}.`)}
          </p>
        </div>
      }
    >
      <GrupoDaGaveta titulo="Quantas vezes por semana">
        <div className="grid w-full grid-cols-3 gap-1.5 rounded-[14px] bg-surface-2 p-1">
          {personal.perfil.planos.map((pl) => {
            const ativo = pedido.vezesPorSemana === pl.vezesPorSemana;
            return (
              <button
                key={pl.vezesPorSemana}
                type="button"
                aria-pressed={ativo}
                onClick={() => mudar({ vezesPorSemana: pl.vezesPorSemana })}
                className={`flex min-h-11 flex-col items-center justify-center rounded-[11px] py-1 text-sm leading-tight font-bold ${
                  ativo ? "bg-surface text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {pl.vezesPorSemana}x
                <small className="text-[11.5px] font-medium text-ink-3">
                  {formatarReais(pl.precoAula)}/aula
                </small>
              </button>
            );
          })}
        </div>
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Melhores dias e horário">
        {DIAS.map((d) => (
          <Chip key={d} ativo={pedido.dias.includes(d)} onClick={() => mudar({ dias: alternar(pedido.dias, d) })}>
            {d}
          </Chip>
        ))}
        <div className="flex w-full flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <Chip
              key={p}
              ativo={pedido.periodos.includes(p)}
              onClick={() => mudar({ periodos: alternar(pedido.periodos, p) })}
            >
              {p}
            </Chip>
          ))}
        </div>
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Onde">
        {LOCAIS.filter((l) => personal.locais.includes(l.valor)).map((l) => (
          <Chip
            key={l.valor}
            ativo={pedido.locais.includes(l.valor)}
            onClick={() => mudar({ locais: alternar(pedido.locais, l.valor) })}
          >
            {l.rotulo}
          </Chip>
        ))}
      </GrupoDaGaveta>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="pedido-mensagem" className="text-[13px] font-bold text-ink-2">
          Conte algo para {t.artigo} {t.nome} <span className="font-normal text-ink-3">(opcional)</span>
        </label>
        <textarea
          id="pedido-mensagem"
          rows={3}
          maxLength={LIMITE_MENSAGEM}
          value={pedido.mensagem}
          onChange={(e) => mudar({ mensagem: e.target.value })}
          placeholder="Ex.: Quero voltar a treinar com alguém que me acompanhe de perto."
          className="min-h-[84px] w-full resize-none rounded-[13px] border border-line bg-surface px-3.5 py-3 placeholder:text-ink-3"
        />
      </div>

      <p className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
        <span className="mt-px text-brand">
          <Icone nome="cadeado" />
        </span>
        <span>
          Seus objetivos, restrições e nível vão junto com o pedido. Medidas, fotos e exames só
          aparecem para {t.artigo} {t.nome} se {t.pronome} aceitar.
        </span>
      </p>
    </Gaveta>
  );
}
