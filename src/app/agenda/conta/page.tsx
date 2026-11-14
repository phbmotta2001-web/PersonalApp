import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoPersonal } from "@/components/agenda/BarraDoPersonal";
import { Avatar } from "@/components/Avatar";
import { Carregando, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { Icone, type NomeIcone } from "@/components/Icone";
import { lerAntecedencia } from "@/data/aulas";
import { sair } from "@/data/conta";
import { souDaEquipe } from "@/data/equipe";
import { meusEstudios } from "@/data/estudio";
import { exigirPersonal, PRIMEIRO_ACESSO } from "@/data/exigir-personal";
import { soNoEstudio } from "@/data/so-estudio";
import { lerRegraDeFeriados } from "@/data/feriados";
import { lerExpediente, listarBloqueios } from "@/data/expediente";
import { textoDeHoras } from "@/lib/aula";
import { formatarWhatsapp } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Conta",
};

export default function PaginaConta() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoPersonal />
    </div>
  );
}

// Aba "Conta" do personal: dados e configurações (o dinheiro fica na aba Financeiro).
async function Conteudo() {
  const personal = await exigirPersonal("/agenda/conta");
  const [antecedencia, expediente, bloqueios, feriados, estudios, equipe, soEstudio] = await Promise.all([
    lerAntecedencia(),
    lerExpediente(),
    listarBloqueios(true),
    lerRegraDeFeriados(),
    meusEstudios(),
    souDaEquipe(),
    soNoEstudio(),
  ]);

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <h1 className="text-[24px] font-extrabold">Conta</h1>

      <section className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4">
        <Avatar nome={personal.nomeCompleto} cor="av1" />
        <div className="min-w-0 text-[14px] text-ink-2">
          <p className="truncate text-[17px] font-bold text-ink">{personal.nomeCompleto}</p>
          <p className="truncate">{personal.email}</p>
          <p>
            WhatsApp {formatarWhatsapp(personal.whatsapp)}
            {personal.cref && ` · CREF ${personal.cref}/${personal.crefUf}`}
          </p>
        </div>
      </section>

      {soEstudio ? (
        <Grupo titulo="Personal">
          <Linha
            href={PRIMEIRO_ACESSO}
            icone="mais"
            titulo="Criar o meu cadastro de personal"
            texto="Incluso gratuitamente com o plano TEAM. Para os seus alunos de fora do estúdio"
          />
        </Grupo>
      ) : (
      <Grupo titulo="Agenda">
        <Linha
          href="/agenda/horarios"
          icone="relogio"
          titulo="Horários de trabalho"
          texto={expediente?.faixas.length ? `Aulas de ${expediente.duracao} min` : "Configure seus horários"}
        />
        <Linha
          href="/agenda/bloqueios"
          icone="calendario"
          titulo="Bloqueios"
          texto={bloqueios.length ? `${bloqueios.length} marcado${bloqueios.length > 1 ? "s" : ""}` : "Férias, folgas…"}
        />
        <Linha
          href="/agenda/feriados"
          icone="estrela"
          titulo="Feriados"
          texto={`${feriados.trabalha ? "Trabalho" : "Não trabalho"} em feriados${feriados.excecoes.length ? " (com exceções)" : ""}`}
        />
        <Linha href="/agenda/regras" icone="escudo" titulo="Regras e pausas" texto={`Cancelar até ${textoDeHoras(antecedencia)} antes`} />
        {/* Decisão 105: ParQ e anamnese que o aluno novo preenche no app. */}
        <Linha href="/agenda/formularios" icone="conversa" titulo="ParQ e anamnese" texto="O aluno novo preenche no app antes de treinar" />
      </Grupo>
      )}

      {equipe && (
        <Grupo titulo="Equipe P-Bell">
          <Linha href="/equipe" icone="estrela" titulo="Painel da beta" texto="Números da beta e atalhos para testar cada área" />
        </Grupo>
      )}

      {estudios.length > 0 && (
      <Grupo titulo="Estúdio">
        {estudios.map((e) => (
          <Linha
            key={e.id}
            href={e.papel === "coordenacao" ? `/estudio/${e.id}` : `/agenda/estudio/${e.id}`}
            icone="pessoas"
            titulo={e.nome}
            texto={e.papel === "coordenacao" ? "Você coordena: turmas, professores e alunos" : "Suas turmas e a equipe"}
          />
        ))}
      </Grupo>
      )}

      {!soEstudio && (
      <Grupo titulo="Alunos online">
        <Linha href="/agenda/online/questionarios" icone="conversa" titulo="Questionários" texto="Modelos de check-in e acompanhamento" />
      </Grupo>
      )}

      <form action={sair}>
        <button type="submit" className={ESTILO_BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </form>
      <Link href="/conta/excluir" className="self-center text-[14px] font-semibold text-bad">
        Excluir minha conta
      </Link>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={titulo}>
      <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">{titulo}</h2>
      <nav className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">{children}</nav>
    </section>
  );
}

function Linha({ href, icone, titulo, texto }: { href: string; icone: NomeIcone; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
        <Icone nome={icone} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{titulo}</span>
        <span className="block text-[13px] text-ink-3">{texto}</span>
      </span>
      <span className="text-ink-3" aria-hidden="true">›</span>
    </Link>
  );
}
