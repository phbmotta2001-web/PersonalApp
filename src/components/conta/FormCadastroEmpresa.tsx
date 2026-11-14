"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cadastrarEmpresa } from "@/data/conta";
import { TEXTO_TERMO_CONFIDENCIALIDADE } from "@/lib/consentimento";
import { problemasDoCadastroEmpresa, type DadosCadastroEmpresa } from "@/lib/empresa";
import { frase } from "@/lib/formato";
import { FUNCIONAMENTO_PADRAO } from "@/lib/funcionamento";
import { HorarioDeFuncionamento } from "../estudio/HorarioDeFuncionamento";
import { InterruptorTransito } from "../estudio/TransitoLivre";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";
import { AceiteDosTermos } from "./AceiteDosTermos";

const VAZIO: DadosCadastroEmpresa = {
  email: "",
  senha: "",
  nomeCompleto: "",
  whatsapp: "",
  nomeEstudio: "",
  tipo: "estudio",
  funcionamento: FUNCIONAMENTO_PADRAO,
  transitoLivre: true,
  aceitouTermo: false,
};

/** Cadastro da conta empresarial: estúdio ou academia de rede, com quem coordena. */
export function FormCadastroEmpresa({ termos = false }: { termos?: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState(VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const problemas = problemasDoCadastroEmpresa(dados);
  const mudar = (parte: Partial<DadosCadastroEmpresa>) => {
    setErro(null);
    setDados({ ...dados, ...parte });
  };
  const academia = dados.tipo === "academia";

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (problemas.length > 0) return;
    iniciarEnvio(async () => {
      try {
        const r = await cadastrarEmpresa(dados);
        if (!r.ok) return setErro(r.erro);
        if (!r.logado) return setEnviadoPara(dados.email.trim());
        // Primeiro, como os professores recebem (e, no estúdio, as mensalidades).
        router.replace(r.estudio ? `/estudio/${r.estudio}?aba=ajustes` : "/estudio");
        router.refresh();
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
          Enviamos um link de confirmação para <b>{enviadoPara}</b>. Clique nele para ativar a conta.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-3">
          <li>
            Abra o link <b>neste mesmo navegador</b>.
          </li>
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
        Para quem coordena: turmas, professores, chamada, mensalidades e o pagamento da equipe. É personal? Use a{" "}
        <Link href="/cadastro" className="font-semibold text-brand">
          conta de personal
        </Link>
        .
      </p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[14px] font-bold text-ink-2">É um</legend>
        <div className="flex flex-wrap gap-2">
          <Chip ativo={!academia} onClick={() => mudar({ tipo: "estudio" })}>
            Estúdio
          </Chip>
          <Chip ativo={academia} onClick={() => mudar({ tipo: "academia" })}>
            Academia de rede
          </Chip>
        </div>
      </fieldset>

      <Campo id="pe-estudio" rotulo={academia ? "Nome da academia" : "Nome do estúdio"}>
        <input
          id="pe-estudio"
          autoComplete="organization"
          maxLength={80}
          value={dados.nomeEstudio}
          onChange={(e) => mudar({ nomeEstudio: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <div className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold text-ink-2">Dias e horários de funcionamento</span>
        <HorarioDeFuncionamento valor={dados.funcionamento} mudar={(f) => mudar({ funcionamento: f })} />
        <span className="text-[13px] text-ink-3">A agenda de turmas e turnos fica dentro deste horário. Dá para mudar depois.</span>
      </div>

      <InterruptorTransito ligado={dados.transitoLivre} mudar={(v) => mudar({ transitoLivre: v })} />

      <Campo id="pe-nome" rotulo="Seu nome completo" ajuda="De quem responde pela coordenação.">
        <input
          id="pe-nome"
          autoComplete="name"
          maxLength={120}
          value={dados.nomeCompleto}
          onChange={(e) => mudar({ nomeCompleto: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pe-whatsapp" rotulo="WhatsApp" ajuda="Com DDD.">
        <input
          id="pe-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(21) 99999-0000"
          value={dados.whatsapp}
          onChange={(e) => mudar({ whatsapp: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pe-email" rotulo="E-mail">
        <input
          id="pe-email"
          type="email"
          autoComplete="email"
          value={dados.email}
          onChange={(e) => mudar({ email: e.target.value })}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Campo id="pe-senha" rotulo="Senha" ajuda="Pelo menos 8 caracteres.">
        <input
          id="pe-senha"
          type="password"
          autoComplete="new-password"
          value={dados.senha}
          onChange={(e) => mudar({ senha: e.target.value })}
          className={ESTILO_CAIXA}
        />
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
        {enviando ? "Criando conta…" : "Criar conta empresarial"}
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
