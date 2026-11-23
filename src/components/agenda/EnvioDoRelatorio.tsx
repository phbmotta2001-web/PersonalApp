"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icone } from "@/components/Icone";
import { ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { enviarRelatorioDoMes } from "@/data/treino";
import { linkWhatsapp } from "@/lib/convite";

// Decisão 117: o personal escolhe enviar o relatório no app (o aluno vê um botão no Início) e/ou pelo WhatsApp.
export function EnvioDoRelatorio({
  vinculoId,
  mes,
  enviadoEm,
  semConta,
  whatsapp,
  texto,
}: {
  vinculoId: string;
  mes: string;
  enviadoEm: string | null;
  semConta: boolean;
  whatsapp: string | null;
  /** Mensagem do WhatsApp: [sem o app, com o app]. */
  texto: [string, string];
}) {
  const router = useRouter();
  const [pendente, enviar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const noApp = !!enviadoEm;

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Enviar o relatório">
      <h2 className="text-[16px] font-bold">Enviar ao aluno</h2>
      {semConta ? (
        <p className="text-[14px] text-ink-3">Este aluno não tem o app: dá para mandar o resumo pelo WhatsApp.</p>
      ) : noApp ? (
        <p className="flex items-center gap-2 text-[14.5px] font-semibold text-ok">
          <Icone nome="certo" className="size-4" /> Enviado no app. O aluno vê o botão “Relatório do mês” no Início.
        </p>
      ) : (
        <button
          type="button"
          disabled={pendente}
          className={ESTILO_BOTAO_PRINCIPAL}
          onClick={() =>
            enviar(async () => {
              const r = await enviarRelatorioDoMes(vinculoId, mes);
              if (!r.ok) return setErro(r.erro);
              setErro(null);
              router.refresh();
            })
          }
        >
          {pendente ? "Enviando…" : "Enviar no app"}
        </button>
      )}
      {whatsapp ? (
        <a href={linkWhatsapp(whatsapp, texto[noApp ? 1 : 0])} target="_blank" rel="noopener noreferrer" className={`${ESTILO_BOTAO_SECUNDARIO} gap-2`}>
          <Icone nome="conversa" className="size-4" /> Mandar o resumo por WhatsApp
        </a>
      ) : (
        <p className="text-[13.5px] text-ink-3">Sem WhatsApp na ficha do aluno.</p>
      )}
      {erro && <p className="text-[14px] font-semibold text-bad">{erro}</p>}
    </section>
  );
}
