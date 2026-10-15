"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cadastrar } from "@/data/conta";
import { GENEROS, LIMITES, problemasDoCadastro, type DadosCadastro } from "@/lib/aluno";
import { AVISO_CONSENTIMENTO_OBRIGATORIO_PEDIDO, TEXTO_CONSENTIMENTO_SAUDE } from "@/lib/consentimento";
import { destinoSeguro } from "@/lib/destino";
import { frase } from "@/lib/formato";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

const VAZIO: DadosCadastro = {
  email: "",
  senha: "",
  nomeCompleto: "",
  dataNascimento: "",
  genero: null,
  consentimentoSaude: false,
};

/** Hoje menos 18 anos, no formato AAAA-MM-DD (limite do campo de data). */
function dataMaxima(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - LIMITES.idadeMinima);
  return d.toISOString().slice(0, 10);
}

export function FormCadastro() {
  const voltar = destinoSeguro(useSearchParams().get("voltar"));
  const [dados, setDados] = useState(VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const problemas = problemasDoCadastro(dados);
  const mudar = (parte: Partial<DadosCadastro>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (problemas.length > 0) return;
    iniciarEnvio(async () => {
      try {
        const r = await cadastrar(dados, voltar);
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
          Enviamos um link de confirmação para <b>{enviadoPara}</b>. Clique nele para ativar sua
          conta.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-3">
          <li>Abra o link <b>neste mesmo navegador</b>.</li>
          <li>Não chegou? Procure no spam. A mensagem pode levar alguns minutos.</li>
          <li>Se este e-mail já tinha conta, use a opção Entrar.</li>
        </ul>
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-brand">
          Ir para Entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <Campo id="cad-email" rotulo="E-mail">
        <input
          id="cad-email"
          type="email"
          autoComplete="email"
          value={dados.email}
          onChange={(e) => mudar({ email: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="cad-senha" rotulo="Senha" ajuda={`Pelo menos ${LIMITES.senha} caracteres.`}>
        <input
          id="cad-senha"
          type="password"
          autoComplete="new-password"
          value={dados.senha}
          onChange={(e) => mudar({ senha: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="cad-nome" rotulo="Nome completo" ajuda="Depois do cadastro, só o suporte consegue alterar.">
        <input
          id="cad-nome"
          autoComplete="name"
          maxLength={LIMITES.nome.max}
          value={dados.nomeCompleto}
          onChange={(e) => mudar({ nomeCompleto: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo
        id="cad-nascimento"
        rotulo="Data de nascimento"
        ajuda="Só maiores de 18 anos. O personal vê a sua idade, nunca a data."
      >
        <input
          id="cad-nascimento"
          type="date"
          autoComplete="bday"
          max={dataMaxima()}
          value={dados.dataNascimento}
          onChange={(e) => mudar({ dataNascimento: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-[13px] font-bold text-ink-2">
          Gênero <span className="font-normal text-ink-3">(opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {GENEROS.map((g) => (
            <Chip
              key={g.valor}
              ativo={dados.genero === g.valor}
              onClick={() => mudar({ genero: dados.genero === g.valor ? null : g.valor })}
            >
              {g.rotulo}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          Usado para mostrar personais especializados em treino feminino ou masculino. Quem marca
          &quot;Outro&quot;, &quot;Prefiro não informar&quot; ou não responde vê todos os personais.
        </p>
      </fieldset>

      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <input
          type="checkbox"
          checked={dados.consentimentoSaude}
          onChange={(e) => mudar({ consentimentoSaude: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span className="text-[13px] text-ink-2">
          <b className="block text-ink">Dados de saúde</b>
          {TEXTO_CONSENTIMENTO_SAUDE}
          <span className="mt-1 block text-ink-3">{AVISO_CONSENTIMENTO_OBRIGATORIO_PEDIDO}</span>
        </span>
      </label>

      <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>

      <button type="submit" disabled={enviando} className={ESTILO_BOTAO_PRINCIPAL}>
        {enviando ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-center text-[13px] text-ink-3">
        Já tem conta?{" "}
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-brand">
          Entrar
        </Link>
      </p>
    </form>
  );
}
