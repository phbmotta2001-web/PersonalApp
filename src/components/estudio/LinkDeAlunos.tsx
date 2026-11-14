"use client";

import { useState, useTransition } from "react";
import { linkDeAlunos } from "@/data/aluno-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { Aviso, ESTILO_BOTAO_SECUNDARIO } from "../Formulario";

/**
 * Decisão 95: um link do estúdio para novos alunos se cadastrarem sozinhos. Quem entra
 * aparece na lista de alunos e a coordenação é avisada para escolher as turmas.
 */
export function LinkDeAlunos({ estudioId, estudio }: { estudioId: string; estudio: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const gerar = (novo: boolean) =>
    iniciar(async () => {
      setErro(null);
      setCopiado(false);
      const r = await linkDeAlunos(estudioId, novo);
      if (!r.ok) return setErro(r.erro);
      setLink(r.link);
    });
  const mensagem = (l: string) =>
    `Olá! O ${estudio} usa o P-Bell: veja a agenda com as vagas, avise suas faltas e marque reposições. Cadastre-se por este link: ${l}`;

  if (!link)
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" disabled={ocupado} onClick={() => gerar(false)} className={ESTILO_BOTAO_SECUNDARIO + " sm:w-auto"}>
          {ocupado ? "Gerando…" : "Gerar link de aluno"}
        </button>
        <Aviso>{erro}</Aviso>
      </div>
    );

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface-2 p-3 text-[14px]">
      <p className="text-ink-2">
        Link de cadastro do estúdio: quem entrar por ele vira aluno e você é avisado para escolher as turmas.
      </p>
      <p className="truncate font-mono text-[13px]">{link}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 font-bold">
        <a href={linkWhatsapp(null, mensagem(link))} target="_blank" rel="noreferrer" className="text-brand">
          Enviar no WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
          className="text-brand"
        >
          {copiado ? "Copiado" : "Copiar link"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => {
            if (confirm("Gerar outro link? O link atual para de funcionar.")) gerar(true);
          }}
          className="text-ink-3"
        >
          Gerar outro link
        </button>
      </div>
      <Aviso>{erro}</Aviso>
    </div>
  );
}
