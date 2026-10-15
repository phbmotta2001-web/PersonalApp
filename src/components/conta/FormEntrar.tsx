"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { entrar } from "@/data/conta";
import { destinoSeguro } from "@/lib/destino";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

export function FormEntrar() {
  const parametros = useSearchParams();
  const voltar = destinoSeguro(parametros.get("voltar"));
  const linkVencido = parametros.get("erro") === "link";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, iniciarEntrada] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    iniciarEntrada(async () => {
      try {
        const r = await entrar(email, senha);
        if (!r.ok) return setErro(r.erro);
        router.replace(voltar);
        router.refresh();
      } catch {
        setErro("Não foi possível entrar agora. Confira sua internet e tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      {linkVencido && (
        <Aviso>
          O link de confirmação não funcionou: ele pode ter vencido ou ter sido aberto em outro
          navegador. Tente entrar; se o e-mail ainda não estiver confirmado, avisaremos.
        </Aviso>
      )}

      <Campo id="ent-email" rotulo="E-mail">
        <input
          id="ent-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setErro(null);
            setEmail(e.target.value);
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>
      <Campo id="ent-senha" rotulo="Senha">
        <input
          id="ent-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => {
            setErro(null);
            setSenha(e.target.value);
          }}
          className={ESTILO_CAIXA}
        />
      </Campo>

      <Aviso>{erro}</Aviso>

      <button type="submit" disabled={entrando || !email || !senha} className={ESTILO_BOTAO_PRINCIPAL}>
        {entrando ? "Entrando…" : "Entrar"}
      </button>

      <p className="text-center text-[13px] text-ink-3">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-brand">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
