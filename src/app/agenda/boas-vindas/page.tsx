import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConcluirPrimeiroAcesso } from "@/components/agenda/ConcluirPrimeiroAcesso";
import { FormFeriados } from "@/components/agenda/FormFeriados";
import { FormHorarios } from "@/components/agenda/FormHorarios";
import { FormPix } from "@/components/agenda/FormPix";
import { FormPlanosOnline } from "@/components/agenda/FormPlanosOnline";
import { FormRegras } from "@/components/agenda/FormRegras";
import { FormValores } from "@/components/agenda/FormValores";
import { Carregando, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO } from "@/components/Formulario";
import { lerRegras } from "@/data/aulas";
import { lerPix } from "@/data/cobrancas";
import { exigirPersonal, PRIMEIRO_ACESSO } from "@/data/exigir-personal";
import { lerExpediente } from "@/data/expediente";
import { lerRegraDeFeriados } from "@/data/feriados";
import { lerTabelaDeValores, lerTabelaOnline } from "@/data/precos";
import { agoraEmBrasilia, DURACAO_PADRAO, somarDias } from "@/lib/expediente";
import { feriadosEntre } from "@/lib/feriados";

export const metadata: Metadata = {
  title: "Primeiro acesso",
};

// Primeiro acesso do personal (decisão de 28/10/2026): tudo configurado de uma vez, na
// ordem em que a agenda e as cobranças precisam. Horários, feriados, regras e valores são
// obrigatórios; consultoria online e Pix podem ficar para depois. Tudo muda depois em Conta.
const ETAPAS = [
  { titulo: "Seus horários de trabalho", texto: "Os dias e horários em que você dá aula. Seus alunos só pedem aulas dentro deles." },
  { titulo: "Feriados", texto: "Escolha se você trabalha nos feriados. Dá para abrir exceções." },
  { titulo: "Regras", texto: "Cancelamento, reposição e pausas. Se não souber agora, os valores sugeridos são os mais usados." },
  { titulo: "Valores das aulas", texto: "Quanto custa cada aula presencial. A mensalidade é calculada sozinha." },
  { titulo: "Consultoria online", texto: "Você acompanha alunos a distância (treino e check-ins pelo app)?" },
  { titulo: "Chave Pix", texto: "Para os alunos pagarem direto para você. Pode cadastrar depois, em Financeiro." },
] as const;

const passo = (n: number | "fim") => `${PRIMEIRO_ACESSO}?passo=${n}`;

export default function PaginaPrimeiroAcesso({ searchParams }: PageProps<"/agenda/boas-vindas">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<Carregando />}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/agenda/boas-vindas">["searchParams"] }) {
  const personal = await exigirPersonal(PRIMEIRO_ACESSO);
  const { passo: pedido, online } = await searchParams;
  const fim = pedido === "fim";
  const n = fim ? ETAPAS.length + 1 : Math.min(ETAPAS.length, Math.max(1, Number(pedido) || 1));
  const etapa = ETAPAS[n - 1];
  const proximo = n < ETAPAS.length ? passo(n + 1) : passo("fim");
  const primeiroNome = personal.nomeCompleto.split(" ")[0];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3 px-[18px] pt-6 pb-2">
        {n === 1 && (
          <div className="flex flex-col gap-1 rounded-[20px] bg-deep p-4 text-on-deep">
            <p className="font-display text-[22px] font-extrabold">Bem-vindo ao P-Bell, {primeiroNome}!</p>
            <p className="text-[14.5px] text-on-deep-2">
              Vamos deixar tudo pronto de uma vez: leva uns 3 minutos. Tudo pode ser mudado depois, em Conta.
            </p>
          </div>
        )}
        {!fim && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {ETAPAS.map((_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < n ? "bg-brand" : "bg-line"}`} />
                ))}
              </div>
              <span className="text-[13px] font-semibold text-ink-3 tabular-nums">
                Etapa {n} de {ETAPAS.length}
              </span>
            </div>
            <div className="flex items-start gap-2">
              {n > 1 && (
                <Link href={passo(n - 1)} aria-label="Etapa anterior" className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-2">
                  ‹
                </Link>
              )}
              <div>
                <h1 className="text-[22px] font-extrabold">{etapa.titulo}</h1>
                <p className="text-[14.5px] text-ink-2">{etapa.texto}</p>
              </div>
            </div>
          </>
        )}
      </header>

      {n === 1 && <Horarios proximo={proximo} />}
      {n === 2 && <Feriados proximo={proximo} />}
      {n === 3 && <FormRegras inicial={await lerRegras()} continuar={proximo} />}
      {n === 4 && <FormValores inicial={await lerTabelaDeValores()} continuar={proximo} />}
      {n === 5 && <Online proximo={proximo} querOnline={online === "sim"} />}
      {n === 6 && (
        <>
          <FormPix inicial={await lerPix()} nomeSugerido={personal.nomeCompleto} continuar={proximo} />
          <Link href={proximo} className="mx-[18px] mb-8 text-center text-[15px] font-semibold text-ink-3">
            Cadastrar depois
          </Link>
        </>
      )}
      {fim && (
        <section className="flex flex-col gap-4 px-[18px] pt-6 pb-10">
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Tudo pronto, {primeiroNome}!</h1>
          <p className="text-[15.5px] text-ink-2">
            Agora é só trazer seus alunos: em <strong>Alunos</strong>, convide pelo link no WhatsApp ou cadastre quem não usa o
            app. Quando quiser mudar algo, está tudo em <strong>Conta</strong>.
          </p>
          <ConcluirPrimeiroAcesso />
        </section>
      )}
    </div>
  );
}

async function Horarios({ proximo }: { proximo: string }) {
  const expediente = await lerExpediente();
  return <FormHorarios inicial={expediente ?? { duracao: DURACAO_PADRAO, faixas: [] }} continuar={proximo} />;
}

async function Feriados({ proximo }: { proximo: string }) {
  const hoje = agoraEmBrasilia().data;
  return <FormFeriados inicial={await lerRegraDeFeriados()} feriados={feriadosEntre(hoje, somarDias(hoje, 365))} continuar={proximo} />;
}

async function Online({ proximo, querOnline }: { proximo: string; querOnline: boolean }) {
  const tabela = await lerTabelaOnline();
  if (querOnline || Object.keys(tabela).length > 0) return <FormPlanosOnline inicial={tabela} continuar={proximo} />;
  return (
    <div className="flex flex-col gap-3 px-[18px] pt-2 pb-8">
      <Link href={`${passo(5)}&online=sim`} className={ESTILO_BOTAO_PRINCIPAL}>
        Sim, faço consultoria online
      </Link>
      <Link href={proximo} className={ESTILO_BOTAO_SECUNDARIO}>
        Não faço
      </Link>
      <Link href={proximo} className="text-center text-[15px] font-semibold text-ink-3">
        Configurar depois
      </Link>
    </div>
  );
}
