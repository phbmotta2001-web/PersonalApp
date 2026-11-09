"use client";

import { useState, useTransition } from "react";
import { gerarConviteDoAluno } from "@/data/aluno-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { Aviso } from "../Formulario";

/** Link para o aluno do estúdio entrar no app (ver a agenda, avisar falta, repor). */
export function ConviteDoAlunoEstudio({ alunoId, nome, whatsapp, estudio }: { alunoId: string; nome: string; whatsapp: string | null; estudio: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const mensagem = (l: string) =>
    `Olá, ${nome.split(" ")[0]}! O ${estudio} agora usa o P-Bell: veja a agenda com as vagas, avise suas faltas e marque reposições. Entre por este link: ${l}`;

  if (!link)
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await gerarConviteDoAluno(alunoId);
              if (!r.ok) return setErro(r.erro);
              setLink(r.link);
            })
          }
          className="self-start text-[14px] font-bold text-brand"
        >
          {ocupado ? "Gerando…" : "Gerar link do app para o aluno"}
        </button>
        <Aviso>{erro}</Aviso>
      </div>
    );

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 text-[14px]">
      <p className="text-ink-3">Link do app (vale 14 dias, só para {nome.split(" ")[0]}):</p>
      <p className="truncate font-mono text-[13px]">{link}</p>
      <div className="flex flex-wrap gap-3 font-bold">
        <a href={linkWhatsapp(whatsapp, mensagem(link))} target="_blank" rel="noreferrer" className="text-brand">
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
      </div>
    </div>
  );
}
