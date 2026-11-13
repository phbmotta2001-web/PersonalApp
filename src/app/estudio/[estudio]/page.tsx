import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgendaDoEstudio } from "@/components/estudio/AgendaDoEstudio";
import { SemanaDoEstudio } from "@/components/estudio/SemanaDoEstudio";
import { ABAS_DA_COORDENACAO, MenuDaCoordenacao } from "@/components/estudio/MenuDaCoordenacao";
import { GestaoDoEstudio, type Aba } from "@/components/estudio/GestaoDoEstudio";
import { Carregando } from "@/components/Formulario";
import { souContaEmpresa } from "@/data/conta";
import { aulasDoEstudio, lerDiasFechados, lerEstudio, lerFeriadosDoEstudio, salvarFeriadosDoEstudio } from "@/data/estudio";
import { DiasFechados } from "@/components/estudio/DiasFechados";
import { FormFeriados } from "@/components/agenda/FormFeriados";
import { feriadosEntre } from "@/lib/feriados";
import { crescimentoDoEstudio, historicoDoEstudio, lerFinanceiroDoMes, pagamentosDosAlunos, previsaoDosProfessores, resumoDosProfessores } from "@/data/estudio-financeiro";
import { AusenciasDoEstudio } from "@/components/estudio/AusenciasDoEstudio";
import { ReposicoesAbertas } from "@/components/estudio/ReposicoesAbertas";
import { RegrasDosAlunos } from "@/components/estudio/RegrasDosAlunos";
import { ValorDaReposicao } from "@/components/estudio/ValorDaReposicao";
import { lerAntecedenciaParaMarcar } from "@/data/aluno-estudio";
import { ausenciasDoEstudio, lerConfigReposicao, reposicoesAbertas } from "@/data/reposicao";
import { exigirPersonal } from "@/data/exigir-personal";
import { diaDaSemana, emBrasilia, instante, somarDias } from "@/lib/expediente";

const ABAS: Aba[] = ["agenda", "turmas", "equipe", "alunos", "financeiro", "ajustes"];

export const metadata: Metadata = {
  title: "Coordenação do estúdio",
};

export default function PaginaEstudio({ params, searchParams }: PageProps<"/estudio/[estudio]">) {
  return (
    <div className="painel-estudio flex w-full flex-1 flex-col lg:pl-60">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({
  params,
  searchParams,
}: {
  params: PageProps<"/estudio/[estudio]">["params"];
  searchParams: PageProps<"/estudio/[estudio]">["searchParams"];
}) {
  const { estudio: id } = await params;
  const { aba, mes, dia, semana } = await searchParams;
  await exigirPersonal(`/estudio/${id}`);
  const [estudio, empresa] = await Promise.all([lerEstudio(id), souContaEmpresa()]);
  if (!estudio || estudio.papel !== "coordenacao") notFound();
  const qual = ABAS.find((a) => a === aba && a !== "turmas") ?? "agenda";
  const hoje = emBrasilia(new Date().toISOString()).data;
  const mesEscolhido = typeof mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7);
  const abertos = Object.keys(estudio.config.funcionamento).map(Number);
  const financeiro =
    qual === "financeiro"
      ? await Promise.all([
          lerFinanceiroDoMes(estudio.id, `${mesEscolhido}-01`),
          historicoDoEstudio(estudio.id, mesEscolhido),
          crescimentoDoEstudio(estudio.id, hoje.slice(0, 7)),
          previsaoDosProfessores(estudio.id, `${mesEscolhido}-01`),
        ]).then(([dados, historico, crescimento, previsao]) => ({ mes: mesEscolhido, hoje, dados, historico, crescimento, previsao }))
      : undefined;
  const pagamentos = qual === "alunos" && estudio.config.tipo === "estudio" ? await pagamentosDosAlunos(estudio.id, hoje) : undefined;
  const professores = qual === "equipe" ? await resumoDosProfessores(estudio.id, hoje, abertos.length ? abertos : null) : undefined;
  const titulo = ABAS_DA_COORDENACAO.find((a) => a.valor === qual)!.rotulo;
  return (
    <>
      <MenuDaCoordenacao estudioId={estudio.id} nome={estudio.nome} aba={qual} empresa={empresa} />
      {/* A agenda usa a largura toda (uma coluna por profissional); as outras abas ficam centradas. */}
      <main className={`mx-auto flex w-full flex-col gap-4 px-[18px] pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12 ${qual === "agenda" ? "" : "max-w-6xl"}`}>
        <h1 className="text-[24px] leading-tight font-extrabold">{titulo}</h1>
        <GestaoDoEstudio
          estudio={estudio}
          aba={qual}
          financeiro={financeiro}
          pagamentos={pagamentos}
          professores={professores}
          hoje={hoje}
          agenda={qual === "agenda" ? await agendaDaAba(estudio, hoje, dia, semana) : undefined}
          complemento={await complementoDaAba(estudio, qual)}
        />
      </main>
    </>
  );
}

/** Férias e faltas e reposições (Agenda e Equipe); valor da reposição (Ajustes). */
async function complementoDaAba(estudio: NonNullable<Awaited<ReturnType<typeof lerEstudio>>>, aba: Aba) {
  if (aba === "ajustes") {
    const hoje = emBrasilia(new Date().toISOString()).data;
    const [config, marcarH, feriados, fechados] = await Promise.all([
      lerConfigReposicao(estudio.id),
      lerAntecedenciaParaMarcar(estudio.id),
      lerFeriadosDoEstudio(estudio.id),
      lerDiasFechados(estudio.id, hoje),
    ]);
    return (
      <>
        <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Feriados">
          <h2 className="font-bold">Feriados</h2>
          <FormFeriados
            inicial={feriados}
            feriados={feriadosEntre(hoje, somarDias(hoje, 365))}
            salvar={salvarFeriadosDoEstudio.bind(null, estudio.id)}
            estudio
          />
        </section>
        <DiasFechados estudioId={estudio.id} hoje={hoje} dias={fechados} />
        <RegrasDosAlunos estudioId={estudio.id} faltaH={estudio.antecedenciaFaltaH} marcarH={marcarH} validadeDias={estudio.validadeReposicaoDias} />
        <ValorDaReposicao estudioId={estudio.id} config={config} />
      </>
    );
  }
  if (aba !== "agenda" && aba !== "equipe") return null;
  const [ausencias, reposicoes] = await Promise.all([ausenciasDoEstudio(estudio.id), reposicoesAbertas(estudio.id)]);
  return (
    <>
      <ReposicoesAbertas reposicoes={reposicoes} podeAssumir={false} />
      <AusenciasDoEstudio
        estudioId={estudio.id}
        estudioNome={estudio.nome}
        equipe={estudio.equipe.map((m) => ({ personalId: m.personalId, nome: m.nome }))}
        ausencias={ausencias}
      />
    </>
  );
}

const dataValida = (d: string | string[] | undefined): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/**
 * Agenda da coordenação (decisão 64): por padrão a semana inteira, com a cor de cada professor;
 * tocando num dia, a agenda do dia com uma coluna por profissional.
 */
async function agendaDaAba(
  estudio: NonNullable<Awaited<ReturnType<typeof lerEstudio>>>,
  hoje: string,
  dia: string | string[] | undefined,
  semana: string | string[] | undefined,
) {
  if (!dataValida(dia)) {
    const base = dataValida(semana) ? semana : hoje;
    const segunda = somarDias(base, -diaDaSemana(base)); // início da semana: domingo
    const aulas = await aulasDoEstudio(estudio.id, instante(segunda, 0).toISOString(), instante(somarDias(segunda, 7), 0).toISOString());
    return <SemanaDoEstudio key={segunda} estudio={estudio} aulas={aulas} segunda={segunda} hoje={hoje} />;
  }
  const data = dia;
  const aulas = await aulasDoEstudio(estudio.id, instante(data, 0).toISOString(), instante(somarDias(data, 1), 0).toISOString());
  return <AgendaDoEstudio key={data} estudio={estudio} aulas={aulas} dia={data} hoje={hoje} />;
}
