import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Cabecalho, Carregando } from "@/components/Formulario";
import { LinkWhatsappQuestionario } from "@/components/online/LinkWhatsappQuestionario";
import { ProgramacoesDoAluno } from "@/components/online/ProgramacoesDoAluno";
import { listarMeusAlunos } from "@/data/convites";
import { exigirPersonal } from "@/data/exigir-personal";
import { lerMatricula } from "@/data/matriculas";
import { listarCheckins, listarProgramacoes, listarQuestionarios, type Checkin } from "@/data/questionarios";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia, diaDaSemana, emBrasilia } from "@/lib/expediente";
import { resumoDaModalidade } from "@/lib/matricula";
import { mensagemDoQuestionario, textoDaResposta, type Pergunta } from "@/lib/questionario";
import { origemDoSite } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Acompanhamento online",
};

export default function PaginaAlunoOnline({ params }: PageProps<"/agenda/online/[vinculo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-3xl">
      <Cabecalho titulo="Acompanhamento">
        <BotaoVoltar reserva="/agenda/online" className="hover:bg-surface-2" />
      </Cabecalho>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

const quando = (iso: string) => {
  const { data, hora } = emBrasilia(iso);
  return `${data.slice(8, 10)}/${data.slice(5, 7)} às ${hora}`;
};

async function Conteudo({ params }: { params: PageProps<"/agenda/online/[vinculo]">["params"] }) {
  const { vinculo } = await params;
  await exigirPersonal(`/agenda/online/${vinculo}`);
  const hoje = agoraEmBrasilia().data;
  const [alunos, matricula, questionarios, programacoes, checkins, origem] = await Promise.all([
    listarMeusAlunos(),
    lerMatricula(vinculo),
    listarQuestionarios(),
    listarProgramacoes(vinculo),
    listarCheckins(vinculo),
    origemDoSite(),
  ]);
  const aluno = alunos.find((a) => a.vinculoId === vinculo && a.situacao === "ativo");
  if (!aluno)
    return (
      <div className="flex flex-col gap-3 px-[18px] pt-4 text-[15px] text-ink-2">
        <p>Este aluno não está mais ligado a você.</p>
        <Link href="/agenda/online" className="font-semibold text-brand">
          Ver alunos online
        </Link>
      </div>
    );

  const primeiro = aluno.nome.split(" ")[0];
  const pendentes = checkins.filter((c) => !c.respondidoEm);
  const respondidos = checkins.filter((c) => c.respondidoEm);

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-extrabold">{aluno.nome}</h2>
          <p className="text-[13px] font-bold text-info">{matricula ? resumoDaModalidade(matricula) : "Sem matrícula"}</p>
        </div>
        <Link href={`/agenda/alunos/${vinculo}`} className="text-[14px] font-semibold text-brand">
          Ficha ›
        </Link>
      </header>

      {pendentes.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Questionários pendentes">
          <h2 className="text-[16px] font-semibold">Aguardando resposta</h2>
          {pendentes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-[16px] border border-gold bg-gold-soft p-3">
              <span className="min-w-0 flex-1 text-[15px]">
                <span className="block font-bold text-gold">{c.titulo}</span>
                <span className="block text-[13px] text-ink-2">
                  desde {quando(c.disponivelEm)}
                  {c.enviadoEm ? ` · link enviado em ${quando(c.enviadoEm)}` : " · link ainda não enviado"}
                </span>
              </span>
              <LinkWhatsappQuestionario
                checkinId={c.id}
                enviado={!!c.enviadoEm}
                href={linkWhatsapp(aluno.whatsapp, mensagemDoQuestionario(primeiro, c.titulo, `${origem}/aluno/questionario/${c.id}`))}
              />
            </div>
          ))}
        </section>
      )}

      {aluno.semConta ? (
        // Sem conta, o aluno não tem como abrir o questionário (precisa entrar no Pienel).
        <p className="rounded-[16px] border border-dashed border-line p-3 text-[14px] text-ink-3">
          {primeiro} não usa o app, então não recebe questionários. Para isso, convide-o para ter conta (na ficha do aluno).
        </p>
      ) : (
        <ProgramacoesDoAluno
          vinculoId={vinculo}
          programacoes={programacoes}
          questionarios={questionarios}
          hoje={hoje}
          diaSemanaHoje={diaDaSemana(hoje)}
        />
      )}

      <Evolucao respondidos={respondidos} />

      <section className="flex flex-col gap-2" aria-label="Respostas">
        <h2 className="text-[16px] font-semibold">Respostas</h2>
        {respondidos.length === 0 ? (
          <p className="text-[14px] text-ink-3">{primeiro} ainda não respondeu nenhum questionário.</p>
        ) : (
          respondidos.map((c) => (
            <details key={c.id} className="rounded-[16px] border border-line bg-surface p-3">
              <summary className="cursor-pointer text-[15px] font-bold">
                {c.titulo} <span className="font-normal text-ink-3">· respondido em {quando(c.respondidoEm!)}</span>
              </summary>
              <dl className="mt-3 flex flex-col gap-2 text-[15px]">
                {c.perguntas.map((q) => (
                  <div key={q.id}>
                    <dt className="text-[13px] text-ink-3">{q.texto}</dt>
                    <dd className="font-semibold whitespace-pre-line">{textoDaResposta(q, c.respostas?.[q.id])}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))
        )}
      </section>
    </div>
  );
}

/** Evolução das perguntas de nota e número nas últimas respostas (mais antiga à esquerda). */
function Evolucao({ respondidos }: { respondidos: Checkin[] }) {
  const ultimos = respondidos.slice(0, 8).reverse();
  if (ultimos.length < 2) return null;
  const perguntas = new Map<string, Pergunta>();
  for (const c of ultimos) for (const q of c.perguntas) if (q.tipo === "nota" || q.tipo === "numero") perguntas.set(q.id, q);
  if (perguntas.size === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-label="Evolução">
      <h2 className="text-[16px] font-semibold">Evolução</h2>
      {[...perguntas.values()].map((q) => {
        const valores = ultimos.map((c) => {
          const v = c.respostas?.[q.id];
          return typeof v === "number" ? v : null;
        });
        const maximo = q.tipo === "nota" ? 10 : Math.max(1, ...valores.map((v) => v ?? 0));
        return (
          <div key={q.id} className="rounded-[16px] border border-line bg-surface p-3">
            <p className="text-[13px] text-ink-2">{q.texto}</p>
            <div className="mt-2 flex h-16 items-end gap-1.5">
              {valores.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                  <span className="text-[11.5px] font-bold tabular-nums">{v == null ? "–" : String(v).replace(".", ",")}</span>
                  <span
                    className="w-full rounded-t-[4px] bg-info"
                    style={{ height: `${v == null ? 0 : Math.max(6, (v / maximo) * 44)}px` }}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
