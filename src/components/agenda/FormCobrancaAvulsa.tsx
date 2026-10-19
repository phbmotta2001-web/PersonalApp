"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarCobrancaAvulsa } from "@/data/cobrancas";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Cobrança fora da mensalidade: avaliação, aula avulsa, pacote… */
export function FormCobrancaAvulsa({ alunos, hoje }: { alunos: { vinculoId: string; nome: string }[]; hoje: string }) {
  const router = useRouter();
  const [vinculoId, setVinculoId] = useState(alunos[0]?.vinculoId ?? "");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (alunos.length === 0)
    return <p className="px-[18px] pt-4 text-sm text-ink-3">Você ainda não tem alunos ativos para cobrar.</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          setErro(null);
          try {
            const r = await criarCobrancaAvulsa(vinculoId, descricao, valor, vencimento);
            if (!r.ok) return setErro(r.erro);
            router.replace("/agenda/cobrancas");
            router.refresh();
          } catch {
            setErro("Não foi possível criar agora. Confira sua internet.");
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      <Campo id="av-aluno" rotulo="Aluno">
        <select id="av-aluno" value={vinculoId} onChange={(e) => setVinculoId(e.target.value)} className={ESTILO_CAIXA}>
          {alunos.map((a) => (
            <option key={a.vinculoId} value={a.vinculoId}>
              {a.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="av-desc" rotulo="O que está sendo cobrado" ajuda="Ex.: avaliação física, aula avulsa, pacote de 4 aulas.">
        <input id="av-desc" value={descricao} maxLength={80} onChange={(e) => setDescricao(e.target.value)} className={ESTILO_CAIXA} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="av-valor" rotulo="Valor">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-3">R$</span>
            <input
              id="av-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`${ESTILO_CAIXA} pl-9 tabular-nums`}
            />
          </div>
        </Campo>
        <Campo id="av-venc" rotulo="Vencimento">
          <input id="av-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={ESTILO_CAIXA} />
        </Campo>
      </div>
      <Aviso>{erro}</Aviso>
      <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Criando…" : "Criar cobrança"}
      </button>
    </form>
  );
}
