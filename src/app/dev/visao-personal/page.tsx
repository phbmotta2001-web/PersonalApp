import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { buscarPersonal } from "@/data/personais";
import { rotuloGenero, rotuloNivel, type Genero, type NivelAluno } from "@/lib/aluno";
import { usuarioAtual } from "@/lib/supabase/servidor";

// PÁGINA DE TESTE — só existe enquanto o site roda com `npm run dev`.
// Mostra, para cada pedido do aluno logado, exatamente o que o personal receberia
// (função perfil_para_personal do banco). Serve para conferir as regras de
// privacidade enquanto as telas do personal não existem.

export const metadata: Metadata = { title: "Teste: o que o personal vê" };

export default function PaginaVisaoPersonal() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="O que o personal vê">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
      </Cabecalho>
      <p className="mx-[18px] mb-3 rounded-[14px] bg-gold-soft px-3.5 py-2.5 text-[13px] text-gold">
        Página de teste, só no computador de desenvolvimento. Mostra o que o personal receberia em
        cada pedido seu.
      </p>
      <Suspense fallback={<Carregando />}>
        <Pedidos />
      </Suspense>
    </div>
  );
}

type Visao = {
  status: "pendente" | "aceito" | "recusado" | "expirado";
  primeiro_nome: string;
  objetivo: string;
  nivel: NivelAluno | null;
  bairro: string | null;
  mensagem: string | null;
  autorizou_restricoes: boolean;
  restricoes: string | null;
  nome_completo?: string;
  idade?: number;
  genero?: Genero | null;
  cep?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  peso_kg?: number | null;
  altura_cm?: number | null;
  outras_medidas?: string | null;
};

const STATUS: Record<Visao["status"], string> = {
  pendente: "Aguardando resposta",
  aceito: "Aceito",
  recusado: "Recusado",
  expirado: "Expirado (24 h sem resposta)",
};

async function Pedidos() {
  const { supabase, id } = await usuarioAtual();
  if (!id)
    return (
      <p className="px-[18px] text-sm text-ink-2">
        <Link href="/entrar?voltar=/dev/visao-personal" className="font-semibold text-brand">
          Entre na sua conta
        </Link>{" "}
        para ver seus pedidos.
      </p>
    );

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, personal_slug, criado_em")
    .order("criado_em", { ascending: false })
    .limit(10);

  if (!pedidos?.length)
    return <p className="px-[18px] text-sm text-ink-2">Você ainda não enviou nenhum pedido.</p>;

  const visoes = await Promise.all(
    pedidos.map(async (p) => {
      const { data } = await supabase.rpc("perfil_para_personal", { p_pedido: p.id });
      return { ...p, visao: data as Visao | null, personal: await buscarPersonal(p.personal_slug) };
    }),
  );

  return (
    <ul className="flex flex-col gap-3 px-[18px] pb-6">
      {visoes.map(({ id: idPedido, criado_em, visao: v, personal }) => (
        <li key={idPedido} className="rounded-[20px] border border-line bg-surface p-4">
          <p className="text-[15px] font-bold">Pedido para {personal?.nome ?? "personal"}</p>
          <p className="mb-3 text-xs text-ink-3">
            {new Date(criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
            {v ? STATUS[v.status] : "—"}
          </p>
          {v && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <Linha nome="Primeiro nome" valor={v.primeiro_nome} />
              <Linha nome="Objetivo" valor={v.objetivo} />
              <Linha nome="Nível" valor={rotuloNivel(v.nivel)} />
              <Linha nome="Bairro" valor={v.bairro} />
              <Linha nome="Mensagem" valor={v.mensagem} />
              <Linha
                nome="Restrições"
                valor={
                  v.restricoes ??
                  (v.autorizou_restricoes
                    ? "Não informou restrições no perfil"
                    : "Preferiu não compartilhar antes do aceite")
                }
              />
              {v.status === "aceito" ? (
                <>
                  <Linha nome="Nome completo" valor={v.nome_completo} />
                  <Linha nome="Idade" valor={v.idade != null ? `${v.idade} anos` : null} />
                  <Linha nome="Gênero" valor={rotuloGenero(v.genero ?? null)} />
                  <Linha nome="Endereço" valor={[v.endereco, v.cidade, v.cep].filter(Boolean).join(" · ")} />
                  <Linha nome="Peso" valor={v.peso_kg != null ? `${v.peso_kg} kg` : null} />
                  <Linha nome="Altura" valor={v.altura_cm != null ? `${v.altura_cm} cm` : null} />
                  <Linha nome="Outras medidas" valor={v.outras_medidas} />
                </>
              ) : (
                <p className="col-span-2 mt-2 text-xs text-ink-3">
                  🔒 Nome completo, idade, gênero, endereço, peso, altura e medidas só aparecem depois do aceite.
                  Para simular um aceite, rode no SQL Editor do Supabase:
                  <code className="mt-1 block rounded bg-surface-2 p-2 text-[11px] break-all text-ink-2">
                    update public.pedidos set status = &apos;aceito&apos;, decidido_em = now() where id = &apos;
                    {idPedido}&apos;;
                  </code>
                </p>
              )}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

function Linha({ nome, valor }: { nome: string; valor: string | null | undefined }) {
  return (
    <>
      <dt className="text-ink-3">{nome}</dt>
      <dd className="font-semibold">{valor || <span className="font-normal text-ink-3">—</span>}</dd>
    </>
  );
}
