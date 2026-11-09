"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cadastrarProfessorDoEstudio } from "@/data/conta";
import { TEXTO_TERMO_CONFIDENCIALIDADE } from "@/lib/consentimento";
import { frase } from "@/lib/formato";
import { problemasDoCadastroPersonal, type DadosCadastroPersonal } from "@/lib/personal";
import { AceiteDosTermos } from "../conta/AceiteDosTermos";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const VAZIO: DadosCadastroPersonal = { email: "", senha: "", nomeCompleto: "", whatsapp: "", cref: "", crefUf: "", aceitouTermo: false };

/** Cadastro curto de quem foi convidado pelo estúdio: cria a conta e já entra na equipe. */
export function FormCadastroProfessor({ codigo, termos = false }: { codigo: string; termos?: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState(VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const problemas = problemasDoCadastroPersonal(dados);
  const mudar = (parte: Partial<DadosCadastroPersonal>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };

  if (enviadoPara)
    return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
        <p className="font-bold">Confira seu e-mail</p>
        <p className="text-[14px] text-ink-2">
          Enviamos um link de confirmação para <b>{enviadoPara}</b>. Abra o link <b>neste mesmo navegador</b> e toque em Entrar na equipe.
        </p>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTentou(true);
        if (problemas.length > 0) return;
        iniciar(async () => {
          try {
            const r = await cadastrarProfessorDoEstudio(dados, codigo);
            if (!r.ok) return setErro(r.erro);
            if (!r.logado) return setEnviadoPara(dados.email.trim());
            router.replace(r.estudio ? `/agenda/estudio/${r.estudio}` : "/agenda");
            router.refresh();
          } catch {
            setErro("Não foi possível criar a conta agora. Confira sua internet e tente de novo.");
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <Campo id="pr-nome" rotulo="Seu nome completo">
        <input id="pr-nome" autoComplete="name" maxLength={120} value={dados.nomeCompleto} onChange={(e) => mudar({ nomeCompleto: e.target.value })} className={ESTILO_CAIXA} />
      </Campo>
      <Campo id="pr-whatsapp" rotulo="WhatsApp" ajuda="Com DDD.">
        <input
          id="pr-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(21) 99999-0000"
          value={dados.whatsapp}
          onChange={(e) => mudar({ whatsapp: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Campo id="pr-email" rotulo="E-mail">
        <input id="pr-email" type="email" autoComplete="email" value={dados.email} onChange={(e) => mudar({ email: e.target.value })} className={ESTILO_CAIXA} />
      </Campo>
      <Campo id="pr-senha" rotulo="Senha" ajuda="Pelo menos 8 caracteres.">
        <input id="pr-senha" type="password" autoComplete="new-password" value={dados.senha} onChange={(e) => mudar({ senha: e.target.value })} className={ESTILO_CAIXA} />
      </Campo>
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <input
          type="checkbox"
          checked={dados.aceitouTermo}
          onChange={(e) => mudar({ aceitouTermo: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span className="text-[14px] text-ink-2">
          <b className="block text-ink">Termo de confidencialidade</b>
          {TEXTO_TERMO_CONFIDENCIALIDADE}
        </span>
      </label>
      <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
      {termos && <AceiteDosTermos />}
      <button type="submit" disabled={enviando} className={ESTILO_BOTAO_PRINCIPAL}>
        {enviando ? "Criando conta…" : "Criar conta e entrar na equipe"}
      </button>
      <p className="text-center text-[13px] text-ink-3">
        Também atende alunos por fora? Depois você pode criar seu cadastro de personal, sem custo.
      </p>
    </form>
  );
}
