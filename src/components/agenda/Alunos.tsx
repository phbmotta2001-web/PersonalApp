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
import { textoDaAula } from "@/lib/matricula";
import { Avatar } from "../Avatar";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

/** Lista de alunos do personal + "Convidar aluno". */
export function Alunos({
  alunos,
  origem,
  proximas,
}: {
  alunos: AlunoDaLista[];
  origem: string;
  /** Próxima aula de cada aluno ativo, por vínculo. */
  proximas: Record<string, { inicio: string; local: string | null }>;
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(alunos.length === 0);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ nome: string; whatsapp: string; codigo: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const ativos = alunos.filter((a) => a.situacao === "ativo");
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
    <div className="flex flex-col gap-6 px-[18px] pt-2 pb-6">
      {novo && (
        <section className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-brand bg-surface p-4">
          <p className="font-bold">Convite criado para {novo.nome}</p>
          <p className="text-[13px] text-ink-3">
            Envie o link para o aluno. Ele vale por 14 dias e serve só para essa pessoa.
          </p>
          <BotoesDoLink nome={novo.nome} whatsapp={novo.whatsapp} link={linkDoConvite(origem, novo.codigo)} />
          <button type="button" onClick={() => setNovo(null)} className="self-start text-[13px] font-semibold text-ink-3">
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
            <button type="button" onClick={() => setAbrindo(false)} className="text-[13px] font-semibold text-ink-3">
              Cancelar
            </button>
          )}
        </form>
      ) : (
        <button type="button" onClick={() => setAbrindo(true)} className={ESTILO_BOTAO_PRINCIPAL}>
          <Icone nome="mais" className="size-4" /> Convidar aluno
        </button>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[17px] font-semibold">Alunos ativos ({ativos.length})</h2>
        {ativos.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum aluno ainda. Convide seus alunos para o Pienel.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
            {ativos.map((a) => (
              <li key={a.vinculoId}>
                <Link href={`/agenda/alunos/${a.vinculoId}`} className="flex flex-col gap-2 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar nome={a.nome} cor="av6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.nome}</span>
                      <span className="block text-[12.5px] text-ink-3">
                        Aluno desde {new Date(a.aceitoEm ?? a.criadoEm).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <span className="text-ink-3" aria-hidden="true">›</span>
                  </span>
                  {proximas[a.vinculoId] ? (
                    <span className="flex items-start gap-2 rounded-[12px] bg-brand-soft px-3 py-2 text-[12.5px] text-brand">
                      <Icone nome="calendario" className="mt-px size-4 shrink-0" />
                      <span>
                        <strong>Próxima aula:</strong> {textoDaAula(proximas[a.vinculoId].inicio, proximas[a.vinculoId].local)}
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-[12px] border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-3">
                      Sem aulas marcadas. Toque para criar a matrícula.
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aguardando.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Convites aguardando ({aguardando.length})</h2>
          <ul className="flex flex-col gap-2.5">
            {aguardando.map((a) => (
              <li key={a.vinculoId} className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{a.nome}</span>
                  <span className="text-xs text-ink-3">{prazoDoConvite(a.expiraEm)}</span>
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
          <summary className="cursor-pointer text-sm font-bold">Convites vencidos e ex-alunos ({antigos.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {antigos.map((a) => (
              <li key={a.vinculoId} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.nome}</span>
                  <span className="block text-xs text-ink-3">
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
                    className="shrink-0 text-[13px] font-semibold text-brand"
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
function BotoesDoLink({ nome, whatsapp, link }: { nome: string; whatsapp: string; link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-2">
      <a
        href={linkWhatsapp(whatsapp, mensagemDoConvite(nome, link))}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] bg-brand px-3 text-[13px] font-bold text-brand-ink"
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
        className={ESTILO_BOTAO_SECUNDARIO + " min-h-11 text-[13px]"}
      >
        {copiado ? "Link copiado!" : "Copiar link"}
      </button>
    </div>
  );
}

function CancelarConvite({ aoCancelar }: { aoCancelar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return confirmando ? (
    <span className="flex gap-4 text-[13px] font-bold">
      <button type="button" onClick={() => setConfirmando(false)} className="text-ink-3">
        Manter convite
      </button>
      <button type="button" onClick={aoCancelar} className="text-bad">
        Cancelar convite
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirmando(true)} className="self-start text-[13px] font-semibold text-ink-3">
      Cancelar convite
    </button>
  );
}
