"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarEstudio } from "@/data/estudio";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Cria o estúdio; quem cria fica na coordenação. */
export function CriarEstudio() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await criarEstudio(nome);
          if (!r.ok) return setErro(r.erro);
          router.replace(`/estudio/${r.id}?aba=turmas`);
        });
      }}
      className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5"
    >
      <p className="text-ink-2">
        Cadastre o estúdio ou a academia. Depois você cria as turmas, convida os professores e cola a lista de alunos. Cada professor
        continua com a agenda particular dele: o estúdio só vê as próprias turmas.
      </p>
      <Campo id="est-nome" rotulo="Nome do estúdio">
        <input
          id="est-nome"
          value={nome}
          maxLength={80}
          onChange={(e) => {
            setErro(null);
            setNome(e.target.value);
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Aviso>{erro}</Aviso>
      <button type="submit" disabled={ocupado || nome.trim().length < 2} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Criando…" : "Criar estúdio"}
      </button>
    </form>
  );
}
