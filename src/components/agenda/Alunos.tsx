"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarConvite, criarConvite } from "@/data/convites";
import {
  linkDoConvite,
  linkWhatsapp,
  mensagemDoConvite,
  prazoDoConvite,
  problemasDoConvite,
  type AlunoDaLista,
} from "@/lib/convite";
import { frase } from "@/lib/formato";
import { Avatar, corPorId } from "../Avatar";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

export type FiltroAluno = "atrasados" | "online" | "sem_app" | "pausa" | "sem_aulas";
export type TomEtiqueta = "ok" | "bad" | "neu" | "info" | "gold";

/** O que a lista mostra de cada aluno ativo (montado no servidor). */
export interface DetalheDoAluno {
  /** Ex.: "Seg e Qui às 07:00", "Online · plano trimestral". */
  subtitulo: string;
  etiqueta: { texto: string; tom: TomEtiqueta };
  filtros: FiltroAluno[];
  atrasado: boolean;
}

const FILTROS: { valor: FiltroAluno; rotulo: string }[] = [
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "online", rotulo: "Online" },
  { valor: "sem_app", rotulo: "Sem app" },
  { valor: "pausa", rotulo: "Em pausa" },
  { valor: "sem_aulas", rotulo: "Sem matrícula" },
];

const COR_ETIQUETA: Record<TomEtiqueta, string> = {
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad/10 text-bad",
  neu: "bg-surface-2 text-ink-2",
  info: "bg-info-soft text-info",
  gold: "bg-gold-soft text-gold",
};

/** Sem acento e em minúsculas, para a busca achar "Joao" em "João". */
const simples = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Aba "Alunos" do personal: busca, filtros, lista; convites e "Novo aluno". */
export function Alunos({
  alunos,
  origem,
  detalhes,
}: {
  alunos: AlunoDaLista[];
  origem: string;
  detalhes: Record<string, DetalheDoAluno>;
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(alunos.length === 0);
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroAluno | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ nome: string; whatsapp: string; codigo: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const ativos = alunos.filter((a) => a.situacao === "ativo");
  const contagem = (f: FiltroAluno) => ativos.filter((a) => detalhes[a.vinculoId]?.filtros.includes(f)).length;
  const visiveis = ativos.filter(
    (a) => (!busca.trim() || simples(a.nome).includes(simples(busca.trim()))) && (!filtro || detalhes[a.vinculoId]?.filtros.includes(filtro)),
  );
  const aguardando = alunos.filter((a) => a.situacao === "convidado");
  const antigos = alunos.filter((a) => a.situacao === "expirado" || a.situacao === "cancelado" || a.situacao === "encerrado");
  const problemas = problemasDoConvite(nome, whatsapp);

  function convidar(dados: { nome: string; whatsapp: string }) {
    iniciar(async () => {
      const r = await criarConvite(dados.nome, dados.whatsapp);
      if (!r.ok) return setErro(r.erro);
      setNovo({ ...dados, codigo: r.codigo });
      setNome("");
      setWhatsapp("");
      setTentou(false);
      setAbrindo(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5 px-[18px] pt-2 pb-6">
      {novo && (
        <section className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-brand bg-surface p-4">
          <p className="font-bold">Convite criado para {novo.nome}</p>
          <p className="text-[14px] text-ink-3">
            Envie o link para o aluno. Ele vale por 14 dias e serve só para essa pessoa.
          </p>
          <BotoesDoLink nome={novo.nome} whatsapp={novo.whatsapp} link={linkDoConvite(origem, novo.codigo)} />
          <button type="button" onClick={() => setNovo(null)} className="self-start text-[14px] font-semibold text-ink-3">
            Fechar
          </button>
        </section>
      )}

      {abrindo ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTentou(true);
            if (problemas.length === 0) convidar({ nome, whatsapp });
          }}
          className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4"
        >
          <h2 className="text-[17px] font-semibold">Convidar aluno</h2>
          <Campo id="cv-nome" rotulo="Nome do aluno" ajuda="Como você chama o aluno. Ele confirma o nome completo no cadastro.">
            <input
              id="cv-nome"
              maxLength={80}
              value={nome}
              onChange={(e) => {
                setErro(null);
                setNome(e.target.value);
              }}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <Campo id="cv-whatsapp" rotulo="WhatsApp do aluno" opcional ajuda="Para abrir a conversa com ele já com a mensagem pronta.">
            <input
              id="cv-whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="(21) 99999-0000"
              value={whatsapp}
              onChange={(e) => {
                setErro(null);
                setWhatsapp(e.target.value);
              }}
              className={ESTILO_CAIXA}
            />
          </Campo>
          <Aviso>{erro ?? (tentou && problemas.length > 0 ? frase(problemas) : null)}</Aviso>
          <button type="submit" disabled={ocupado} className={ESTILO_BOTAO_PRINCIPAL}>
            {ocupado ? "Criando…" : "Criar link de convite"}
          </button>
          {alunos.length > 0 && (
            <button type="button" onClick={() => setAbrindo(false)} className="text-[14px] font-semibold text-ink-3">
              Cancelar
            </button>
          )}
        </form>
      ) : (
        escolhendo && (
          <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4" aria-label="Novo aluno">
            <h2 className="text-[17px] font-semibold">Novo aluno</h2>
            <button
              type="button"
              onClick={() => {
                setEscolhendo(false);
                setAbrindo(true);
              }}
              className={ESTILO_BOTAO_PRINCIPAL}
            >
              <Icone nome="enviar" className="size-4" /> Convidar pelo link
            </button>
            <p className="-mt-1 text-[13px] text-ink-3">O aluno cria a conta dele e vê aulas, avisos e pagamentos no app.</p>
            <Link href="/agenda/alunos/novo" className={ESTILO_BOTAO_SECUNDARIO + " text-[15px]"}>
              Cadastrar quem não usa o app
            </Link>
            <p className="-mt-1 text-[13px] text-ink-3">Você cuida da agenda e das cobranças dele (ex.: aluno menor de idade).</p>
            <button type="button" onClick={() => setEscolhendo(false)} className="text-[14px] font-semibold text-ink-3">
              Cancelar
            </button>
          </section>
        )
      )}

      <section className="flex flex-col gap-2.5" aria-label="Alunos ativos">
        {ativos.length > 0 && (
          <>
            <label className="flex min-h-11 items-center gap-2 rounded-[13px] border border-line bg-surface px-3.5 text-ink-3">
              <Icone nome="busca" className="size-[18px]" />
              <span className="sr-only">Buscar aluno</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar aluno"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
              />
            </label>
            <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1" role="group" aria-label="Filtrar alunos">
              <Chip ativo={filtro === null} onClick={() => setFiltro(null)}>
                Todos {ativos.length}
              </Chip>
              {FILTROS.filter((f) => contagem(f.valor) > 0).map((f) => (
                <Chip key={f.valor} ativo={filtro === f.valor} onClick={() => setFiltro(filtro === f.valor ? null : f.valor)}>
                  {f.rotulo} {contagem(f.valor)}
                </Chip>
              ))}
            </div>
          </>
        )}
        {ativos.length === 0 ? (
          <p className="text-[15px] text-ink-3">Nenhum aluno ainda. Toque em &quot;Novo aluno&quot; para convidar ou cadastrar.</p>
        ) : visiveis.length === 0 ? (
          <p className="text-[15px] text-ink-3">Nenhum aluno com esse filtro.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-3.5">
            {visiveis.map((a) => {
              const d = detalhes[a.vinculoId];
              return (
                <li key={a.vinculoId}>
                  <Link href={`/agenda/alunos/${a.vinculoId}`} className="flex items-center gap-3 py-2.5">
                    <Avatar nome={a.nome} cor={corPorId(a.vinculoId)} tamanho="pequeno" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[16px] font-bold ${d?.atrasado ? "text-bad" : ""}`}>{a.nome}</span>
                      <span className="block truncate text-[14px] text-ink-3">{d?.subtitulo}</span>
                    </span>
                    {d && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-bold ${COR_ETIQUETA[d.etiqueta.tom]}`}>
                        {d.etiqueta.texto}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!abrindo && !escolhendo && (
        <button
          type="button"
          onClick={() => {
            setEscolhendo(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="botao-macio fixed right-[max(18px,calc(50vw-14rem+18px))] bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 flex items-center gap-1.5 rounded-full bg-brand px-4 py-3 text-[15px] font-extrabold text-brand-ink"
        >
          <Icone nome="mais" className="size-4" /> Novo aluno
        </button>
      )}

      {aguardando.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Convites aguardando ({aguardando.length})</h2>
          <ul className="flex flex-col gap-2.5">
            {aguardando.map((a) => (
              <li key={a.vinculoId} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{a.nome}</span>
                  <span className="text-[13px] text-ink-3">{prazoDoConvite(a.expiraEm)}</span>
                </div>
                {a.codigo && <BotoesDoLink nome={a.nome} whatsapp={a.whatsapp ?? ""} link={linkDoConvite(origem, a.codigo)} />}
                <CancelarConvite
                  aoCancelar={() =>
                    iniciar(async () => {
                      const r = await cancelarConvite(a.vinculoId);
                      if (!r.ok) setErro(r.erro);
                      router.refresh();
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {antigos.length > 0 && (
        <details className="rounded-[20px] border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[15px] font-bold">Convites vencidos e ex-alunos ({antigos.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {antigos.map((a) => (
              <li key={a.vinculoId} className="flex items-center gap-3 py-2.5 text-[15px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.nome}</span>
                  <span className="block text-[13px] text-ink-3">
                    {a.situacao === "expirado"
                      ? "Convite vencido"
                      : a.situacao === "cancelado"
                        ? "Convite cancelado"
                        : a.encerradoPor === "exclusao"
                          ? "Aluno excluiu a conta"
                          : a.encerradoPor === "aluno"
                            ? "Aluno encerrou o vínculo"
                            : "Vínculo encerrado por você"}
                  </span>
                </span>
                {a.situacao !== "encerrado" || a.encerradoPor !== "exclusao" ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => convidar({ nome: a.nome, whatsapp: a.whatsapp ?? "" })}
                    className="shrink-0 text-[14px] font-semibold text-brand"
                  >
                    Novo convite
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** "Enviar pelo WhatsApp" e "Copiar link". */
export function BotoesDoLink({ nome, whatsapp, link }: { nome: string; whatsapp: string; link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        href={linkWhatsapp(whatsapp, mensagemDoConvite(nome, link))}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] bg-brand px-3 text-[14px] font-bold text-brand-ink"
      >
        <Icone nome="conversa" className="size-4" /> Enviar pelo WhatsApp
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {
            window.prompt("Copie o link:", link);
          }
        }}
        className={ESTILO_BOTAO_SECUNDARIO + " min-h-11 text-[14px]"}
      >
        {copiado ? "Link copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

function CancelarConvite({ aoCancelar }: { aoCancelar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return confirmando ? (
    <span className="flex gap-4 text-[14px] font-bold">
      <button type="button" onClick={() => setConfirmando(false)} className="text-ink-3">
        Manter convite
      </button>
      <button type="button" onClick={aoCancelar} className="text-bad">
        Cancelar convite
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirmando(true)} className="self-start text-[14px] font-semibold text-ink-3">
      Cancelar convite
    </button>
  );
}
