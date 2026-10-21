"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarAlunoSemConta } from "@/data/convites";
import { ehMenor, problemasDoAlunoSemConta, type DadosAlunoSemConta } from "@/lib/convite";
import { frase } from "@/lib/formato";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Cadastrar ou alterar um aluno que não usa o app (etapa 5b). */
export function FormAlunoSemConta({
  vinculoId,
  atual,
  hoje,
}: {
  /** Nulo para cadastrar um aluno novo. */
  vinculoId: string | null;
  atual: DadosAlunoSemConta | null;
  /** "AAAA-MM-DD" em Brasília */
  hoje: string;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosAlunoSemConta>(
    atual ?? {
      nome: "",
      dataNascimento: "",
      whatsapp: "",
      responsavelNome: "",
      responsavelWhatsapp: "",
      responsavelAutorizou: false,
      observacoes: "",
    },
  );
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const menor = ehMenor(dados.dataNascimento, hoje);
  const problemas = problemasDoAlunoSemConta(dados, hoje);
  const mudar = (parte: Partial<DadosAlunoSemConta>) => {
    setErro(null);
    setDados((d) => ({ ...d, ...parte }));
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTentou(true);
        if (problemas.length > 0) return;
        iniciar(async () => {
          try {
            const r = await salvarAlunoSemConta(vinculoId, dados);
            if (!r.ok) return setErro(r.erro);
            router.replace(`/agenda/alunos/${r.id}`);
            router.refresh();
          } catch {
            setErro("Não foi possível salvar agora. Confira sua internet.");
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      {!vinculoId && (
        <p className="text-[13px] text-ink-2">
          Para quem não vai usar o app. Você cuida da agenda e das cobranças dele, e pode convidá-lo para ter
          conta depois sem perder nada.
        </p>
      )}
      <Campo id="sc-nome" rotulo="Nome do aluno">
        <input
          id="sc-nome"
          maxLength={80}
          value={dados.nome}
          onChange={(e) => mudar({ nome: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Campo id="sc-nasc" rotulo="Data de nascimento">
        <input
          id="sc-nasc"
          type="date"
          max={hoje}
          value={dados.dataNascimento}
          onChange={(e) => mudar({ dataNascimento: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Campo id="sc-whats" rotulo="WhatsApp do aluno" opcional>
        <input
          id="sc-whats"
          type="tel"
          inputMode="tel"
          placeholder="(21) 99999-0000"
          value={dados.whatsapp}
          onChange={(e) => mudar({ whatsapp: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      {menor && (
        <fieldset className="flex flex-col gap-3 rounded-[18px] border border-gold bg-gold-soft p-3.5">
          <legend className="px-1 text-[13px] font-bold text-gold">Menor de idade: responsável</legend>
          <p className="text-xs text-ink-2">As cobranças e os avisos pelo WhatsApp vão para o responsável.</p>
          <Campo id="sc-resp" rotulo="Nome do responsável">
            <input
              id="sc-resp"
              maxLength={80}
              value={dados.responsavelNome}
              onChange={(e) => mudar({ responsavelNome: e.target.value })}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <Campo id="sc-resp-whats" rotulo="WhatsApp do responsável">
            <input
              id="sc-resp-whats"
              type="tel"
              inputMode="tel"
              placeholder="(21) 99999-0000"
              value={dados.responsavelWhatsapp}
              onChange={(e) => mudar({ responsavelWhatsapp: e.target.value })}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <label className="flex items-start gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={dados.responsavelAutorizou}
              onChange={(e) => mudar({ responsavelAutorizou: e.target.checked })}
              className="mt-0.5 size-5 shrink-0 accent-brand"
            />
            <span>O responsável autorizou o cadastro dos dados deste aluno no Pienel.</span>
          </label>
        </fieldset>
      )}

      <Campo id="sc-obs" rotulo="Observações" opcional ajuda="Restrições, lesões, objetivo… Só você vê.">
        <textarea
          id="sc-obs"
          rows={3}
          maxLength={1000}
          value={dados.observacoes}
          onChange={(e) => mudar({ observacoes: e.target.value })}
          className={`${ESTILO_CAIXA} py-2.5`}
        />
      </Campo>

      <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
      <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Salvando…" : vinculoId ? "Salvar" : "Cadastrar aluno"}
      </button>
    </form>
  );
}
