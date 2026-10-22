"use client";

import { useState, useTransition } from "react";
import { convidarAlunoSemConta } from "@/data/convites";
import { linkDoConvite, prazoDoConvite } from "@/lib/convite";
import { Aviso, ESTILO_BOTAO_SECUNDARIO } from "../Formulario";
import { BotoesDoLink } from "./Alunos";

/**
 * Aluno sem conta: link para ele criar a conta dele. Quando aceitar, matrícula, aulas,
 * cobranças e histórico passam para a conta (etapa 5b).
 */
export function ConvidarParaConta({
  vinculoId,
  nome,
  whatsapp,
  origem,
  codigo,
  expiraEm,
}: {
  vinculoId: string;
  nome: string;
  /** WhatsApp do próprio aluno (o convite é para ele). */
  whatsapp: string | null;
  origem: string;
  /** Convite ainda válido, se houver. */
  codigo: string | null;
  expiraEm: string | null;
}) {
  const [convite, setConvite] = useState(codigo ? { codigo, expiraEm } : null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (convite)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-3">
          Convite para ter conta{convite.expiraEm ? ` (${prazoDoConvite(convite.expiraEm)})` : ""}. Quando{" "}
          {nome.split(" ")[0]} aceitar, tudo passa para a conta dele.
        </p>
        <BotoesDoLink nome={nome} whatsapp={whatsapp ?? ""} link={linkDoConvite(origem, convite.codigo)} />
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            try {
              const r = await convidarAlunoSemConta(vinculoId);
              if (!r.ok) return setErro(r.erro);
              setConvite({ codigo: r.codigo, expiraEm: new Date(Date.now() + 14 * 86_400_000).toISOString() });
            } catch {
              setErro("Não foi possível criar o convite agora. Confira sua internet.");
            }
          })
        }
        className={ESTILO_BOTAO_SECUNDARIO + " min-h-11 text-[14px]"}
      >
        {ocupado ? "Criando…" : "Convidar para ter conta no Pienel"}
      </button>
      <Aviso>{erro}</Aviso>
    </div>
  );
}
