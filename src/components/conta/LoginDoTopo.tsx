"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { entrar } from "@/data/conta";

const CAIXA =
  "h-11 w-[190px] rounded-[12px] border border-white/20 bg-white/10 px-3.5 text-[15px] text-on-deep outline-none placeholder:text-on-deep-2/80 focus:border-lime";

/**
 * Login no canto superior da página inicial (decisão de 22/10/2026, opção C): e-mail e
 * senha lado a lado no computador; quem entra vai direto para a sua área (personal ou
 * aluno). No celular fica só o botão "Entrar", que abre a página de login.
 */
export function LoginDoTopo() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      try {
        const r = await entrar(email, senha);
        if (!r.ok) return setErro(r.erro);
        router.replace(r.tipo === "personal" ? "/agenda" : "/aluno");
        router.refresh();
      } catch {
        setErro("Não foi possível entrar agora. Confira sua internet e tente de novo.");
      }
    });
  }

  return (
    <>
      <Link
        href="/entrar"
        className="flex h-11 items-center rounded-[12px] bg-lime px-5 text-[15px] font-bold text-lime-ink lg:hidden"
      >
        Entrar
      </Link>
      <form onSubmit={enviar} className="relative hidden items-center gap-2 lg:flex" aria-label="Entrar">
        <input
          type="email"
          autoComplete="email"
          aria-label="E-mail"
          placeholder="E-mail"
          value={email}
          onChange={(e) => {
            setErro(null);
            setEmail(e.target.value);
          }}
          className={CAIXA}
        />
        <input
          type="password"
          autoComplete="current-password"
          aria-label="Senha"
          placeholder="Senha"
          value={senha}
          onChange={(e) => {
            setErro(null);
            setSenha(e.target.value);
          }}
          className={CAIXA}
        />
        <button
          type="submit"
          disabled={entrando || !email || !senha}
          className="h-11 rounded-[12px] bg-lime px-5 text-[15px] font-bold text-lime-ink hover:brightness-105 disabled:opacity-60"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
        {erro && (
          <p role="alert" className="absolute top-full right-0 mt-2 max-w-[400px] rounded-[12px] bg-bad px-3.5 py-2 text-[14px] font-semibold text-white">
            {erro}
          </p>
        )}
      </form>
    </>
  );
}
