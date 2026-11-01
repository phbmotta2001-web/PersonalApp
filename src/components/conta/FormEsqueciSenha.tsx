"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { pedirNovaSenha } from "@/data/conta";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/** Pede o link para criar uma senha nova. A resposta é a mesma com ou sem conta nesse e-mail. */
export function FormEsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, iniciar] = useTransition();

  if (enviado)
    return (
      <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
        <p className="text-ink-2">
          Se <b>{email.trim()}</b> tiver conta no P-Bell, enviamos um link para criar uma senha nova. Ele pode levar alguns
          minutos para chegar; procure também no spam.
        </p>
        <Link href="/entrar" className="font-semibold text-brand">
          Voltar para Entrar
        </Link>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          try {
            const r = await pedirNovaSenha(email);
            if (r.ok) setEnviado(true);
            else setErro(r.erro);
          } catch {
            setErro("Não foi possível enviar agora. Confira sua internet e tente de novo.");
          }
        });
      }}
      className="flex flex-col gap-4 px-[18px] pt-2 pb-6"
    >
      <p className="text-ink-2">Informe o e-mail da sua conta para receber um link e criar uma senha nova.</p>
      <Campo id="es-email" rotulo="E-mail">
        <input
          id="es-email"
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
      <Aviso>{erro}</Aviso>
      <button type="submit" disabled={enviando || !email.trim()} className={ESTILO_BOTAO_PRINCIPAL}>
        {enviando ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
