import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EncerrarVinculo } from "@/components/agenda/EncerrarVinculo";
import { AbasAluno } from "@/components/aluno/AbasAluno";
import { Avatar } from "@/components/Avatar";
import { Carregando } from "@/components/Formulario";
import { Icone } from "@/components/Icone";
import { listarMeusPersonais } from "@/data/convites";
import { exigirAluno } from "@/data/exigir-aluno";
import { AulasDoAluno } from "@/components/aluno/AulasDoAluno";
import { CobrancasDoAluno } from "@/components/aluno/CobrancasDoAluno";
import { regrasParaAluno } from "@/data/aluno-aulas";
import { reposicoesDisponiveis } from "@/data/aulas";
import { cobrancasDoAluno, pixDaCobranca, pixParaAluno } from "@/data/cobrancas";
import { lerMatricula, pedidosRecusadosDoAluno, proximasAulasDoAluno } from "@/data/matriculas";
import { linkWhatsapp } from "@/lib/convite";
import { agoraEmBrasilia } from "@/lib/expediente";
import { resumoDosHorarios } from "@/lib/matricula";
import { formatarWhatsapp } from "@/lib/personal";

export const metadata: Metadata = {
  title: "Meu personal",
};

export default function PaginaMeuPersonal({ params }: PageProps<"/aluno/personal/[vinculo]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  );
}

// Uma aba por personal ligado ao aluno.
async function Conteudo({ params }: { params: PageProps<"/aluno/personal/[vinculo]">["params"] }) {
  const { vinculo } = await params;
  await exigirAluno(`/aluno/personal/${vinculo}`);
  const personais = await listarMeusPersonais();
  const p = personais.find((x) => x.vinculoId === vinculo);

  if (!p)
    return (
      <>
        <AbasAluno personais={personais} ativa="" />
        <div className="flex flex-col gap-3 px-[18px] pt-4 text-sm text-ink-2">
          <p>Você não está mais ligado a este personal.</p>
          <Link href="/aluno" className="font-semibold text-brand">
            Voltar para a minha área
          </Link>
        </div>
      </>
    );

  const primeiro = p.nome.split(" ")[0];
  const [matricula, aulas, reposicoes, regras, recusados, cobrancas, pixDoPersonal] = await Promise.all([
    lerMatricula(vinculo),
    proximasAulasDoAluno(vinculo),
    reposicoesDisponiveis(vinculo),
    regrasParaAluno(vinculo),
    pedidosRecusadosDoAluno(vinculo),
    cobrancasDoAluno(vinculo),
    pixParaAluno(vinculo),
  ]);
  const hoje = agoraEmBrasilia().data;
  const pixPorCobranca = Object.fromEntries(
    (
      await Promise.all(
        cobrancas.filter((c) => c.situacao === "aberta").map(async (c) => [c.id, await pixDaCobranca(pixDoPersonal, c)] as const),
      )
    ).filter((par): par is readonly [string, { codigo: string; qrSvg: string }] => par[1] !== null),
  );

  return (
    <>
      <AbasAluno personais={personais} ativa={p.vinculoId} />
      <div className="flex flex-col gap-5 px-[18px] pt-3 pb-6">
        <div className="flex items-center gap-3 rounded-[20px] bg-deep p-4 text-on-deep">
          <Avatar nome={p.nome} cor="av1" />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-extrabold">{p.nome}</p>
            <p className="text-[13px] text-on-deep-2">
              Seu personal desde {new Date(p.aceitoEm).toLocaleDateString("pt-BR")} · CREF {p.cref}
            </p>
          </div>
        </div>

        <a
          href={linkWhatsapp(p.whatsapp, `Oi, ${primeiro}!`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border border-line bg-surface px-3 text-[13px] font-bold"
        >
          <Icone nome="conversa" className="size-4" /> Mensagem no WhatsApp · {formatarWhatsapp(p.whatsapp)}
        </a>

        {matricula ? (
          <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
            <div>
              <p className="text-xs font-semibold text-ink-3">Seus horários</p>
              <p className="text-[17px] font-extrabold">{resumoDosHorarios(matricula.horarios)}</p>
              <p className="text-[13px] text-ink-2">
                {[`Aulas de ${matricula.duracao} min`, matricula.local].filter(Boolean).join(" · ")}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-[20px] border border-dashed border-line p-4 text-[13px] text-ink-3">
            {primeiro} ainda não marcou seus horários fixos. Quando marcar, suas aulas aparecem aqui.
          </section>
        )}

        {(aulas.length > 0 || reposicoes.length > 0 || recusados.length > 0) && (
          <section className="rounded-[20px] border border-line bg-surface p-4">
            <AulasDoAluno
              vinculoId={vinculo}
              nomePersonal={p.nome}
              aulas={aulas.map((a) => ({
                id: a.id,
                inicio: a.inicio,
                local: a.local,
                origem: a.origem,
                situacao: a.situacao,
                propostaPor: a.propostaPor,
                aulaOriginalId: a.aulaOriginalId,
              }))}
              recusados={recusados}
              reposicoes={reposicoes.map((r) => r.validoAte)}
              regras={regras}
              agora={new Date().toISOString()}
            />
          </section>
        )}

        {cobrancas.length > 0 && (
          <section className="rounded-[20px] border border-line bg-surface p-4">
            <CobrancasDoAluno cobrancas={cobrancas} pix={pixPorCobranca} nomePersonal={p.nome} hoje={hoje} />
          </section>
        )}

        <p className="text-xs text-ink-3">
          {primeiro} vê o seu perfil completo (objetivo, nível, restrições, medidas, endereço e WhatsApp), sua idade e o
          dia do seu aniversário. Nunca o seu e-mail.
        </p>

        <EncerrarVinculo
          vinculoId={p.vinculoId}
          depois="/aluno"
          aviso={`Ao encerrar, ${primeiro} deixa de ver o seu cadastro e você sai da lista de alunos dele. Sua conta continua existindo.`}
        />
      </div>
    </>
  );
}
