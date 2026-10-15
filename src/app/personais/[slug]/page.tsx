import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/components/Formulario";
import { Avatar } from "@/components/Avatar";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Icone, type NomeIcone } from "@/components/Icone";
import { Nota } from "@/components/Nota";
import { BotaoInteresse } from "@/components/perfil/BotaoInteresse";
import { SeloNivel } from "@/components/SeloNivel";
import { buscarPersonal, listarPersonais, type Local } from "@/data/personais";
import { DIAS_SEMANA, faixaDaAula, NOME_DIA } from "@/lib/agenda";
import { formatarNota, formatarReais } from "@/lib/formato";
import { MARKETPLACE_ATIVO } from "@/lib/recursos";

const ICONE_DO_LOCAL: Record<Local, NomeIcone> = {
  casa: "casa",
  "ar-livre": "local",
  academia: "local",
  online: "conversa",
};

// Gera de antemão a página de perfil de cada personal.
// Marketplace (Fase 2) desligado: a página responde "não encontrada", então o
// pré-teste de navegação instantânea do Next.js não se aplica a ela.
export const instant = false;

export async function generateStaticParams() {
  const personais = await listarPersonais();
  return personais.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/personais/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const personal = await buscarPersonal(slug);
  return { title: personal?.nome ?? "Personal não encontrado" };
}

export default function PaginaPerfil({ params }: PageProps<"/personais/[slug]">) {
  // Marketplace (Fase 2): desligado na Fase 1. Ver src/lib/recursos.ts.
  if (!MARKETPLACE_ATIVO) notFound();

  // O endereço (slug) é lido dentro do bloco de carregamento, para a navegação não travar.
  return (
    <Suspense fallback={<Carregando />}>
      <Perfil params={params} />
    </Suspense>
  );
}

async function Perfil({ params }: { params: PageProps<"/personais/[slug]">["params"] }) {
  const { slug } = await params;
  const personal = await buscarPersonal(slug);
  if (!personal) notFound();

  const { perfil } = personal;
  const precos = perfil.planos.map((pl) => pl.precoAula);
  const faixaPreco = `${formatarReais(Math.min(...precos))}–${Math.max(...precos)}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex flex-col gap-3.5 bg-deep px-[18px] pt-2.5 pb-[22px] text-on-deep">
        <BotaoVoltar reserva="/buscar" className="-ml-2.5 hover:bg-white/10" />
        <div className="flex items-center gap-3">
          <Avatar nome={personal.nome} cor={personal.cor} tamanho="grande" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-extrabold">{personal.nome}</h1>
            <p className="text-[13.5px] text-on-deep-2">
              Personal trainer · {personal.bairro} · {perfil.cref}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex min-h-6 items-center gap-1 rounded-[7px] bg-white/12 px-2 text-xs font-bold">
            <Icone nome="escudo" className="size-4" />
            CREF verificado
          </span>
          {personal.nivel && <SeloNivel nivel={personal.nivel} />}
          {perfil.selo && (
            <span className="inline-flex min-h-6 items-center rounded-[7px] bg-white/12 px-2 text-xs font-bold">
              {perfil.selo}
            </span>
          )}
          {personal.publico !== "todos" && (
            <span className="inline-flex min-h-6 items-center rounded-[7px] bg-white/12 px-2 text-xs font-bold">
              {personal.genero === "f" ? "Especializada" : "Especializado"} em treino {personal.publico}
            </span>
          )}
        </div>
      </header>

      <main className="flex flex-col gap-5 px-[18px] pt-4 pb-6">
        <dl className="grid grid-cols-4 gap-1.5">
          <Numero valor={formatarNota(personal.nota)} legenda={`${personal.avaliacoes} avaliações`} />
          <Numero valor={`${personal.renovacao}%`} legenda="dos alunos renovam" />
          <Numero valor={String(perfil.alunosAtivos)} legenda="alunos ativos" />
          <Numero valor={perfil.tempoResposta} legenda="para responder" />
        </dl>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Sobre</h2>
          <p className="text-ink-2">{perfil.sobre}</p>
          <div className="flex flex-wrap gap-2">
            {personal.objetivos.map((o) => (
              <span
                key={o}
                className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2"
              >
                {o}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">Horários livres</h2>
            <span className="text-xs text-ink-3">toda semana · aulas de 1 h</span>
          </div>
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4 py-1">
            {DIAS_SEMANA.map((d) => {
              const horas = personal.disponibilidade[d] ?? [];
              return (
                <li key={d} className="flex items-center gap-3 py-2.5">
                  <span className="w-[72px] shrink-0 text-sm font-bold">{NOME_DIA[d]}</span>
                  {horas.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {horas.map((h) => (
                        <span
                          key={h}
                          className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand tabular-nums"
                        >
                          {faixaDaAula(h)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3">Sem horário livre</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-3">
            Você escolhe seus horários ao clicar em &quot;Tenho interesse&quot;. Eles só ficam reservados
            quando {personal.genero === "f" ? "ela" : "ele"} aceitar.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Onde atende</h2>
          <ul className="divide-y divide-line">
            {perfil.ondeAtende.map((o) => (
              <li key={o.local} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-brand">
                  <Icone nome={ICONE_DO_LOCAL[o.local]} />
                </span>
                <span className="flex-1">{o.rotulo}</span>
                <span className="text-[12.5px] text-ink-3">{o.regioes}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Planos</h2>
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4 py-1">
            {perfil.planos.map((pl) => (
              <li key={pl.vezesPorSemana} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-[15px] font-bold">
                    {pl.vezesPorSemana}x por semana
                    {pl.maisEscolhido && (
                      <span className="ml-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">
                        Mais escolhido
                      </span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-ink-3 tabular-nums">
                    {formatarReais(pl.precoAula)} por aula
                  </p>
                </div>
                <p className="text-right text-base font-extrabold tabular-nums">
                  {formatarReais(pl.mensalidade)}
                  <span className="text-[12.5px] font-normal text-ink-3">/mês</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-ink-3">
            Mensalidade cobrada automaticamente no cartão ou Pix. A primeira aula é experimental e
            sem custo.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">Avaliações</h2>
            <Nota nota={personal.nota} avaliacoes={personal.avaliacoes} />
          </div>
          {perfil.depoimentos.map((d) => (
            <figure
              key={d.autora}
              className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-4"
            >
              <figcaption className="flex justify-between gap-2">
                <b>{d.autora}</b>
                <span className="text-[12.5px] text-ink-3">{d.tempo}</span>
              </figcaption>
              <blockquote className="text-sm text-ink-2">{d.texto}</blockquote>
            </figure>
          ))}
        </section>

        <p className="flex items-start gap-2.5 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
          <span className="mt-px text-brand">
            <Icone nome="relogio" />
          </span>
          {perfil.politicaCancelamento}
        </p>
      </main>

      <footer className="sticky bottom-0 flex items-center gap-2.5 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <b className="text-base tabular-nums">{faixaPreco}</b>
          <span className="text-xs text-ink-3">por aula, cobrado por mês</span>
        </div>
        <BotaoInteresse personal={personal} />
      </footer>
    </div>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <div className="flex flex-col-reverse rounded-[14px] border border-line bg-surface px-1.5 py-2.5 text-center">
      <dt className="text-[11px] leading-tight text-ink-3">{legenda}</dt>
      <dd className="font-display text-lg font-extrabold tabular-nums">{valor}</dd>
    </div>
  );
}
