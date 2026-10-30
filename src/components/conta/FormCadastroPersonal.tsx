"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cadastrarPersonal } from "@/data/conta";
import { TEXTO_TERMO_CONFIDENCIALIDADE } from "@/lib/consentimento";
import { frase } from "@/lib/formato";
import { problemasDoCadastroPersonal, UFS, type DadosCadastroPersonal } from "@/lib/personal";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const VAZIO: DadosCadastroPersonal = {
  email: "",
  senha: "",
  nomeCompleto: "",
  whatsapp: "",
  cref: "",
  crefUf: "",
  aceitouTermo: false,
};

/** Cadastro do personal (Fase 1). Alunos não se cadastram aqui: entram pelo convite do personal. */
export function FormCadastroPersonal() {
  const [dados, setDados] = useState(VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const problemas = problemasDoCadastroPersonal(dados);
  const mudar = (parte: Partial<DadosCadastroPersonal>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (problemas.length > 0) return;
    iniciarEnvio(async () => {
      try {
        const r = await cadastrarPersonal(dados);
        if (r.ok) setEnviadoPara(dados.email.trim());
        else setErro(r.erro);
      } catch {
        setErro("Não foi possível criar a conta agora. Confira sua internet e tente de novo.");
      }
    });
  }

  if (enviadoPara) {
    return (
      <div className="flex flex-col gap-4 px-[18px] pt-4 pb-6">
        <h2 className="text-[22px] font-extrabold">Confira seu e-mail</h2>
        <p className="text-ink-2">
          Enviamos um link de confirmação para <b>{enviadoPara}</b>. Clique nele para ativar sua conta.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-3">
          <li>Abra o link <b>neste mesmo navegador</b>.</li>
          <li>Não chegou? Procure no spam. A mensagem pode levar alguns minutos.</li>
        </ul>
        <Link href="/entrar" className="font-semibold text-brand">
          Ir para Entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <p className="text-[14px] text-ink-3">
        É aluno? Você entra pelo link de convite que o seu personal envia.
      </p>

      <Campo id="pf-email" rotulo="E-mail">
        <input
          id="pf-email"
          type="email"
          autoComplete="email"
          value={dados.email}
          onChange={(e) => mudar({ email: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pf-senha" rotulo="Senha" ajuda="Pelo menos 8 caracteres.">
        <input
          id="pf-senha"
          type="password"
          autoComplete="new-password"
          value={dados.senha}
          onChange={(e) => mudar({ senha: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pf-nome" rotulo="Nome completo" ajuda="Como no seu registro do CREF.">
        <input
          id="pf-nome"
          autoComplete="name"
          maxLength={120}
          value={dados.nomeCompleto}
          onChange={(e) => mudar({ nomeCompleto: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pf-whatsapp" rotulo="WhatsApp" ajuda="Com DDD. Usado para os avisos do Kout.">
        <input
          id="pf-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(21) 99999-0000"
          value={dados.whatsapp}
          onChange={(e) => mudar({ whatsapp: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <Campo id="pf-cref" rotulo="CREF">
          <input
            id="pf-cref"
            placeholder="012345-G"
            maxLength={10}
            value={dados.cref}
            onChange={(e) => mudar({ cref: e.target.value })}
            className={ESTILO_CAIXA}
          />
        </Campo>
        <Campo id="pf-uf" rotulo="Estado">
          <select
            id="pf-uf"
            value={dados.crefUf}
            onChange={(e) => mudar({ crefUf: e.target.value })}
            className={ESTILO_CAIXA}
          >
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Campo>
      </div>

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

      <button type="submit" disabled={enviando} className={ESTILO_BOTAO_PRINCIPAL}>
        {enviando ? "Criando conta…" : "Criar minha conta de personal"}
      </button>

      <p className="text-center text-[14px] text-ink-3">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-brand">
          Entrar
        </Link>
      </p>
    </form>
  );
}
