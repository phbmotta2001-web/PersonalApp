import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Carregando } from "@/components/Formulario";
import { lerPainelBeta, type PersonalNoPainel } from "@/data/equipe";
import { linkWhatsapp } from "@/lib/convite";

export const metadata: Metadata = {
  title: "Painel da beta",
};

// Painel da equipe (decisão de 08/11/2026): quem entrou na beta e quem está usando.
// Para quem não é da equipe, a página simplesmente não existe.
export default function PaginaEquipe() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-[18px] pt-6 pb-16">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

const DIA = 86_400_000;

/** "hoje", "ontem", "há 5 dias", "nunca". */
function haQuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - Date.parse(iso)) / DIA);
  return dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** Quem pede atenção: não terminou o primeiro acesso, sumiu há mais de uma semana, ou ainda não tem alunos. */
function situacao(p: PersonalNoPainel): { texto: string; tom: string } {
  if (!p.configurado) return { texto: "parou no primeiro acesso", tom: "bg-gold-soft text-gold" };
  if (!p.ultimoAcesso || Date.now() - Date.parse(p.ultimoAcesso) > 7 * DIA) return { texto: "sumiu há mais de 7 dias", tom: "bg-bad/10 text-bad" };
  if (p.alunosAtivos === 0) return { texto: "ainda sem alunos", tom: "bg-gold-soft text-gold" };
  return { texto: "usando", tom: "bg-ok-soft text-ok" };
}

async function Conteudo() {
  const painel = await lerPainelBeta();
  if (!painel) notFound();
  const t = painel.totais;
  const numeros: [string, number, string?][] = [
    ["Personais", t.personais, `${t.personaisConfigurados} terminaram o primeiro acesso`],
    ["Alunos ativos", t.alunosAtivos, `${t.alunosSemApp} sem app · ${t.convitesPendentes} convites esperando`],
    ["Aulas nos últimos 7 dias", t.aulas7Dias],
    ["Mensalidades pagas em 30 dias", t.cobrancasPagas30Dias],
    ["Pessoas que entraram em 7 dias", t.entraram7Dias, "personais e alunos"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[14px] text-ink-3">Só a equipe vê esta página</p>
        <h1 className="text-[26px] font-extrabold">Painel da beta</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Números da beta">
        {numeros.map(([titulo, valor, detalhe]) => (
          <div key={titulo} className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-4">
            <span className="text-[13px] text-ink-3">{titulo}</span>
            <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">{valor}</span>
            {detalhe && <span className="text-[12.5px] text-ink-3">{detalhe}</span>}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-label="Personais">
        <h2 className="text-[18px] font-bold">Personais ({painel.personais.length})</h2>
        {painel.personais.length === 0 ? (
          <p className="text-ink-3">Nenhum personal ainda. Mande o kit de convite!</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {painel.personais.map((p) => {
              const s = situacao(p);
              return (
                <li key={p.email} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold">{p.nome}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${s.tom}`}>{s.texto}</span>
                    <a
                      href={linkWhatsapp(p.whatsapp, `Oi, ${p.nome.split(" ")[0]}! Tudo bem com o P-Bell?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[14px] font-semibold text-brand"
                    >
                      WhatsApp ›
                    </a>
                  </div>
                  <p className="text-[13px] text-ink-3">
                    {p.email} · entrou {haQuanto(p.criadoEm)} · último acesso {haQuanto(p.ultimoAcesso)}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[14px] sm:grid-cols-5">
                    {[
                      ["Alunos ativos", `${p.alunosAtivos} (${p.alunosComApp} com app)`],
                      ["Convites esperando", p.convitesPendentes],
                      ["Aulas (7 dias)", p.aulas7Dias],
                      ["Próximas (7 dias)", p.aulasProximos7Dias],
                      ["Pagas (30 dias)", p.cobrancasPagas30Dias],
                    ].map(([rotulo, valor]) => (
                      <div key={rotulo} className="flex flex-col">
                        <dt className="text-[12.5px] text-ink-3">{rotulo}</dt>
                        <dd className="font-semibold tabular-nums">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
