"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  arquivarFormularioDoEstudio,
  enviarFormularioDoEstudio,
  respostasDoFormulario,
  salvarFormularioDoEstudio,
  type EnvioDeFormulario,
  type FormularioDoEstudio,
  type RespostaDeFormulario,
} from "@/data/formularios-estudio";
import { enviarFormularioDoPersonal, respostasDoFormularioDoPersonal, salvarFormularioDoPersonal } from "@/data/formularios-personal";
import { linkWhatsapp } from "@/lib/convite";
import { dataCurta, emBrasilia } from "@/lib/expediente";
import { novoIdPergunta } from "@/lib/questionario";
import { EditorQuestionario } from "../online/EditorQuestionario";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL } from "../Formulario";
import { Icone } from "../Icone";
import { RespostasDoFormulario } from "./RespostasDoAluno";

const AJUDA_PERSONAL: Record<FormularioDoEstudio["tipo"], string> = {
  parq: "Padrão do P-Bell. Todo aluno novo recebe ao entrar no app pelo seu convite.",
  anamnese: "Padrão do P-Bell. Todo aluno novo recebe junto com o ParQ; as respostas ficam na ficha dele.",
  pesquisa: "",
};
const AJUDA: Record<FormularioDoEstudio["tipo"], string> = {
  parq: "Padrão do P-Bell. Todo aluno novo recebe ao entrar no app, inclusive na aula experimental.",
  anamnese: "Padrão do P-Bell. Todo aluno novo recebe junto com o ParQ; o professor da experimental vê antes da aula.",
  pesquisa: "",
};

/**
 * Decisão 97: aba Formulários da coordenação. Decisão 105: a mesma tela serve ao personal
 * autônomo (`personal`: só ParQ e anamnese, enviados aos alunos dele com o app).
 * Decisão 97 (coordenação): ParQ e anamnese padrão (editáveis), pesquisas
 * novas, envio para todos ou alunos escolhidos (aviso no app e link no WhatsApp) e as respostas.
 */
export function FormulariosDoEstudio({
  estudioId,
  estudio,
  formularios,
  alunos,
  personal = false,
}: {
  /** Vazio no personal. */
  estudioId: string;
  /** Nome do estúdio (ou do personal), para a mensagem do WhatsApp. */
  estudio: string;
  personal?: boolean;
  formularios: FormularioDoEstudio[];
  /** Alunos ativos, em ordem alfabética. */
  alunos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<FormularioDoEstudio | "novo" | null>(null);

  if (editando) {
    const f = editando === "novo" ? null : editando;
    const terminar = () => {
      setEditando(null);
      router.refresh();
    };
    return (
      <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface pt-3">
        <button type="button" onClick={() => setEditando(null)} className="flex items-center gap-1 self-start px-[18px] text-[14px] font-bold text-brand">
          <Icone nome="voltar" className="size-4" /> Formulários
        </button>
        <EditorQuestionario
          id={f?.id ?? null}
          nomeInicial={f?.nome ?? ""}
          perguntasIniciais={f?.perguntas ?? [{ id: novoIdPergunta(), tipo: "nota", texto: "", obrigatoria: true }]}
          palavra="formulário"
          salvar={(nome, perguntas) =>
            personal && f ? salvarFormularioDoPersonal(f.id, nome, perguntas) : salvarFormularioDoEstudio(estudioId, f?.id ?? null, nome, perguntas)
          }
          apagar={f && f.tipo === "pesquisa" ? () => arquivarFormularioDoEstudio(f.id) : null}
          terminar={terminar}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-ink-2">
        {personal
          ? "O aluno responde no app e as respostas ficam na ficha dele. Aluno sem o app não recebe."
          : "Só a coordenação cria e edita. O aluno responde no app; você e os professores dele veem as respostas na ficha do aluno."}
      </p>
      {formularios.map((f) => (
        <CartaoDoFormulario key={f.id} f={f} estudio={estudio} alunos={alunos} editar={() => setEditando(f)} personal={personal} />
      ))}
      {!personal && (
      <button
        type="button"
        onClick={() => setEditando("novo")}
        className="flex min-h-12 items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-brand text-[15px] font-bold text-brand"
      >
        <Icone nome="mais" className="size-4" /> Novo formulário (pesquisa)
      </button>
      )}
    </div>
  );
}

function CartaoDoFormulario({
  f,
  estudio,
  alunos,
  editar,
  personal,
}: {
  f: FormularioDoEstudio;
  estudio: string;
  alunos: { id: string; nome: string }[];
  editar: () => void;
  personal: boolean;
}) {
  const router = useRouter();
  const [painel, setPainel] = useState<"enviar" | "respostas" | null>(null);
  const [todos, setTodos] = useState(true);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [enviados, setEnviados] = useState<EnvioDeFormulario[] | null>(null);
  const [respostas, setRespostas] = useState<RespostaDeFormulario[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const alternar = (p: "enviar" | "respostas") => {
    setErro(null);
    setEnviados(null);
    setPainel(painel === p ? null : p);
    if (p === "respostas" && painel !== p)
      iniciar(async () => {
        setRespostas(personal ? await respostasDoFormularioDoPersonal(f.id) : await respostasDoFormulario(f.id));
      });
  };
  const mensagem = (e: EnvioDeFormulario) =>
    personal
      ? `Olá, ${e.nome.split(" ")[0]}! Mandei o formulário "${f.nome}" no app. Responda antes do treino, leva poucos minutos: ${window.location.origin}/aluno/formulario/${e.respostaId}`
      : `Olá, ${e.nome.split(" ")[0]}! O ${estudio} enviou o formulário "${f.nome}". Responda pelo app, leva poucos minutos: ${window.location.origin}/aluno/formulario/${e.respostaId}`;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-[17px] font-bold">{f.nome}</h2>
          {f.tipo !== "pesquisa" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-bold text-ink-3">Padrão</span>}
        </div>
        {(personal ? AJUDA_PERSONAL : AJUDA)[f.tipo] && <p className="text-[13px] text-ink-3">{(personal ? AJUDA_PERSONAL : AJUDA)[f.tipo]}</p>}
        <p className="mt-1 text-[14px] text-ink-2">
          {f.perguntas.length} pergunta{f.perguntas.length === 1 ? "" : "s"} · {f.respondidos} resposta{f.respondidos === 1 ? "" : "s"}
          {f.pendentes > 0 && ` · ${f.pendentes} aguardando`}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14.5px] font-bold">
        <button type="button" onClick={editar} className="text-brand">
          Editar
        </button>
        <button type="button" onClick={() => alternar("enviar")} className="text-brand">
          Enviar aos alunos
        </button>
        {f.respondidos > 0 && (
          <button type="button" onClick={() => alternar("respostas")} className="text-brand">
            Ver respostas
          </button>
        )}
      </div>

      {painel === "enviar" &&
        (enviados ? (
          <div className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3 text-[14px]">
            {enviados.length === 0 ? (
              <p>Ninguém novo para receber: todos já têm este formulário para responder.</p>
            ) : (
              <>
                <p className="font-semibold">
                  Enviado para {enviados.length} aluno{enviados.length === 1 ? "" : "s"}. Quem tem o app foi avisado. Mande também pelo WhatsApp:
                </p>
                <ul className="flex flex-col divide-y divide-line">
                  {enviados.map((e) => (
                    <li key={e.respostaId} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate">{e.nome}</span>
                      {!e.comApp ? (
                        <span className="text-[13px] text-ink-3">Sem o app</span>
                      ) : e.whatsapp ? (
                        <a href={linkWhatsapp(e.whatsapp, mensagem(e))} target="_blank" rel="noreferrer" className="font-bold text-brand">
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-[13px] text-ink-3">Sem WhatsApp</span>
                      )}
                    </li>
                  ))}
                </ul>
                {enviados.some((e) => !e.comApp) && (
                  <p className="text-[13px] text-ink-3">Quem está sem o app responde quando entrar: o formulário fica esperando por ele.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Para quem</legend>
              <div className="flex flex-wrap gap-2">
                <Chip ativo={todos} onClick={() => setTodos(true)}>
                  {personal ? "Todos com o app" : "Todos os alunos"}
                </Chip>
                <Chip ativo={!todos} onClick={() => setTodos(false)}>
                  Escolher alunos
                </Chip>
              </div>
            </fieldset>
            {!todos && (
              <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-[12px] border border-line bg-surface px-3">
                {alunos.map((a) => (
                  <li key={a.id}>
                    <label className="flex min-h-11 items-center gap-3 text-[15px]">
                      <input
                        type="checkbox"
                        checked={escolhidos.has(a.id)}
                        onChange={() => {
                          const n = new Set(escolhidos);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          setEscolhidos(n);
                        }}
                        className="size-5 shrink-0 accent-[var(--brand)]"
                      />
                      {a.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Aviso>{erro}</Aviso>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                iniciar(async () => {
                  setErro(null);
                  if (!todos && escolhidos.size === 0) return setErro("Escolha pelo menos um aluno.");
                  const r = personal
                    ? await enviarFormularioDoPersonal(f.id, todos ? null : [...escolhidos])
                    : await enviarFormularioDoEstudio(f.id, todos ? null : [...escolhidos]);
                  if (!r.ok) return setErro(r.erro);
                  setEnviados(r.enviados);
                  router.refresh();
                })
              }
              className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
            >
              {ocupado ? "Enviando…" : todos ? "Enviar para todos" : `Enviar para ${escolhidos.size} aluno${escolhidos.size === 1 ? "" : "s"}`}
            </button>
          </div>
        ))}

      {painel === "respostas" &&
        (!respostas ? (
          <p className="text-[14px] text-ink-3">Abrindo as respostas…</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[14px] bg-surface-2 px-3">
            {respostas.map((r) => (
              <li key={r.id} className="py-2">
                <button type="button" onClick={() => setAberta(aberta === r.id ? null : r.id)} className="flex w-full items-center gap-2 text-left">
                  <span className="min-w-0 flex-1 font-bold">{r.aluno}</span>
                  <span className="text-[13px] text-ink-3">{r.respondidoEm && dataCurta(emBrasilia(r.respondidoEm).data)}</span>
                  <span className="text-ink-3">{aberta === r.id ? "▴" : "▾"}</span>
                </button>
                {aberta === r.id && (
                  <div className="pt-2">
                    <RespostasDoFormulario perguntas={r.perguntas} respostas={r.respostas} parq={r.tipo === "parq"} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
