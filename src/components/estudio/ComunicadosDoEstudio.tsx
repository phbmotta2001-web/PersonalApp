"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarComunicado, type ComunicadoEnviado, type DestinatarioDoComunicado } from "@/data/comunicados";
import { linkWhatsapp } from "@/lib/convite";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/**
 * Decisão 102: a coordenação escreve um recado para todos ou alguns alunos. Aparece no Início do
 * aluno (sem notificação no celular) e vai pelo WhatsApp.
 */
export function ComunicadosDoEstudio({
  estudioId,
  estudio,
  alunos,
  enviados,
}: {
  estudioId: string;
  estudio: string;
  /** Alunos ativos, em ordem alfabética. */
  alunos: { id: string; nome: string }[];
  enviados: ComunicadoEnviado[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [todos, setTodos] = useState(true);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [para, setPara] = useState<{ texto: string; lista: DestinatarioDoComunicado[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const fechar = () => {
    setAberto(false);
    setPara(null);
    setTexto("");
    setTodos(true);
    setEscolhidos(new Set());
    setErro(null);
  };
  const mensagem = (nome: string, t: string) => `Olá, ${nome.split(" ")[0]}! Recado do ${estudio}:\n\n${t}`;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Comunicados">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-bold">Comunicados</h2>
        {!aberto && (
          <button type="button" onClick={() => setAberto(true)} className="text-[14.5px] font-bold text-brand">
            + Enviar comunicado
          </button>
        )}
      </div>

      {aberto &&
        (para ? (
          <div className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3 text-[14px]">
            <p className="font-semibold">
              Enviado para {para.lista.length} aluno{para.lista.length === 1 ? "" : "s"}. Quem tem o app vê no Início. Mande também pelo WhatsApp:
            </p>
            <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto">
              {para.lista.map((d) => (
                <li key={d.alunoId} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                  {d.whatsapp ? (
                    <a href={linkWhatsapp(d.whatsapp, mensagem(d.nome, para.texto))} target="_blank" rel="noreferrer" className="font-bold text-brand">
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-[13px] text-ink-3">Sem WhatsApp</span>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" onClick={fechar} className="self-start font-bold text-ink-3">
              Fechar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <textarea
              aria-label="Comunicado"
              placeholder="Ex.: Sábado teremos aula especial às 9h. Venham!"
              maxLength={600}
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={ESTILO_CAIXA + " min-h-28 py-3"}
            />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Para quem</legend>
              <div className="flex flex-wrap gap-2">
                <Chip ativo={todos} onClick={() => setTodos(true)}>
                  Todos os alunos
                </Chip>
                <Chip ativo={!todos} onClick={() => setTodos(false)}>
                  Escolher alunos
                </Chip>
              </div>
            </fieldset>
            {!todos && (
              <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-[12px] border border-line bg-surface px-3">
                {alunos.map((a) => (
                  <li key={a.id}>
                    <label className="flex min-h-11 items-center gap-3 text-[15px]">
                      <input
                        type="checkbox"
                        checked={escolhidos.has(a.id)}
                        onChange={() => {
                          const n = new Set(escolhidos);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          setEscolhidos(n);
                        }}
                        className="size-5 shrink-0 accent-[var(--brand)]"
                      />
                      {a.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Aviso>{erro}</Aviso>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    setErro(null);
                    if (texto.trim().length < 2) return setErro("Escreva o comunicado.");
                    if (!todos && escolhidos.size === 0) return setErro("Escolha pelo menos um aluno.");
                    const r = await enviarComunicado(estudioId, texto, todos ? null : [...escolhidos]);
                    if (!r.ok) return setErro(r.erro);
                    setPara({ texto: texto.trim(), lista: r.para });
                    router.refresh();
                  })
                }
                className={ESTILO_BOTAO_PRINCIPAL + " flex-1 sm:flex-none"}
              >
                {ocupado ? "Enviando…" : todos ? "Enviar para todos" : `Enviar para ${escolhidos.size} aluno${escolhidos.size === 1 ? "" : "s"}`}
              </button>
              <button type="button" onClick={fechar} className="font-bold text-ink-3">
                Cancelar
              </button>
            </div>
          </div>
        ))}

      {enviados.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line">
          {enviados.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 py-2">
              <span className="line-clamp-2 text-[14.5px]">{c.texto}</span>
              <span className="text-[13px] text-ink-3">
                {dataCurta(emBrasilia(c.criadoEm).data)} · lido por {c.lidos} de {c.enviados} no app
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !aberto && <p className="text-[14px] text-ink-3">Recados para os alunos: aparecem no Início do app e vão pelo WhatsApp.</p>
      )}
    </section>
  );
}
