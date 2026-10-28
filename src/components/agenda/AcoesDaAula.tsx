"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  desistirRemarcacao,
  livresNoDia,
  manterAula,
  marcarAula,
  pedirRemarcacao,
  remarcarAula,
  responderPedido,
  sugerirHorario,
  type DetalheDaAula,
} from "@/data/aulas";
import {
  avisouComAntecedencia,
  COR_SITUACAO,
  naoAcontece,
  ROTULO_ORIGEM,
  ROTULO_SITUACAO,
  situacaoEfetiva,
  textoDeHoras,
} from "@/lib/aula";
import { emBrasilia, minParaHora, opcoesDeHora } from "@/lib/expediente";
import { textoDaAula } from "@/lib/matricula";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_BOTAO_SECUNDARIO, ESTILO_CAIXA } from "../Formulario";
import { Icone } from "../Icone";

type Painel = null | "cancelar" | "remarcar";

/** Uma aula: o que aconteceu com ela (dada, falta, cancelada) e remarcar. */
export function AcoesDaAula({
  aula,
  antecedenciaH,
  agora,
}: {
  aula: DetalheDaAula;
  antecedenciaH: number;
  /** Instante (ISO) em que a página foi montada no servidor. */
  agora: string;
}) {
  const router = useRouter();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const efetiva = situacaoEfetiva(aula.situacao, aula.fim, new Date(agora));
  const jaComecou = Date.parse(aula.inicio) <= Date.parse(agora);
  const marcadaAMao = aula.situacao !== "agendada" && aula.situacao !== "confirmada";
  const duracao = Math.round((Date.parse(aula.fim) - Date.parse(aula.inicio)) / 60_000);
  const primeiro = aula.nome.split(" ")[0];
  // Pedido de remarcação que o personal fez e o aluno ainda não respondeu.
  const meuPedido =
    aula.remarcadaPara?.situacao === "pendente" && aula.remarcadaPara.propostaPor === "personal" ? aula.remarcadaPara : null;
  const decidir = aula.recusaRemarcacao && !jaComecou && (aula.situacao === "agendada" || aula.situacao === "confirmada");

  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      try {
        const r = await acao();
        if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
        setPainel(null);
        depois?.();
        router.refresh();
      } catch {
        setErro("Não foi possível salvar agora. Confira sua internet.");
      }
    });

  return (
    <div className="flex flex-col gap-4 px-[18px] pt-2 pb-6">
      <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-3">{ROTULO_ORIGEM[aula.origem]}</p>
            {aula.vinculoId ? (
              <Link href={`/agenda/alunos/${aula.vinculoId}`} className="text-[19px] font-extrabold hover:text-brand">
                {aula.nome}
              </Link>
            ) : (
              <p className="text-[19px] font-extrabold">{aula.nome}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${COR_SITUACAO[efetiva]}`}>
            {ROTULO_SITUACAO[efetiva].split(" (")[0]}
          </span>
        </div>
        <p className={`text-[16px] font-semibold ${naoAcontece(efetiva) ? "text-ink-3 line-through" : ""}`}>
          {textoDaAula(aula.inicio, aula.local)}
        </p>
        <p className="text-[13px] text-ink-3">
          {emBrasilia(aula.inicio).hora} às {emBrasilia(aula.fim).hora} · {duracao} min
        </p>
        {efetiva !== aula.situacao && efetiva === "realizada" && (
          <p className="text-[13px] text-ink-3">Passou sem marcação, então conta como dada.</p>
        )}
        {aula.situacao === "cancelada_com_aviso" && (
          <p className="text-[13px] text-ink-3">
            {aula.porFeriado
              ? "Cancelada sozinha: feriado em que você não trabalha."
              : `Cancelada ${aula.canceladaPor === "personal" ? "por você" : "pelo aluno, com antecedência"}.`}{" "}
            {primeiro} ganhou uma reposição.
          </p>
        )}
        {aula.situacao === "cancelada_em_cima" && (
          <p className="text-[13px] text-ink-3">Cancelada pelo aluno em cima da hora: conta como dada, sem reposição.</p>
        )}
        {aula.remarcadaPara && !meuPedido && (
          <Link href={`/agenda/aula/${aula.remarcadaPara.id}`} className="text-[14px] font-semibold text-brand">
            {aula.situacao === "remarcada" ? "Remarcada para" : "Pedido de troca para"}{" "}
            {textoDaAula(aula.remarcadaPara.inicio, null)} ›
          </Link>
        )}
        {aula.remarcadaDe && (
          <Link href={`/agenda/aula/${aula.remarcadaDe.id}`} className="text-[13px] text-ink-3">
            {aula.situacao === "pendente" ? "Pedido para trocar a aula de" : "Remarcada de"}{" "}
            {textoDaAula(aula.remarcadaDe.inicio, null)}
          </Link>
        )}
      </section>

      <Aviso>{erro}</Aviso>

      {meuPedido && (
        <section className="flex flex-col gap-2 rounded-[18px] bg-gold-soft p-4 text-gold">
          <p className="text-[15px]">
            Você pediu para remarcar para <strong>{textoDaAula(meuPedido.inicio, null)}</strong>. Aguardando {primeiro}{" "}
            responder; até lá, a aula continua neste horário.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => executar(() => desistirRemarcacao(meuPedido.id))}
            className="self-start text-[14px] font-bold underline"
          >
            Desistir do pedido
          </button>
        </section>
      )}

      {decidir && (
        <section className="flex flex-col gap-3 rounded-[20px] border-2 border-gold bg-gold-soft p-4">
          <p className="text-[15px] text-gold">
            <strong>{primeiro} não aceitou remarcar.</strong> A aula continua marcada neste horário. O que você prefere?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(() => marcarAula(aula.id, "cancelada_com_aviso", "personal"))}
              className="flex min-h-12 items-center justify-center rounded-[14px] bg-bad px-3 text-[15px] font-bold text-white disabled:opacity-60"
            >
              Cancelar aula
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(() => manterAula(aula.id))}
              className={ESTILO_BOTAO_SECUNDARIO}
            >
              Manter aula
            </button>
          </div>
          <p className="text-[13px] text-gold">Cancelando, {primeiro} ganha uma reposição e é avisado.</p>
        </section>
      )}

      {aula.situacao === "pendente" &&
        (aula.propostaPor === "personal" ? (
          <p className="rounded-[14px] bg-gold-soft p-3 text-[14px] text-gold">
            Você sugeriu este horário. Aguardando {primeiro} aceitar ou recusar. Sem resposta, o pedido expira 2 horas antes.
          </p>
        ) : (
          <Pedido
            aula={aula}
            ocupado={ocupado}
            onAceitar={() => executar(() => responderPedido(aula.id, true))}
            onRecusar={(motivo) => executar(() => responderPedido(aula.id, false, motivo))}
            onSugerir={(data, inicioMin) => executar(() => sugerirHorario(aula.id, data, inicioMin))}
            duracao={duracao}
          />
        ))}

      {aula.situacao === "recusada" && (
        <p className="rounded-[14px] bg-surface-2 p-3 text-[14px] text-ink-2">
          Pedido recusado{aula.resposta ? `: ${aula.resposta}` : "."} O horário ficou livre e, se era reposição, ela voltou para{" "}
          {primeiro}.
        </p>
      )}

      {!["remarcada", "pendente", "recusada"].includes(aula.situacao) && (
        <>
          {/* Aula que já passou: só as exceções (falta) ou desfazer. */}
          {jaComecou && !marcadaAMao && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => executar(() => marcarAula(aula.id, "falta"))}
                className={ESTILO_BOTAO_SECUNDARIO}
              >
                Marcar falta
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => executar(() => marcarAula(aula.id, "realizada"))}
                className={ESTILO_BOTAO_SECUNDARIO}
              >
                <Icone nome="certo" className="size-4" /> Confirmar dada
              </button>
            </div>
          )}

          {marcadaAMao && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(() => marcarAula(aula.id, "agendada"))}
              className={ESTILO_BOTAO_SECUNDARIO}
            >
              Desfazer ({jaComecou ? "volta a contar como dada" : "volta a ficar marcada"})
            </button>
          )}

          {!marcadaAMao && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPainel(painel === "cancelar" ? null : "cancelar")}
                aria-expanded={painel === "cancelar"}
                className={`${ESTILO_BOTAO_SECUNDARIO} ${painel === "cancelar" ? "border-ink" : ""}`}
              >
                {jaComecou ? "Foi cancelada" : "Cancelar"}
              </button>
              {!jaComecou && !meuPedido && (
                <button
                  type="button"
                  onClick={() => setPainel(painel === "remarcar" ? null : "remarcar")}
                  aria-expanded={painel === "remarcar"}
                  className={`${ESTILO_BOTAO_SECUNDARIO} ${painel === "remarcar" ? "border-ink" : ""}`}
                >
                  Remarcar
                </button>
              )}
            </div>
          )}

          {painel === "cancelar" && (
            <Cancelar
              aula={aula}
              antecedenciaH={antecedenciaH}
              agora={agora}
              ocupado={ocupado}
              onConfirmar={(situacao, por) => executar(() => marcarAula(aula.id, situacao, por))}
            />
          )}
          {painel === "remarcar" && (
            <Remarcar
              aula={aula}
              duracao={duracao}
              ocupado={ocupado}
              podePedir={aula.alunoComApp}
              onConfirmar={(data, inicioMin, modo) =>
                modo === "pedir"
                  ? executar(() => pedirRemarcacao(aula.id, data, inicioMin))
                  : iniciar(async () => {
                      setErro(null);
                      try {
                        const r = await remarcarAula(aula.id, data, inicioMin);
                        if (!r.ok) return setErro(r.erro);
                        router.replace(`/agenda/calendario?dia=${data}`);
                        router.refresh();
                      } catch {
                        setErro("Não foi possível remarcar agora. Confira sua internet.");
                      }
                    })
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function Cancelar({
  aula,
  antecedenciaH,
  agora,
  ocupado,
  onConfirmar,
}: {
  aula: DetalheDaAula;
  antecedenciaH: number;
  agora: string;
  ocupado: boolean;
  onConfirmar: (situacao: "cancelada_com_aviso" | "cancelada_em_cima", por: "aluno" | "personal") => void;
}) {
  const [por, setPor] = useState<"aluno" | "personal">("aluno");
  // Sugestão pelo relógio de agora; o personal corrige se o aviso chegou antes.
  const [comAntecedencia, setComAntecedencia] = useState(avisouComAntecedencia(aula.inicio, antecedenciaH, new Date(agora)));
  const primeiro = aula.nome.split(" ")[0];
  const prazo = textoDeHoras(antecedenciaH);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <p className="text-[14px] font-bold text-ink-2">Quem cancelou?</p>
      <div className="grid grid-cols-2 gap-2">
        {(["aluno", "personal"] as const).map((q) => (
          <button
            key={q}
            type="button"
            aria-pressed={por === q}
            onClick={() => setPor(q)}
            className={`min-h-11 rounded-[13px] border text-[15px] font-bold ${por === q ? "border-ink bg-ink text-app" : "border-line"}`}
          >
            {q === "aluno" ? primeiro : "Eu"}
          </button>
        ))}
      </div>

      {por === "aluno" ? (
        <div className="flex flex-col gap-2">
          <Opcao
            ativo={comAntecedencia}
            onClick={() => setComAntecedencia(true)}
            titulo={`Avisou com ${prazo} ou mais de antecedência`}
            texto={`${primeiro} ganha uma reposição, válida até o próximo vencimento da mensalidade.`}
          />
          <Opcao
            ativo={!comAntecedencia}
            onClick={() => setComAntecedencia(false)}
            titulo="Em cima da hora"
            texto="Conta como aula dada, sem reposição."
          />
        </div>
      ) : (
        <p className="text-[14px] text-ink-2">
          Quando você cancela, {primeiro} sempre ganha uma reposição, válida até o próximo vencimento da mensalidade.
        </p>
      )}

      <button
        type="button"
        disabled={ocupado}
        onClick={() => onConfirmar(por === "personal" || comAntecedencia ? "cancelada_com_aviso" : "cancelada_em_cima", por)}
        className="flex min-h-[50px] w-full items-center justify-center rounded-[15px] bg-bad px-[18px] font-bold text-white disabled:opacity-60"
      >
        {ocupado ? "Salvando…" : "Confirmar cancelamento"}
      </button>
    </section>
  );
}

function Opcao({ ativo, onClick, titulo, texto }: { ativo: boolean; onClick: () => void; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-[14px] border p-3 text-left ${ativo ? "border-brand bg-brand-soft" : "border-line"}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${ativo ? "border-brand" : "border-ink-3"}`}
      >
        {ativo && <span className="size-2.5 rounded-full bg-brand" />}
      </span>
      <span>
        <span className="block text-[15px] font-bold">{titulo}</span>
        <span className="block text-[13px] text-ink-3">{texto}</span>
      </span>
    </button>
  );
}

function Remarcar({
  aula,
  duracao,
  ocupado,
  onConfirmar,
  rotulo = "Remarcar para",
  podePedir = false,
}: {
  aula: DetalheDaAula;
  duracao: number;
  ocupado: boolean;
  onConfirmar: (data: string, inicioMin: number, modo: "pedir" | "direto") => void;
  /** Texto do botão antes da data: "Remarcar para", "Sugerir". */
  rotulo?: string;
  /** Aluno com app: dá para pedir a ele (decisão de 28/10/2026) ou remarcar direto. */
  podePedir?: boolean;
}) {
  const [modo, setModo] = useState<"pedir" | "direto">(podePedir ? "pedir" : "direto");
  const primeiro = aula.nome.split(" ")[0];
  const [data, setData] = useState(emBrasilia(aula.inicio).data);
  const [hora, setHora] = useState<number | null>(null);
  const [livres, setLivres] = useState<number[] | null>(null);

  useEffect(() => {
    let atual = true;
    livresNoDia(data, duracao, aula.id).then((l) => {
      if (atual) setLivres(l);
    });
    return () => {
      atual = false;
    };
  }, [data, duracao, aula.id]);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      {podePedir && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Como remarcar">
            {(["pedir", "direto"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={`min-h-11 rounded-[13px] border px-2 text-[14.5px] font-bold ${modo === m ? "border-ink bg-ink text-app" : "border-line"}`}
              >
                {m === "pedir" ? `Pedir a ${primeiro}` : "Já combinamos"}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-ink-3">
            {modo === "pedir"
              ? `${primeiro} recebe o pedido e aceita ou recusa. Até lá, a aula fica no horário de agora.`
              : `A aula muda de horário agora. Use quando você já combinou com ${primeiro}.`}
          </p>
        </div>
      )}
      <label htmlFor="rem-data" className="text-[14px] font-bold text-ink-2">
        Para qual dia?
      </label>
      <input
        id="rem-data"
        type="date"
        value={data}
        onChange={(e) => {
          setData(e.target.value);
          setHora(null);
          setLivres(null);
        }}
        className={ESTILO_CAIXA}
      />
      <p className="text-[14px] font-bold text-ink-2">Seus horários livres</p>
      {livres === null ? (
        <p className="text-[13px] text-ink-3">Carregando…</p>
      ) : livres.length === 0 ? (
        <p className="text-[13px] text-ink-3">Nenhum horário livre neste dia. Escolha outro dia ou um horário abaixo.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {livres.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={hora === m}
              onClick={() => setHora(m)}
              className={`rounded-lg px-2.5 py-1.5 text-[15px] font-bold tabular-nums ${hora === m ? "bg-ink text-app" : "bg-brand-soft text-brand"}`}
            >
              {minParaHora(m)}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px] text-ink-3">
        Outro horário:
        <select
          value={hora ?? ""}
          onChange={(e) => setHora(e.target.value === "" ? null : Number(e.target.value))}
          className="min-h-10 rounded-[11px] border border-line bg-surface px-2 text-[15px] tabular-nums text-ink"
        >
          <option value="">—</option>
          {opcoesDeHora(0, 1440 - duracao).map((m) => (
            <option key={m} value={m}>
              {minParaHora(m)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={hora === null || ocupado}
        onClick={() => hora !== null && onConfirmar(data, hora, modo)}
        className={ESTILO_BOTAO_PRINCIPAL}
      >
        {ocupado
          ? "Enviando…"
          : hora === null
            ? "Escolha o horário"
            : `${modo === "pedir" ? "Pedir para" : rotulo} ${data.slice(8, 10)}/${data.slice(5, 7)} às ${minParaHora(hora)}`}
      </button>
    </section>
  );
}

/** Pedido do aluno: aceitar, recusar (com motivo) ou sugerir outro horário. */
function Pedido({
  aula,
  duracao,
  ocupado,
  onAceitar,
  onRecusar,
  onSugerir,
}: {
  aula: DetalheDaAula;
  duracao: number;
  ocupado: boolean;
  onAceitar: () => void;
  onRecusar: (motivo: string) => void;
  onSugerir: (data: string, inicioMin: number) => void;
}) {
  const [modo, setModo] = useState<null | "recusar" | "sugerir">(null);
  const [motivo, setMotivo] = useState("");
  const primeiro = aula.nome.split(" ")[0];
  const tipo = aula.remarcadaDe ? "remarcar a aula" : "uma reposição";

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border-2 border-gold bg-surface p-4">
      <p className="text-[15px]">
        <strong>{primeiro}</strong> pediu {tipo} para este horário.
        {aula.remarcadaDe && " A aula original continua marcada até você aceitar."}
      </p>
      <p className="text-[13px] text-ink-3">Sem resposta, o pedido expira 2 horas antes do horário.</p>
      <button type="button" disabled={ocupado} onClick={onAceitar} className={ESTILO_BOTAO_PRINCIPAL}>
        <Icone nome="certo" className="size-4" /> {ocupado ? "Salvando…" : "Aceitar"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-expanded={modo === "sugerir"}
          onClick={() => setModo(modo === "sugerir" ? null : "sugerir")}
          className={`${ESTILO_BOTAO_SECUNDARIO} ${modo === "sugerir" ? "border-ink" : ""}`}
        >
          Sugerir outro
        </button>
        <button
          type="button"
          aria-expanded={modo === "recusar"}
          onClick={() => setModo(modo === "recusar" ? null : "recusar")}
          className={`${ESTILO_BOTAO_SECUNDARIO} text-bad ${modo === "recusar" ? "border-ink" : ""}`}
        >
          Recusar
        </button>
      </div>
      {modo === "sugerir" && <Remarcar aula={aula} duracao={duracao} ocupado={ocupado} onConfirmar={onSugerir} rotulo="Sugerir" />}
      {modo === "recusar" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="motivo" className="text-[14px] font-bold text-ink-2">
            Motivo (opcional, {primeiro} vai ver)
          </label>
          <input
            id="motivo"
            value={motivo}
            maxLength={200}
            placeholder="Ex.: estou em outra aula longe daí nesse horário"
            onChange={(e) => setMotivo(e.target.value)}
            className={ESTILO_CAIXA}
          />
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRecusar(motivo)}
            className="flex min-h-[50px] w-full items-center justify-center rounded-[15px] bg-bad px-[18px] font-bold text-white disabled:opacity-60"
          >
            {ocupado ? "Salvando…" : "Recusar pedido"}
          </button>
          <p className="text-[13px] text-ink-3">{aula.remarcadaDe ? "A aula original continua marcada." : `A reposição volta para ${primeiro}.`}</p>
        </div>
      )}
    </section>
  );
}
