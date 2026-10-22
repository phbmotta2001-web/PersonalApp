"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarPix } from "@/data/cobrancas";
import { frase } from "@/lib/formato";
import { problemasDoPix, TIPOS_CHAVE_PIX, type DadosPix } from "@/lib/pix";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Chave Pix do personal: vai nas cobranças como Pix copia e cola e QR Code. */
export function FormPix({ inicial, nomeSugerido }: { inicial: DadosPix | null; nomeSugerido: string }) {
  const router = useRouter();
  const [pix, setPix] = useState<DadosPix>(
    inicial ?? { tipo: "cpf", chave: "", nome: nomeSugerido.slice(0, 25), cidade: "" },
  );
  const [tentou, setTentou] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const problemas = problemasDoPix(pix);
  const tipo = TIPOS_CHAVE_PIX.find((t) => t.valor === pix.tipo)!;
  const mudar = (parte: Partial<DadosPix>) => {
    setAviso(null);
    setPix({ ...pix, ...parte });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTentou(true);
        if (problemas.length > 0) return;
        iniciar(async () => {
          try {
            const r = await salvarPix(pix);
            if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
            // Volta para Cobranças já com a chave (sem mostrar a tela antiga guardada).
            router.replace("/agenda/financeiro");
            router.refresh();
          } catch {
            setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      <p className="text-[13px] text-ink-2">
        O aluno paga direto para a sua chave: o dinheiro cai na sua conta, sem passar pelo Pienel. Cada cobrança já vai com
        o Pix copia e cola e o QR Code com o valor certo.
      </p>
      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-[13px] font-bold text-ink-2">Tipo de chave</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_CHAVE_PIX.map((t) => (
            <Chip key={t.valor} ativo={pix.tipo === t.valor} onClick={() => mudar({ tipo: t.valor })}>
              {t.rotulo}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Campo id="pix-chave" rotulo="Chave Pix">
        <input
          id="pix-chave"
          value={pix.chave}
          placeholder={tipo.exemplo}
          inputMode={pix.tipo === "cpf" || pix.tipo === "cnpj" || pix.tipo === "telefone" ? "numeric" : pix.tipo === "email" ? "email" : "text"}
          onChange={(e) => mudar({ chave: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Campo id="pix-nome" rotulo="Nome de quem recebe" ajuda="Como aparece no banco do aluno (até 25 letras).">
        <input id="pix-nome" value={pix.nome} maxLength={25} onChange={(e) => mudar({ nome: e.target.value })} className={ESTILO_CAIXA} />
      </Campo>
      <Campo id="pix-cidade" rotulo="Cidade" ajuda="Até 15 letras.">
        <input id="pix-cidade" value={pix.cidade} maxLength={15} onChange={(e) => mudar({ cidade: e.target.value })} className={ESTILO_CAIXA} />
      </Campo>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
      <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
        {ocupado ? "Salvando…" : "Salvar chave Pix"}
      </button>
    </form>
  );
}
