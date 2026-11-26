"use client";

import { useState, useTransition } from "react";
import { convidarAlunoSemConta } from "@/data/convites";
import { gerarConviteDoAluno } from "@/data/aluno-estudio";
import { linkDoConvite, linkWhatsapp, mensagemDoConvite } from "@/lib/convite";

/** Mensagem do convite do estúdio: para quem já usa o app, só entrar na turma. */
export function mensagemDoConviteDoEstudio(nome: string, estudio: string, link: string, jaUsa: boolean): string {
  const primeiro = nome.trim().split(" ")[0];
  return jaUsa
    ? `Olá, ${primeiro}! Você já usa o P-Bell: toque no link para entrar na sua turma do ${estudio} e ver a agenda, avisar faltas e marcar reposições: ${link}`
    : `Olá, ${primeiro}! O ${estudio} agora usa o P-Bell: veja a agenda com as vagas, avise suas faltas e marque reposições. Entre por este link: ${link}`;
}

const ESTILO = "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap";

/**
 * Decisão 122: "Convidar para o P-Bell" ao lado do nome de quem não usa o app. Com o link pronto,
 * um toque abre o WhatsApp com o convite. Sem link, o toque cria o link e o botão vira
 * "Enviar no WhatsApp" (o iPhone só abre o WhatsApp direto de um toque).
 */
function BotaoDoConvite({
  rotulo = "Convidar para o P-Bell",
  whatsapp,
  link: linkInicial,
  mensagem,
  gerar,
}: {
  rotulo?: string;
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
        {linkInicial ? rotulo : "Enviar no WhatsApp ›"}
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
      {ocupado ? "Criando…" : erro ? "Tentar de novo" : rotulo}
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

/** Aluno do estúdio sem app (coordenação e professores). Quem já usa o P-Bell recebe "Convidar para a turma" (decisão 123). */
export function ConvidarParaOPBellNoEstudio({
  alunoId,
  nome,
  whatsapp,
  estudio,
  jaUsa = false,
}: {
  alunoId: string;
  nome: string;
  whatsapp: string | null;
  estudio: string;
  jaUsa?: boolean;
}) {
  return (
    <BotaoDoConvite
      rotulo={jaUsa ? "Convidar para a turma" : "Convidar para o P-Bell"}
      whatsapp={whatsapp}
      link={null}
      mensagem={(l) => mensagemDoConviteDoEstudio(nome, estudio, l, jaUsa)}
      gerar={() => gerarConviteDoAluno(alunoId)}
    />
  );
}
