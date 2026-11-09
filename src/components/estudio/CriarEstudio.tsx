"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarEstudio } from "@/data/estudio";
import { FUNCIONAMENTO_PADRAO, problemasDoFuncionamento, type Funcionamento } from "@/lib/funcionamento";
import { Chip } from "../Chip";
import { HorarioDeFuncionamento } from "./HorarioDeFuncionamento";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Cria o estúdio; quem cria fica na coordenação. */
export function CriarEstudio({ inicial }: { inicial?: { nome: string; tipo: "estudio" | "academia"; funcionamento?: Funcionamento } | null }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [tipo, setTipo] = useState<"estudio" | "academia">(inicial?.tipo ?? "estudio");
  const [funcionamento, setFuncionamento] = useState<Funcionamento>(inicial?.funcionamento ?? FUNCIONAMENTO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const problema = problemasDoFuncionamento(funcionamento)[0];
          if (problema) return setErro(problema[0].toUpperCase() + problema.slice(1) + ".");
          const r = await criarEstudio(nome, tipo, funcionamento);
          if (!r.ok) return setErro(r.erro);
          // Primeiro, como os professores recebem (e, no estúdio, as mensalidades).
          router.replace(`/estudio/${r.id}?aba=ajustes`);
        });
      }}
      className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5"
    >
      <p className="text-ink-2">
        Cadastre o estúdio ou a academia. Depois você cria as turmas, convida os professores e cola a lista de alunos. Cada professor
        continua com a agenda particular dele: o estúdio só vê as próprias turmas.
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[14px] font-bold text-ink-2">É um</legend>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={tipo === "estudio"} onClick={() => setTipo("estudio")}>
            Estúdio
          </Chip>
          <Chip ativo={tipo === "academia"} onClick={() => setTipo("academia")}>
            Academia de rede
          </Chip>
        </div>
      </fieldset>
      <Campo id="est-nome" rotulo={tipo === "academia" ? "Nome da academia" : "Nome do estúdio"}>
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
      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold text-ink-2">Dias e horários de funcionamento</span>
        <HorarioDeFuncionamento valor={funcionamento} mudar={setFuncionamento} />
      </div>
      <Aviso>{erro}</Aviso>
      <button type="submit" disabled={ocupado || nome.trim().length < 2} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Criando…" : "Criar estúdio"}
      </button>
    </form>
  );
}
