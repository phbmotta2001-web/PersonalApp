"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { situacaoParaPedido } from "@/data/pedidos";
import type { Personal } from "@/data/personais";
import { ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { Gaveta } from "../Gaveta";
import { GavetaPedido } from "./GavetaPedido";
import { PedidoEnviado } from "./PedidoEnviado";

type Aviso = { titulo: string; texto: string; link?: { href: string; rotulo: string } };

/**
 * Botão "Tenho interesse": confere se a pessoa pode pedir (login, perfil, regra de
 * gênero), abre o formulário e, depois, a tela de confirmação.
 */
export function BotaoInteresse({ personal }: { personal: Personal }) {
  const router = useRouter();
  const [verificando, iniciar] = useTransition();
  const [aberta, setAberta] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [saude, setSaude] = useState({ consentimentoSaude: false, temRestricoes: false });
  const [enviado, setEnviado] = useState<{ hora: string; autorizouRestricoes: boolean } | null>(null);

  function clicar() {
    iniciar(async () => {
      try {
        const s = await situacaoParaPedido(personal.slug);
        if (s.estado === "entrar") {
          router.push(`/entrar?voltar=${encodeURIComponent(`/personais/${personal.slug}`)}`);
        } else if (s.estado === "completar-perfil") {
          setAviso({
            titulo: "Complete seu perfil",
            texto: "O personal precisa saber seu objetivo e seu nível antes de responder um pedido.",
            link: { href: "/perfil", rotulo: "Abrir meu perfil" },
          });
        } else if (s.estado === "nao-atende") {
          setAviso({
            titulo: "Este personal não atende o seu perfil",
            texto: s.mensagem,
            link: { href: "/buscar", rotulo: "Ver outros personais" },
          });
        } else {
          setSaude({ consentimentoSaude: s.consentimentoSaude, temRestricoes: s.temRestricoes });
          setAberta(true);
        }
      } catch {
        setAviso({ titulo: "Sem conexão", texto: "Não foi possível continuar agora. Confira sua internet." });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={clicar}
        disabled={verificando}
        className="min-h-[50px] rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110 disabled:opacity-60"
      >
        {verificando ? "Um instante…" : "Tenho interesse"}
      </button>

      {aberta && (
        <GavetaPedido
          personal={personal}
          aberta={aberta}
          consentimentoSaude={saude.consentimentoSaude}
          temRestricoes={saude.temRestricoes}
          aoFechar={() => setAberta(false)}
          aoEnviar={(autorizouRestricoes) => {
            setAberta(false);
            setEnviado({
              hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              autorizouRestricoes,
            });
          }}
        />
      )}

      <Gaveta
        aberta={aviso !== null}
        aoFechar={() => setAviso(null)}
        titulo={aviso?.titulo ?? ""}
        rodape={
          aviso?.link && (
            <Link href={aviso.link.href} className={ESTILO_BOTAO_PRINCIPAL}>
              {aviso.link.rotulo}
            </Link>
          )
        }
      >
        <p className="text-ink-2">{aviso?.texto}</p>
      </Gaveta>

      {enviado && (
        <PedidoEnviado personal={personal} hora={enviado.hora} autorizouRestricoes={enviado.autorizouRestricoes} />
      )}
    </>
  );
}
