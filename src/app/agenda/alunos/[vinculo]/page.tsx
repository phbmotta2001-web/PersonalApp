import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncerrarVinculo } from "@/components/agenda/EncerrarVinculo";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { aulasDoMes, reposicoesDisponiveis } from "@/data/aulas";
import { listarCobrancas } from "@/data/cobrancas";
import { lerFichaDoAluno } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerMatricula, proximaAulaPorAluno } from "@/data/matriculas";
import { rotuloGenero, rotuloNivel } from "@/lib/aluno";
import { resumoDoMes } from "@/lib/aula";
import { linkWhatsapp } from "@/lib/convite";
import { COR_COBRANCA, descricaoDaCobranca, ROTULO_COBRANCA, situacaoDaCobranca } from "@/lib/cobranca";
import { agoraEmBrasilia, dataCurta } from "@/lib/expediente";
import { centavosParaReais, resumoDaModalidade, resumoDosHorarios, textoDaAula } from "@/lib/matricula";
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
  const [a, matricula, proximas, reposicoes, doMes, cobrancas] = await Promise.all([
    lerFichaDoAluno(vinculo),
    lerMatricula(vinculo),
    proximaAulaPorAluno(),
    reposicoesDisponiveis(vinculo),
    aulasDoMes(vinculo),
    listarCobrancas(vinculo),
  ]);
  const hoje = agoraEmBrasilia().data;
  const atrasado = cobrancas.some((c) => situacaoDaCobranca(c, hoje) === "atrasada");
  const resumo = resumoDoMes(doMes);
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
        <h2 className={`mt-1 text-[20px] font-extrabold ${atrasado ? "text-bad" : ""}`}>{a.nomeCompleto}</h2>
        {atrasado && <p className="text-xs font-bold text-bad">Mensalidade atrasada</p>}
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
          <p className="text-xs font-bold text-brand">{resumoDaModalidade(matricula)}</p>
          <p className="text-[17px] font-extrabold">
            {matricula.modalidade === "online"
              ? "Sem horário na agenda"
              : resumoDosHorarios(matricula.horarios, matricula.intervaloSemanas)}
          </p>
          <p className="text-[13px] text-ink-2">
            {[
              matricula.modalidade !== "online" && `Aulas de ${matricula.duracao} min`,
              matricula.modalidade !== "online" && matricula.local,
              matricula.valorCentavos != null &&
                `${centavosParaReais(matricula.valorCentavos)} ${matricula.cicloMeses === 1 ? "por mês" : `a cada ${matricula.cicloMeses} meses`}${matricula.valorForaDoPadrao ? " (fora do padrão)" : ""}`,
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

      <section className="grid grid-cols-2 gap-2" aria-label="Este mês">
        <Numero titulo="Aulas dadas no mês" valor={resumo.dadas} />
        <Numero titulo="Faltas no mês" valor={resumo.faltas} />
        <Numero titulo="Canceladas no mês" valor={resumo.canceladas} />
        <Numero
          titulo={reposicoes.length === 1 ? "Reposição disponível" : "Reposições disponíveis"}
          valor={reposicoes.length}
          detalhe={reposicoes[0] ? `a 1ª vale até ${dataCurta(reposicoes[0].validoAte)}` : undefined}
        />
      </section>

      {cobrancas.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="Cobranças">
          <h3 className="text-[15px] font-semibold">Cobranças</h3>
          <ul className="flex flex-col gap-1.5">
            {cobrancas.slice(0, 4).map((c) => {
              const sc = situacaoDaCobranca(c, hoje);
              return (
                <li key={c.id}>
                  <Link
                    href={`/agenda/cobrancas/${c.id}`}
                    className={`flex items-center gap-2 rounded-[14px] border bg-surface px-3 py-2.5 text-sm ${sc === "atrasada" ? "border-bad/50" : "border-line"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{descricaoDaCobranca(c)}</span>
                    <span className="font-bold tabular-nums">{centavosParaReais(c.valorCentavos)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_COBRANCA[sc]}`}>{ROTULO_COBRANCA[sc]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link href={`/agenda/historico?aluno=${vinculo}`} className="-mt-2 self-end text-[13px] font-semibold text-brand">
        Ver calendário de aulas ›
      </Link>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-[20px] border border-line bg-surface p-4 text-sm">
        <Linha nome="Objetivo" valor={a.objetivo} desde={a.datas.objetivo} />
        <Linha nome="Nível" valor={rotuloNivel(a.nivel)} />
        <Linha nome="Peso" valor={a.pesoKg != null ? `${a.pesoKg.toLocaleString("pt-BR")} kg` : null} desde={a.datas.peso_kg} />
        <Linha nome="Altura" valor={a.alturaCm != null ? `${a.alturaCm.toLocaleString("pt-BR")} cm` : null} desde={a.datas.altura_cm} />
        <Linha nome="Outras medidas" valor={a.outrasMedidas} desde={a.datas.outras_medidas} />
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

function Numero({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-3 py-2.5">
      <p className="text-[22px] font-extrabold tabular-nums">{valor}</p>
      <p className="text-xs text-ink-3">{titulo}</p>
      {detalhe && <p className="text-[11px] text-ink-3">{detalhe}</p>}
    </div>
  );
}

function Linha({ nome, valor, desde }: { nome: string; valor: string | null; desde?: string }) {
  return (
    <>
      <dt className="text-ink-3">{nome}</dt>
      <dd className="font-semibold">
        {valor || <span className="font-normal text-ink-3">—</span>}
        {valor && desde && (
          <span className="block text-[11.5px] font-normal text-ink-3">
            informado em {new Date(desde).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
        )}
      </dd>
    </>
  );
}
