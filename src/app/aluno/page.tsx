import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarraDoAluno } from "@/components/aluno/BarraDoAluno";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { Avatar, corPorId } from "@/components/Avatar";
import { InstalarApp } from "@/components/InstalarApp";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { cobrancasDoAluno } from "@/data/cobrancas";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { matriculasSuspensas, proximasAulasDoAluno } from "@/data/matriculas";
import { checkinsPendentesDoAluno } from "@/data/questionarios";
import { faltaNoPerfil, perfilCompleto } from "@/lib/aluno";
import { situacaoDaCobranca, textoDoVencimento } from "@/lib/cobranca";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia, emBrasilia, somarDias } from "@/lib/expediente";
import { juntarComE } from "@/lib/formato";
import { centavosParaReais, textoDaAula } from "@/lib/matricula";

export const metadata: Metadata = {
  title: "Minha área",
};

export default function PaginaAluno() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
      <BarraDoAluno />
    </div>
  );
}

// Aba "Início" do aluno (redesign "Foco no hoje", 22/10/2026): a próxima aula, a
// matrícula a vencer, os questionários e o contato do personal.
async function Conteudo() {
  const conta = await exigirAluno("/aluno");
  const hoje = agoraEmBrasilia().data;
  const agora = new Date();
  const [personais, suspensas] = await Promise.all([listarMeusPersonais(), matriculasSuspensas()]);
  const porPersonal = await Promise.all(
    personais.map(async (p) => {
      const [aulas, cobrancas, questionarios] = await Promise.all([
        proximasAulasDoAluno(p.vinculoId, 4),
        cobrancasDoAluno(p.vinculoId),
        checkinsPendentesDoAluno(p.vinculoId),
      ]);
      return { p, aulas, cobrancas, questionarios };
    }),
  );
  const nomeDe = (vinculo: string | null) => personais.find((p) => p.vinculoId === vinculo)?.nome.split(" ")[0] ?? "seu personal";

  const aulas = porPersonal.flatMap((x) => x.aulas).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const proxima = aulas.find((a) => a.situacao === "agendada" || a.situacao === "confirmada");
  const sugestoes = aulas.filter((a) => a.situacao === "pendente" && a.propostaPor === "personal");
  // Mensalidades em aberto que vencem em até 7 dias (ou já venceram).
  const cobrancas = porPersonal
    .flatMap((x) => x.cobrancas.map((c) => ({ ...c, personal: x.p.nome.split(" ")[0] })))
    .filter((c) => c.situacao === "aberta" && c.vencimento <= somarDias(hoje, 7))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const questionarios = porPersonal.flatMap((x) => x.questionarios.map((q) => ({ ...q, personal: x.p.nome.split(" ")[0] })));

  // "Começa em 25 min", "Hoje às 18:00", "Amanhã às 07:00", "qui, 23/10 às 07:00"
  const quando = (inicio: string) => {
    const ms = Date.parse(inicio) - agora.getTime();
    if (ms < 2 * 3_600_000) return `Começa em ${Math.max(1, Math.round(ms / 60_000))} min`;
    const d = emBrasilia(inicio);
    if (d.data === hoje) return `Hoje às ${d.hora}`;
    if (d.data === somarDias(hoje, 1)) return `Amanhã às ${d.hora}`;
    return textoDaAula(inicio, null);
  };

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-5 pb-28">
      <header>
        <p className="text-[14px] text-ink-3">Minha área</p>
        <h1 className="text-[24px] font-extrabold">Olá, {conta.perfil.nomeCompleto.split(" ")[0]}</h1>
      </header>

      {personais
        .filter((p) => suspensas[p.vinculoId])
        .map((p) => (
          <Link
            key={p.vinculoId}
            href="/aluno/pagamentos"
            role="alert"
            className="flex items-center gap-3 rounded-[20px] border-2 border-bad bg-bad/5 p-4"
          >
            <Icone nome="cadeado" className="size-6 shrink-0 text-bad" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold text-bad">Matrícula suspensa</span>
              <span className="block text-[14px] text-ink-2">
                Sua matrícula com {p.nome.split(" ")[0]} venceu sem pagamento. Pague para liberar suas aulas.
              </span>
            </span>
            <span className="rounded-[11px] bg-bad px-3 py-2 text-[14px] font-bold text-white">Pagar</span>
          </Link>
        ))}

      <InstalarApp />
      <AtivarNotificacoes texto="Receba o lembrete 1 hora antes da aula, as respostas do seu personal e o aviso de vencimento da matrícula." />

      {!perfilCompleto(conta) && (
        <section className="rounded-[20px] bg-gold-soft p-4 text-[14.5px] text-gold">
          <p className="font-bold">Complete seu perfil</p>
          <p className="mt-1">
            Falta {juntarComE(faltaNoPerfil(conta))}. Sem isso, você não consegue aceitar convites de personais.
          </p>
          <Link href="/perfil" className="mt-2 inline-block font-semibold underline">
            Completar agora
          </Link>
        </section>
      )}

      {personais.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-line p-6 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
            <Icone nome="calendario" />
          </span>
          <p className="font-bold">Você ainda não treina com nenhum personal pelo P-Bell</p>
          <p className="text-[14px] text-ink-3">Peça o link de convite ao seu personal.</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[24px] bg-deep p-5 text-on-deep" aria-label="Próxima aula">
            {proxima ? (
              <>
                <div>
                  <p className="text-[14px] text-on-deep-2">Sua próxima aula · {quando(proxima.inicio)}</p>
                  <p className="font-display text-[30px] leading-tight font-extrabold">
                    {textoDaAula(proxima.inicio, null).replace(" às ", ", ")}
                  </p>
                  <p className="text-[14px] text-on-deep-2">
                    com {nomeDe(proxima.vinculoId)}
                    {proxima.local ? ` · ${proxima.local}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/aluno/aulas"
                    className="flex min-h-12 items-center justify-center rounded-[14px] bg-on-deep text-[14.5px] font-bold text-deep"
                  >
                    Remarcar
                  </Link>
                  <Link
                    href="/aluno/aulas"
                    className="flex min-h-12 items-center justify-center rounded-[14px] border border-on-deep/30 text-[14.5px] font-bold"
                  >
                    Cancelar
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="font-display text-[20px] font-extrabold">Nenhuma aula marcada</p>
                <p className="text-[14px] text-on-deep-2">Quando seu personal marcar seus horários, a próxima aula aparece aqui.</p>
              </>
            )}
          </section>

          {sugestoes.map((a) => (
            <Link
              key={a.id}
              href="/aluno/aulas"
              className="flex items-center gap-3 rounded-[20px] border-2 border-gold bg-gold-soft p-4"
            >
              <Icone nome="calendario" className="size-5 shrink-0 text-gold" />
              <span className="min-w-0 flex-1 text-[14.5px]">
                <strong className="text-gold">
                  {nomeDe(a.vinculoId)} {a.aulaOriginalId ? "pediu para remarcar sua aula" : "sugeriu outro horário"}
                </strong>
                <span className="block text-ink-2">{textoDaAula(a.inicio, null)} · toque para responder</span>
              </span>
            </Link>
          ))}

          {cobrancas.map((c) => {
            const atrasada = situacaoDaCobranca(c, hoje) === "atrasada";
            return (
              <section
                key={c.id}
                className={`flex flex-col gap-2.5 rounded-[20px] border p-4 ${atrasada ? "border-bad bg-bad/5" : "border-line bg-surface"}`}
                aria-label="Matrícula"
              >
                <p className="flex items-start gap-2 text-[15px]">
                  <Icone nome="dinheiro" className={`mt-0.5 size-5 shrink-0 ${atrasada ? "text-bad" : "text-gold"}`} />
                  <span className="flex-1">
                    <strong className={atrasada ? "text-bad" : ""}>
                      Sua matrícula {textoDoVencimento(c.vencimento, hoje).split(" (")[0]}
                    </strong>
                    <span className="block text-[14px] text-ink-2">
                      {centavosParaReais(c.valorCentavos)} · {c.personal}
                    </span>
                  </span>
                </p>
                {c.alunoAvisouEm ? (
                  <p className="text-[14px] text-ink-3">Você avisou que pagou. {c.personal} confere e confirma.</p>
                ) : (
                  <Link
                    href="/aluno/pagamentos"
                    className="botao-macio flex min-h-11 items-center justify-center rounded-[13px] bg-brand text-[15px] font-bold text-brand-ink"
                  >
                    Pagar com Pix
                  </Link>
                )}
              </section>
            );
          })}

          {questionarios.map((q) => (
            <Link
              key={q.id}
              href={`/aluno/questionario/${q.id}`}
              className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info-soft text-info">
                <Icone nome="conversa" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{q.titulo}</span>
                <span className="block text-[13px] text-ink-3">{q.personal} está esperando suas respostas. Leva uns 2 minutos.</span>
              </span>
              <span className="rounded-[11px] bg-brand px-3 py-2 text-[14px] font-bold text-brand-ink">Responder</span>
            </Link>
          ))}

          <section className="flex flex-col gap-2" aria-label={personais.length > 1 ? "Seus personais" : "Seu personal"}>
            <h2 className="text-[13px] font-extrabold tracking-[0.06em] text-ink-3 uppercase">
              {personais.length > 1 ? "Seus personais" : "Seu personal"}
            </h2>
            {personais.map((p) => (
              <div key={p.vinculoId} className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-3">
                <Avatar nome={p.nome} cor={corPorId(p.vinculoId)} tamanho="pequeno" />
                <Link href={`/aluno/personal/${p.vinculoId}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">{p.nome}</span>
                  <span className="block text-[13px] text-ink-3">CREF {p.cref} · ver detalhes ›</span>
                </Link>
                <a
                  href={linkWhatsapp(p.whatsapp, `Oi, ${p.nome.split(" ")[0]}!`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp de ${p.nome.split(" ")[0]}`}
                  className="grid size-10 place-items-center rounded-full border border-line bg-surface text-brand"
                >
                  <Icone nome="conversa" className="size-5" />
                </a>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
