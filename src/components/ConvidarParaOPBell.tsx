"use client";

import { useState, useTransition } from "react";
import { convidarAlunoSemConta } from "@/data/convites";
import { gerarConviteDoAluno } from "@/data/aluno-estudio";
import { linkDoConvite, linkWhatsapp, mensagemDoConvite } from "@/lib/convite";

const ESTILO = "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap";

/**
 * Decisão 122: "Convidar para o P-Bell" ao lado do nome de quem não usa o app. Com o link pronto,
 * um toque abre o WhatsApp com o convite. Sem link, o toque cria o link e o botão vira
 * "Enviar no WhatsApp" (o iPhone só abre o WhatsApp direto de um toque).
 */
function BotaoDoConvite({
  whatsapp,
  link: linkInicial,
  mensagem,
  gerar,
}: {
  whatsapp: string | null;
  link: string | null;
  mensagem: (link: string) => string;
  gerar: () => Promise<{ ok: true; link: string } | { ok: false; erro: string }>;
}) {
  const [link, setLink] = useState(linkInicial);
  const [erro, setErro] = useState(false);
  const [ocupado, iniciar] = useTransition();

  if (link)
    return (
      <a
        href={linkWhatsapp(whatsapp, mensagem(link))}
        target="_blank"
        rel="noreferrer"
        className={`${ESTILO} bg-brand text-brand-ink ${linkInicial ? "" : "relatorio-brilho"}`}
      >
        {linkInicial ? "Convidar para o P-Bell" : "Enviar no WhatsApp ›"}
      </a>
    );

  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() =>
        iniciar(async () => {
          setErro(false);
          try {
            const r = await gerar();
            if (r.ok) setLink(r.link);
            else setErro(true);
          } catch {
            setErro(true);
          }
        })
      }
      className={`${ESTILO} border border-brand bg-surface ${erro ? "text-bad" : "text-brand"}`}
    >
      {ocupado ? "Criando…" : erro ? "Tentar de novo" : "Convidar para o P-Bell"}
    </button>
  );
}

/** Aluno particular do personal, sem app. */
export function ConvidarParaOPBell({
  vinculoId,
  nome,
  whatsapp,
  origem,
  codigo,
}: {
  vinculoId: string;
  nome: string;
  whatsapp: string | null;
  origem: string;
  codigo: string | null;
}) {
  return (
    <BotaoDoConvite
      whatsapp={whatsapp}
      link={codigo ? linkDoConvite(origem, codigo) : null}
      mensagem={(l) => mensagemDoConvite(nome, l)}
      gerar={async () => {
        const r = await convidarAlunoSemConta(vinculoId);
        return r.ok ? { ok: true, link: linkDoConvite(origem, r.codigo) } : r;
      }}
    />
  );
}

/** Aluno do estúdio sem app (coordenação e professores). */
export function ConvidarParaOPBellNoEstudio({
  alunoId,
  nome,
  whatsapp,
  estudio,
}: {
  alunoId: string;
  nome: string;
  whatsapp: string | null;
  estudio: string;
}) {
  return (
    <BotaoDoConvite
      whatsapp={whatsapp}
      link={null}
      mensagem={(l) =>
        `Olá, ${nome.trim().split(" ")[0]}! O ${estudio} agora usa o P-Bell: veja a agenda com as vagas, avise suas faltas e marque reposições. Entre por este link: ${l}`
      }
      gerar={() => gerarConviteDoAluno(alunoId)}
    />
  );
}
