"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceitarConviteDoAluno, entrarPeloLinkDeAlunos } from "@/data/aluno-estudio";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";

/** Liga a conta de aluno ao cadastro do estúdio (geral: pelo link de alunos do estúdio, decisão 95). */
export function AceitarConviteDoAluno({ codigo, estudio, geral = false }: { codigo: string; estudio: string; geral?: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-[14px] text-ink-2">
        O estúdio e os professores dele veem seu nome, suas aulas, faltas e reposições e, do seu perfil, seu objetivo, seu nível e suas
        limitações. Os outros alunos nunca veem seu nome.
      </p>
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await (geral ? entrarPeloLinkDeAlunos : aceitarConviteDoAluno)(codigo);
            if (!r.ok) return setErro(r.erro);
            router.replace(`/aluno/estudio/${r.estudio}`);
            router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado ? "Entrando…" : `Entrar no ${estudio}`}
      </button>
    </div>
  );
}
