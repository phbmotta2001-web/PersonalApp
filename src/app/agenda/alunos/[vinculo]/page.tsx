import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncerrarVinculo } from "@/components/agenda/EncerrarVinculo";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { lerFichaDoAluno } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerMatricula, proximaAulaPorAluno } from "@/data/matriculas";
import { rotuloGenero, rotuloNivel } from "@/lib/aluno";
import { linkWhatsapp } from "@/lib/convite";
import { centavosParaReais, resumoDosHorarios, textoDaAula } from "@/lib/matricula";
import { formatarWhatsapp } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Ficha do aluno",
};

export default function PaginaFichaDoAluno({ params }: PageProps<"/agenda/alunos/[vinculo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Cabecalho titulo="Ficha do aluno">
        <BotaoVoltar reserva="/agenda/alunos" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Ficha params={params} />
      </Suspense>
    </div>
  );
}

async function Ficha({ params }: { params: PageProps<"/agenda/alunos/[vinculo]">["params"] }) {
  const { vinculo } = await params;
  await exigirPersonal(`/agenda/alunos/${vinculo}`);
  const [a, matricula, proximas] = await Promise.all([lerFichaDoAluno(vinculo), lerMatricula(vinculo), proximaAulaPorAluno()]);
  const proxima = proximas[vinculo];

  if (!a)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
        <p>Este aluno não está mais ligado a você, ou o endereço está errado.</p>
        <Link href="/agenda/alunos" className="font-semibold text-brand">
          Ver meus alunos
        </Link>
      </div>
    );

  const endereco = [a.endereco, a.bairro, a.cidade, a.cep].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <Avatar nome={a.nomeCompleto} cor="av6" tamanho="grande" />
        <h2 className="mt-1 text-[20px] font-extrabold">{a.nomeCompleto}</h2>
        <p className="text-[13px] text-ink-3">
          {a.idade} anos · {rotuloGenero(a.genero)} · aluno desde {new Date(a.aceitoEm).toLocaleDateString("pt-BR")}
        </p>
      </div>

      {/* Restrições primeiro: é o que o personal precisa ver antes de tudo. */}
      <section
        className={`flex items-start gap-3 rounded-[20px] p-4 ${a.restricoes ? "bg-gold-soft text-gold" : "bg-ok-soft text-ok"}`}
      >
        <Icone nome="escudo" className="mt-0.5 size-5" />
        <div className="text-[13.5px]">
          <p className="font-bold">{a.restricoes ? "Restrições e limitações" : "Sem restrições declaradas"}</p>
          {a.restricoes && <p className="mt-1 whitespace-pre-line text-ink">{a.restricoes}</p>}
          {a.restricoesDeclaradasEm && (
            <p className="mt-1 text-xs opacity-80">
              Declaração de {new Date(a.restricoesDeclaradasEm).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </section>

      {proxima && (
        <section className="flex items-start gap-3 rounded-[20px] bg-brand p-4 text-brand-ink">
          <Icone nome="calendario" className="mt-0.5 size-5 shrink-0" />
          <p className="text-[14px]">
            <span className="block text-xs opacity-80">Próxima aula</span>
            <span className="font-bold">{textoDaAula(proxima.inicio, proxima.local)}</span>
          </p>
        </section>
      )}

      {matricula ? (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <Icone nome="calendario" className="size-[18px] text-brand" />
            <h3 className="flex-1 text-[15px] font-bold">Matrícula</h3>
            <Link href={`/agenda/alunos/${vinculo}/matricula`} className="text-[13px] font-semibold text-brand">
              Alterar
            </Link>
          </div>
          <p className="text-[17px] font-extrabold">{resumoDosHorarios(matricula.horarios)}</p>
          <p className="text-[13px] text-ink-2">
            {[
              `Aulas de ${matricula.duracao} min`,
              matricula.local,
              matricula.valorCentavos != null && `${centavosParaReais(matricula.valorCentavos)} por mês${matricula.valorForaDoPadrao ? " (fora do padrão)" : ""}`,
              matricula.diaVencimento != null && `vence dia ${matricula.diaVencimento}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-ink-3">
            Desde {new Date(`${matricula.inicio}T12:00:00`).toLocaleDateString("pt-BR")}
            {matricula.fim && ` até ${new Date(`${matricula.fim}T12:00:00`).toLocaleDateString("pt-BR")}`}
          </p>
        </section>
      ) : (
        <Link
          href={`/agenda/alunos/${vinculo}/matricula`}
          className="flex items-center gap-3 rounded-[20px] border border-dashed border-brand bg-brand-soft p-4 text-brand"
        >
          <Icone nome="calendario" className="size-5" />
          <span className="flex-1">
            <span className="block text-sm font-bold">Criar matrícula</span>
            <span className="block text-xs">Horários fixos, local e valor. As aulas entram na sua agenda.</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-[20px] border border-line bg-surface p-4 text-sm">
        <Linha nome="Objetivo" valor={a.objetivo} />
        <Linha nome="Nível" valor={rotuloNivel(a.nivel)} />
        <Linha nome="Peso" valor={a.pesoKg != null ? `${a.pesoKg.toLocaleString("pt-BR")} kg` : null} />
        <Linha nome="Altura" valor={a.alturaCm != null ? `${a.alturaCm.toLocaleString("pt-BR")} cm` : null} />
        <Linha nome="Outras medidas" valor={a.outrasMedidas} />
        <Linha nome="Endereço" valor={endereco || null} />
        <Linha
          nome="WhatsApp"
          valor={a.whatsapp ? `${formatarWhatsapp(a.whatsapp)}${a.avisosWhatsapp ? "" : " (não quer avisos)"}` : "Não informado"}
        />
      </dl>

      {a.whatsapp && (
        <a
          href={linkWhatsapp(a.whatsapp, `Oi, ${a.nomeCompleto.split(" ")[0]}!`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-surface px-3 text-[13px] font-bold"
        >
          <Icone nome="conversa" className="size-4" /> Abrir conversa no WhatsApp
        </a>
      )}

      <EncerrarVinculo
        vinculoId={a.vinculoId}
        depois="/agenda/alunos"
        aviso={`Ao encerrar, ${a.nomeCompleto.split(" ")[0]} sai da sua lista de alunos, as aulas futuras saem da agenda e você deixa de ver o cadastro dele. A conta do aluno continua existindo.`}
      />
    </div>
  );
}

function Linha({ nome, valor }: { nome: string; valor: string | null }) {
  return (
    <>
      <dt className="text-ink-3">{nome}</dt>
      <dd className="font-semibold">{valor || <span className="font-normal text-ink-3">—</span>}</dd>
    </>
  );
}
