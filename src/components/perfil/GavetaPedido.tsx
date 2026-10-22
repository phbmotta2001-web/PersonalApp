"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { enviarPedido } from "@/data/pedidos";
import { LOCAIS, type Personal } from "@/data/personais";
import {
  diasLivres,
  faixaDaAula,
  horario,
  lerHorario,
  maximoPorSemana,
  ordenarHorarios,
  type DiaSemana,
  type Horario,
} from "@/lib/agenda";
import {
  AVISO_APAGAR_30_DIAS,
  AVISO_RESTRICOES_NO_PEDIDO,
  TEXTO_CONFIRMACAO_RESTRICOES,
} from "@/lib/consentimento";
import { alternar } from "@/lib/filtros";
import { formatarReais, juntarComE, maiuscula, tratamento } from "@/lib/formato";
import { LIMITE_MENSAGEM, oQueFalta, type Pedido } from "@/lib/pedido";
import { Chip } from "../Chip";
import { ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { Gaveta, GrupoDaGaveta } from "../Gaveta";
import { Icone } from "../Icone";

function pedidoInicial(personal: Personal): Pedido {
  // Começa no plano "mais escolhido", ou no maior que caiba na agenda do personal.
  const maximo = maximoPorSemana(personal.disponibilidade);
  const cabem = personal.perfil.planos.filter((pl) => pl.vezesPorSemana <= maximo);
  const plano = cabem.find((pl) => pl.maisEscolhido) ?? cabem.at(-1) ?? personal.perfil.planos[0];
  return {
    slug: personal.slug,
    vezesPorSemana: plano.vezesPorSemana,
    horarios: [],
    locais: [],
    mensagem: "",
    confirmoRestricoes: false,
  };
}

/** Formulário "Pedido para a Camila", que abre ao clicar em "Tenho interesse". */
export function GavetaPedido({
  personal,
  aberta,
  restricoes,
  declaradasEm,
  aoFechar,
  aoEnviar,
}: {
  personal: Personal;
  aberta: boolean;
  /** Restrições declaradas no perfil (vazio = declarou não ter). */
  restricoes: string;
  declaradasEm: string;
  aoFechar: () => void;
  aoEnviar: () => void;
}) {
  const [pedido, setPedido] = useState(() => pedidoInicial(personal));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [avisoHorario, setAvisoHorario] = useState<string | null>(null);

  const t = tratamento(personal);
  const maximo = maximoPorSemana(personal.disponibilidade);
  const falta = oQueFalta(pedido, personal);
  const mudar = (parte: Partial<Pedido>) => {
    setErro(null);
    setPedido({ ...pedido, ...parte });
  };

  /** Um horário por dia: escolher outro no mesmo dia troca; passar do plano avisa. */
  function escolher(dia: DiaSemana, hora: number) {
    const h = horario(dia, hora);
    const outros = pedido.horarios.filter((x) => lerHorario(x)?.dia !== dia);
    setAvisoHorario(null);
    if (pedido.horarios.includes(h)) return mudar({ horarios: outros });
    if (outros.length < pedido.horarios.length) return mudar({ horarios: ordenarHorarios([...outros, h]) as Horario[] });
    if (pedido.horarios.length >= pedido.vezesPorSemana)
      return setAvisoHorario(`
        Você já escolheu ${pedido.vezesPorSemana} horários. Desmarque um para trocar, ou mude o plano.`
      );
    mudar({ horarios: ordenarHorarios([...pedido.horarios, h]) as Horario[] });
  }

  /** Ao diminuir o plano, ficam só os primeiros horários da semana. */
  function trocarPlano(vezes: number) {
    setAvisoHorario(null);
    mudar({ vezesPorSemana: vezes, horarios: pedido.horarios.slice(0, vezes) });
  }

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
          <button type="button" onClick={enviar} disabled={falta.length > 0 || enviando} className={ESTILO_BOTAO_PRINCIPAL}>
            <Icone nome="enviar" className="size-4" />
            {enviando ? "Enviando…" : `Enviar para ${t.artigo} ${t.nome}`}
          </button>
          <p aria-live="polite" className="text-center text-[13px] text-ink-3">
            {erro ?? (falta.length > 0 && `Para enviar, falta: ${juntarComE(falta)}.`)}
          </p>
        </div>
      }
    >
      <GrupoDaGaveta titulo="Quantas vezes por semana">
        <div className="grid w-full grid-cols-3 gap-1.5 rounded-[14px] bg-surface-2 p-1">
          {personal.perfil.planos.map((pl) => {
            const ativo = pedido.vezesPorSemana === pl.vezesPorSemana;
            const cabe = pl.vezesPorSemana <= maximo;
            return (
              <button
                key={pl.vezesPorSemana}
                type="button"
                aria-pressed={ativo}
                disabled={!cabe}
                onClick={() => trocarPlano(pl.vezesPorSemana)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-[11px] py-1 text-[15px] leading-tight font-bold disabled:opacity-50 ${
                  ativo ? "bg-surface text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {pl.vezesPorSemana}x
                <small className="text-[13px] font-medium text-ink-3">
                  {cabe ? `${formatarReais(pl.precoAula)}/aula` : "sem horários"}
                </small>
              </button>
            );
          })}
        </div>
        {personal.perfil.planos.some((pl) => pl.vezesPorSemana > maximo) && (
          <p className="w-full text-[13px] text-ink-3">
            {maiuscula(t.artigo)} {t.nome} tem horários livres em {maximo} {maximo === 1 ? "dia" : "dias"} da semana.
          </p>
        )}
      </GrupoDaGaveta>

      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] flex w-full justify-between gap-2 text-[14px] font-bold text-ink-2">
          <span>
            Escolha {pedido.vezesPorSemana} {pedido.vezesPorSemana === 1 ? "horário" : "horários"} (um por dia)
          </span>
          <span className="font-normal text-ink-3 tabular-nums">
            {pedido.horarios.length} de {pedido.vezesPorSemana}
          </span>
        </legend>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-3">
          {diasLivres(personal.disponibilidade).map((d) => (
            <li key={d} className="flex items-center gap-3 py-2">
              <span className="w-10 shrink-0 text-[15px] font-bold">{d}</span>
              <span className="flex flex-wrap gap-1.5">
                {(personal.disponibilidade[d] ?? []).map((hora) => {
                  const h = horario(d, hora);
                  return (
                    <Chip key={h} ativo={pedido.horarios.includes(h)} onClick={() => escolher(d, hora)}>
                      {faixaDaAula(hora)}
                    </Chip>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="text-[13px] text-ink-3">
          {avisoHorario ?? "O pedido não reserva o horário: ele só fica seu quando o personal aceitar."}
        </p>
      </fieldset>
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
        <label htmlFor="pedido-mensagem" className="text-[14px] font-bold text-ink-2">
          Conte algo para {t.artigo} {t.nome} <span className="font-normal text-ink-3">(opcional)</span>
        </label>
        <textarea
          id="pedido-mensagem"
          rows={3}
          maxLength={LIMITE_MENSAGEM}
          value={pedido.mensagem}
          onChange={(e) => mudar({ mensagem: e.target.value })}
          aria-describedby="pedido-mensagem-ajuda"
          placeholder="Ex.: Quero voltar a treinar com alguém que me acompanhe de perto."
          className="min-h-[84px] w-full resize-none rounded-[13px] border border-line bg-surface px-3.5 py-3 placeholder:text-ink-3"
        />
        <p id="pedido-mensagem-ajuda" className="flex justify-between gap-3 text-[13px] text-ink-3">
          <span>
            {maiuscula(t.artigo)} {t.nome} lê esta mensagem antes de aceitar.
          </span>
          <span className="shrink-0 tabular-nums">
            {pedido.mensagem.length}/{LIMITE_MENSAGEM}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 text-[14px] text-ink-2">
        <div>
          <p className="font-bold text-ink">Suas restrições e limitações</p>
          <p className="mt-1 whitespace-pre-line">
            {restricoes || "Você declarou não ter restrições ou limitações."}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            Declaração de {new Date(declaradasEm).toLocaleDateString("pt-BR")} ·{" "}
            <Link href="/perfil" className="font-semibold text-brand">
              Atualizar no perfil
            </Link>
          </p>
        </div>
        <p className="text-[13px] text-ink-3">{AVISO_RESTRICOES_NO_PEDIDO}</p>
        <label className="flex items-start gap-3 border-t border-line pt-3">
          <input
            type="checkbox"
            checked={pedido.confirmoRestricoes}
            onChange={(e) => mudar({ confirmoRestricoes: e.target.checked })}
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
          />
          <span className="font-semibold text-ink">{TEXTO_CONFIRMACAO_RESTRICOES}</span>
        </label>
      </div>
      <div className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[14px] text-ink-2">
        <span className="mt-px text-brand">
          <Icone nome="cadeado" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p>
            {maiuscula(t.artigo)} {t.nome} vê seu primeiro nome, objetivo, nível, bairro e restrições. Peso, altura, medidas,
            endereço e exames, só se {t.pronome} aceitar.
          </p>
          <p>{AVISO_APAGAR_30_DIAS}</p>
        </div>
      </div>
    </Gaveta>
  );
}
