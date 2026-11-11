"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarFuncionamento, type AlunoDoEstudio, type EstudioCompleto, type MembroDaEquipe, type ModeloDePagamento, type ValoresDePagamento } from "@/data/estudio";
import { FUNCIONAMENTO_PADRAO } from "@/lib/funcionamento";
import { HorarioDeFuncionamento } from "./HorarioDeFuncionamento";
import {
  gerarMensalidadesAgora,
  marcarMensalidade,
  marcarPagamentoProfessor,
  salvarConfigEstudio,
  salvarMensalidadeAluno,
  salvarPixEstudio,
  salvarPrecosEstudio,
  salvarValorProfessor,
  type FaltasDoProfessor,
  type FinanceiroDoMes,
  type MesDoEstudio,
} from "@/data/estudio-financeiro";
import { COR_COBRANCA, ROTULO_COBRANCA, situacaoDaCobranca } from "@/lib/cobranca";
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from "@/lib/matricula";
import { TIPOS_CHAVE_PIX, type TipoChavePix } from "@/lib/pix";
import { VEZES_POR_SEMANA } from "@/lib/precos";
import { Chip } from "../Chip";
import { Aviso, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

export const MODELOS: { valor: ModeloDePagamento; rotulo: string; texto: string }[] = [
  { valor: "hora", rotulo: "Por hora", texto: "Valor da hora × horas de aula dadas." },
  { valor: "aula_comissao", rotulo: "Hora-aula + comissão", texto: "Valor por aula dada + um valor por aluno presente." },
  { valor: "percentual", rotulo: "Percentual dos alunos", texto: "Uma % da mensalidade dos alunos das turmas dele." },
];

const ROTULO = "flex flex-col gap-1 text-[14px] font-bold text-ink-2";
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const reais = (v: number | null) => (v == null ? "—" : centavosParaReais(v));

/** Campo em reais que devolve centavos (null se vazio, NaN se inválido). */
function CampoDinheiro({
  rotulo,
  valor,
  onChange,
  dica,
}: {
  rotulo: string;
  valor: number | null;
  onChange: (centavos: number | null) => void;
  dica?: string;
}) {
  const [texto, setTexto] = useState(centavosParaCampo(valor));
  return (
    <label className={ROTULO}>
      {rotulo}
      <span className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-ink-3">R$</span>
        <input
          inputMode="decimal"
          value={texto}
          placeholder={dica ?? "0,00"}
          onChange={(e) => {
            setTexto(e.target.value);
            onChange(reaisParaCentavos(e.target.value));
          }}
          className={ESTILO_CAIXA + " pl-10"}
        />
      </span>
    </label>
  );
}

function CampoPercentual({ rotulo, valor, onChange, dica }: { rotulo: string; valor: number | null; onChange: (v: number | null) => void; dica?: string }) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  return (
    <label className={ROTULO}>
      {rotulo}
      <span className="relative">
        <input
          inputMode="decimal"
          value={texto}
          placeholder={dica ?? "0"}
          onChange={(e) => {
            setTexto(e.target.value);
            const t = e.target.value.trim().replace(",", ".");
            onChange(t === "" ? null : /^\d{1,3}(\.\d{1,2})?$/.test(t) ? Number(t) : NaN);
          }}
          className={ESTILO_CAIXA + " pr-9"}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-semibold text-ink-3">%</span>
      </span>
    </label>
  );
}

const invalido = (v: ValoresDePagamento) =>
  [v.valorHora, v.valorAula, v.valorPorAluno, v.percentual].some((x) => x != null && Number.isNaN(x)) || (v.percentual ?? 0) > 100;

/** Os campos de valor do modelo de pagamento (padrão do estúdio ou de um professor). */
function CamposDoModelo({
  modelo,
  valores,
  mudar,
  padrao,
}: {
  modelo: ModeloDePagamento;
  valores: ValoresDePagamento;
  mudar: (v: ValoresDePagamento) => void;
  /** Valores do estúdio, para mostrar como dica no campo do professor. */
  padrao?: ValoresDePagamento;
}) {
  const dica = (v: number | null | undefined) => (v == null ? undefined : centavosParaCampo(v));
  if (modelo === "hora")
    return <CampoDinheiro rotulo="Valor da hora" valor={valores.valorHora} dica={dica(padrao?.valorHora)} onChange={(v) => mudar({ ...valores, valorHora: v })} />;
  if (modelo === "aula_comissao")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoDinheiro rotulo="Por aula dada" valor={valores.valorAula} dica={dica(padrao?.valorAula)} onChange={(v) => mudar({ ...valores, valorAula: v })} />
        <CampoDinheiro
          rotulo="Por aluno presente"
          valor={valores.valorPorAluno}
          dica={dica(padrao?.valorPorAluno)}
          onChange={(v) => mudar({ ...valores, valorPorAluno: v })}
        />
      </div>
    );
  return (
    <CampoPercentual
      rotulo="% da mensalidade dos alunos dele"
      valor={valores.percentual}
      dica={padrao?.percentual == null ? undefined : String(padrao.percentual).replace(".", ",")}
      onChange={(v) => mudar({ ...valores, percentual: v })}
    />
  );
}

// ─── Ajustes do estúdio ──────────────────────────────────────────────────────

export function AjustesDoEstudio({ estudio }: { estudio: EstudioCompleto }) {
  const router = useRouter();
  const c = estudio.config;
  const [nome, setNome] = useState(estudio.nome);
  const [tipo, setTipo] = useState(c.tipo);
  const [modelo, setModelo] = useState(c.pagamentoModelo);
  const [valores, setValores] = useState(c.valores);
  const [max, setMax] = useState(c.maxAlunosTurma);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const modeloEfetivo = tipo === "academia" ? "hora" : modelo;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4" aria-label="Estúdio e professores">
        <label className={ROTULO}>
          Nome
          <input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} className={ESTILO_CAIXA} />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Tipo</legend>
          <div className="flex flex-wrap gap-2">
            <Chip ativo={tipo === "estudio"} onClick={() => setTipo("estudio")}>
              Estúdio
            </Chip>
            <Chip ativo={tipo === "academia"} onClick={() => setTipo("academia")}>
              Academia de rede
            </Chip>
          </div>
          {tipo === "academia" && <p className="text-[13px] text-ink-3">Na academia, o professor recebe por hora e o app não cobra os alunos.</p>}
        </fieldset>
        {tipo === "estudio" && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Como os professores recebem</legend>
            <div className="flex flex-wrap gap-2">
              {MODELOS.map((m) => (
                <Chip key={m.valor} ativo={modelo === m.valor} onClick={() => setModelo(m.valor)}>
                  {m.rotulo}
                </Chip>
              ))}
            </div>
            <p className="text-[13px] text-ink-3">{MODELOS.find((m) => m.valor === modeloEfetivo)?.texto}</p>
          </fieldset>
        )}
        <CamposDoModelo modelo={modeloEfetivo} valores={valores} mudar={setValores} />
        <label className={ROTULO + " sm:max-w-[240px]"}>
          Máximo de alunos por turma
          <input type="number" min={1} max={100} value={max} onChange={(e) => setMax(Number(e.target.value))} className={ESTILO_CAIXA} />
        </label>
        <p className="text-[13px] text-ink-3">O valor vale para todos os professores. Em Professores dá para pôr um valor diferente para alguém.</p>
        <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => {
            if (invalido(valores)) return setAviso({ tipo: "erro", texto: "Confira os valores." });
            iniciar(async () => {
              const r = await salvarConfigEstudio(estudio.id, { nome, tipo, pagamentoModelo: modeloEfetivo, valores, maxAlunosTurma: max });
              setAviso(r.ok ? { tipo: "ok", texto: "Salvo." } : { tipo: "erro", texto: r.erro });
              if (r.ok) router.refresh();
            });
          }}
          className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
      </section>

      <FuncionamentoDoEstudio estudio={estudio} />
      {c.tipo === "estudio" && <TabelaDeMensalidades estudio={estudio} />}
      {c.tipo === "estudio" && <PixDoEstudio estudio={estudio} />}
    </div>
  );
}

function FuncionamentoDoEstudio({ estudio }: { estudio: EstudioCompleto }) {
  const router = useRouter();
  const definido = Object.keys(estudio.config.funcionamento).length > 0;
  const [valor, setValor] = useState(definido ? estudio.config.funcionamento : FUNCIONAMENTO_PADRAO);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Funcionamento">
      <div>
        <h2 className="font-bold">Dias e horários de funcionamento</h2>
        <p className="text-[13px] text-ink-3">
          {definido ? "Turmas e turnos ficam dentro deste horário." : "Ainda não definido: confira e salve para a agenda usar este horário."}
        </p>
      </div>
      <HorarioDeFuncionamento valor={valor} mudar={setValor} />
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await salvarFuncionamento(estudio.id, valor);
            setAviso(r.ok ? { tipo: "ok", texto: "Horário salvo." } : { tipo: "erro", texto: r.erro });
            if (r.ok) router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
      >
        {ocupado ? "Salvando…" : "Salvar horário"}
      </button>
    </section>
  );
}

function TabelaDeMensalidades({ estudio }: { estudio: EstudioCompleto }) {
  const router = useRouter();
  const [precos, setPrecos] = useState(estudio.config.precos);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Mensalidades">
      <div>
        <h2 className="font-bold">Mensalidades</h2>
        <p className="text-[13px] text-ink-3">Pelo número de turmas por semana do aluno. Deixe vazio o que o estúdio não oferece.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VEZES_POR_SEMANA.map((v) => (
          <CampoDinheiro key={v} rotulo={`${v}x na semana`} valor={precos[v] ?? null} onChange={(c) => setPrecos({ ...precos, [v]: c ?? undefined })} />
        ))}
      </div>
      <p className="text-[13px] text-ink-3">Valor diferente para um aluno: em Alunos, abra o aluno.</p>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => {
          if (Object.values(precos).some((x) => x != null && Number.isNaN(x))) return setAviso({ tipo: "erro", texto: "Confira os valores." });
          iniciar(async () => {
            const r = await salvarPrecosEstudio(estudio.id, precos);
            setAviso(r.ok ? { tipo: "ok", texto: "Tabela salva." } : { tipo: "erro", texto: r.erro });
            if (r.ok) router.refresh();
          });
        }}
        className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
      >
        {ocupado ? "Salvando…" : "Salvar tabela"}
      </button>
    </section>
  );
}

function PixDoEstudio({ estudio }: { estudio: EstudioCompleto }) {
  const router = useRouter();
  const ini = estudio.config.pix;
  const [pix, setPix] = useState({
    tipo: (ini?.tipo ?? "cnpj") as TipoChavePix,
    chave: ini?.chave ?? "",
    nome: ini?.nome ?? estudio.nome.slice(0, 25),
    cidade: ini?.cidade ?? "",
  });
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const tipo = TIPOS_CHAVE_PIX.find((t) => t.valor === pix.tipo)!;
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Pix do estúdio">
      <div>
        <h2 className="font-bold">Pix do estúdio</h2>
        <p className="text-[13px] text-ink-3">Os alunos pagam a mensalidade direto nesta chave.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIPOS_CHAVE_PIX.map((t) => (
          <Chip key={t.valor} ativo={pix.tipo === t.valor} onClick={() => setPix({ ...pix, tipo: t.valor })}>
            {t.rotulo}
          </Chip>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={ROTULO}>
          Chave
          <input value={pix.chave} placeholder={tipo.exemplo} onChange={(e) => setPix({ ...pix, chave: e.target.value })} className={ESTILO_CAIXA} />
        </label>
        <label className={ROTULO}>
          Nome de quem recebe
          <input value={pix.nome} maxLength={25} onChange={(e) => setPix({ ...pix, nome: e.target.value })} className={ESTILO_CAIXA} />
        </label>
        <label className={ROTULO}>
          Cidade
          <input value={pix.cidade} maxLength={15} onChange={(e) => setPix({ ...pix, cidade: e.target.value })} className={ESTILO_CAIXA} />
        </label>
      </div>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await salvarPixEstudio(estudio.id, pix);
            setAviso(r.ok ? { tipo: "ok", texto: "Pix salvo." } : { tipo: "erro", texto: r.erro });
            if (r.ok) router.refresh();
          })
        }
        className={ESTILO_BOTAO_PRINCIPAL + " sm:w-auto"}
      >
        {ocupado ? "Salvando…" : "Salvar Pix"}
      </button>
    </section>
  );
}

// ─── Valor próprio de um professor (aba Professores) ─────────────────────────

export function ValorDoProfessor({ estudio, membro }: { estudio: EstudioCompleto; membro: MembroDaEquipe }) {
  const router = useRouter();
  const modelo = estudio.config.pagamentoModelo;
  const proprio = (v: ValoresDePagamento) =>
    modelo === "hora" ? v.valorHora != null : modelo === "aula_comissao" ? v.valorAula != null || v.valorPorAluno != null : v.percentual != null;
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState(membro.valores);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const salvar = (v: ValoresDePagamento) =>
    iniciar(async () => {
      if (invalido(v)) return setErro("Confira os valores.");
      const r = await salvarValorProfessor(estudio.id, membro.personalId, v);
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
      router.refresh();
    });

  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-left text-[13.5px] font-semibold text-brand">
        {proprio(membro.valores) ? "Valor próprio · alterar" : "Valor do estúdio · pôr valor próprio"}
      </button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3">
      <CamposDoModelo modelo={modelo} valores={valores} mudar={setValores} padrao={estudio.config.valores} />
      <Aviso>{erro}</Aviso>
      <div className="flex flex-wrap gap-3 text-[14px] font-bold">
        <button type="button" disabled={ocupado} onClick={() => salvar(valores)} className="rounded-[10px] bg-brand px-3 py-1.5 text-brand-ink">
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
        {proprio(membro.valores) && (
          <button type="button" disabled={ocupado} onClick={() => salvar({ valorHora: null, valorAula: null, valorPorAluno: null, percentual: null })} className="text-ink-3">
            Usar o do estúdio
          </button>
        )}
        <button type="button" onClick={() => setAberto(false)} className="text-ink-3">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Mensalidade de um aluno (aba Alunos) ────────────────────────────────────

export function MensalidadeDoAluno({ estudio, aluno }: { estudio: EstudioCompleto; aluno: AlunoDoEstudio }) {
  const router = useRouter();
  const vezes = Math.min(7, aluno.turmas.length);
  const daTabela = vezes ? (estudio.config.precos[vezes] ?? null) : null;
  const [valor, setValor] = useState(aluno.valorMensal);
  const [dia, setDia] = useState(aluno.diaVencimento ?? 10);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      <p className="text-[14px] font-bold text-ink-2">
        Mensalidade{vezes ? ` · ${vezes}x na semana: ${reais(daTabela)} na tabela` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoDinheiro rotulo="Valor diferente (opcional)" valor={valor} dica={daTabela == null ? undefined : centavosParaCampo(daTabela)} onChange={setValor} />
        <label className={ROTULO}>
          Vence todo dia
          <select value={dia} onChange={(e) => setDia(Number(e.target.value))} className={ESTILO_CAIXA}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            if (valor != null && Number.isNaN(valor)) return setAviso({ tipo: "erro", texto: "Confira o valor." });
            const r = await salvarMensalidadeAluno(aluno.id, valor, dia);
            setAviso(r.ok ? { tipo: "ok", texto: "Mensalidade salva." } : { tipo: "erro", texto: r.erro });
            if (r.ok) router.refresh();
          })
        }
        className="self-start rounded-[10px] bg-brand px-3 py-1.5 text-[14px] font-bold text-brand-ink"
      >
        {ocupado ? "Salvando…" : aluno.diaVencimento ? "Salvar mensalidade" : "Começar a cobrar"}
      </button>
    </div>
  );
}

// ─── Financeiro do mês ───────────────────────────────────────────────────────

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mudarMes = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** "R$ 3,2 mil" / "R$ 850" — para caber em cima das barras. */
function curto(centavos: number): string {
  const r = centavos / 100;
  if (r >= 1000) return `${(Math.round(r / 100) / 10).toLocaleString("pt-BR")} mil`;
  return `R$ ${Math.round(r)}`;
}
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Receita (mensalidades recebidas) × custo dos professores, mês a mês (decisão 62). */
function GraficoDoEstudio({ historico, academia, mes }: { historico: MesDoEstudio[]; academia: boolean; mes: string }) {
  if (historico.length === 0) return null;
  const maior = Math.max(1, ...historico.map((h) => Math.max(academia ? 0 : h.receita, h.professores)));
  const barra = (v: number) => `${v > 0 ? Math.max(3, Math.round((v / maior) * 100)) : 0}%`;
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Meses anteriores">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="flex-1 text-[16px] font-bold">{academia ? "Professores por mês" : "Receita × professores"}</h3>
        {!academia && (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <span className="size-3 rounded-[4px] bg-estudio" /> Receita
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <span className="size-3 rounded-[4px] bg-estudio-claro" /> Professores
        </span>
      </div>
      <div className="flex h-44 items-end gap-2 lg:h-56 lg:gap-4">
        {historico.map((h) => {
          const atual = h.mes === mes;
          const nome = MES_CURTO[Number(h.mes.slice(5)) - 1];
          return (
            <div key={h.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-1">
                {!academia && (
                  <div className="flex h-full w-1/2 max-w-7 flex-col items-center justify-end gap-0.5">
                    <span className="text-[10.5px] text-ink-3 tabular-nums">{h.receita > 0 ? curto(h.receita) : ""}</span>
                    <span
                      className={`w-full rounded-t-[6px] rounded-b-[2px] bg-estudio ${atual ? "" : "opacity-55"}`}
                      style={{ height: barra(h.receita) }}
                      title={`Receita em ${nome}: ${centavosParaReais(h.receita)}`}
                    />
                  </div>
                )}
                <div className="flex h-full w-1/2 max-w-7 flex-col items-center justify-end gap-0.5">
                  <span className="text-[10.5px] text-ink-3 tabular-nums">{h.professores > 0 ? curto(h.professores) : ""}</span>
                  <span
                    className={`w-full rounded-t-[6px] rounded-b-[2px] bg-estudio-claro ${atual ? "" : "opacity-55"}`}
                    style={{ height: barra(h.professores) }}
                    title={`Professores em ${nome}: ${centavosParaReais(h.professores)}`}
                  />
                </div>
              </div>
              <span className={`text-[12.5px] ${atual ? "font-bold text-ink" : "text-ink-3"}`}>{nome}</span>
            </div>
          );
        })}
      </div>
      {!academia && (() => {
        const h = historico.find((x) => x.mes === mes);
        if (!h) return null;
        const saldo = h.receita - h.professores;
        return (
          <p className="text-[14px] text-ink-2">
            Neste mês, receita menos professores: <b className={saldo < 0 ? "text-bad" : "text-ok"}>{centavosParaReais(saldo)}</b>
          </p>
        );
      })()}
    </section>
  );
}

/** Planos (vezes na semana) com o preço da tabela e quantos alunos estão em cada um. */
function PlanosDoEstudio({ estudio }: { estudio: EstudioCompleto }) {
  const planos = new Map<number, { alunos: number; diferentes: number; total: number }>();
  let semTurma = 0;
  for (const a of estudio.alunos) {
    const vezes = Math.min(7, a.turmas.length);
    if (vezes === 0) {
      semTurma++;
      continue;
    }
    const p = planos.get(vezes) ?? { alunos: 0, diferentes: 0, total: 0 };
    p.alunos++;
    if (a.valorMensal != null) p.diferentes++;
    p.total += a.valorMensal ?? estudio.config.precos[vezes] ?? 0;
    planos.set(vezes, p);
  }
  const linhas = [...new Set([...Object.keys(estudio.config.precos).map(Number), ...planos.keys()])]
    .filter((v) => estudio.config.precos[v] != null || planos.has(v))
    .sort((a, b) => a - b);
  const total = [...planos.values()].reduce((s, p) => s + p.total, 0);
  const alunos = (n: number) => `${n} aluno${n === 1 ? "" : "s"}`;
  return (
    <section className="flex flex-col gap-2" aria-label="Planos">
      <h3 className="text-[16px] font-bold">Planos</h3>
      {linhas.length === 0 ? (
        <p className="text-ink-3">Cadastre a tabela de mensalidades em Ajustes e as turmas dos alunos para ver os planos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {linhas.map((v) => {
            const p = planos.get(v);
            const preco = estudio.config.precos[v];
            return (
              <li key={v} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {v}x na semana{preco != null && <span className="font-normal text-ink-3"> · {centavosParaReais(preco)}</span>}
                  </span>
                  {p && p.diferentes > 0 && (
                    <span className="block text-[13px] text-ink-3">
                      {p.diferentes} com valor diferente da tabela
                    </span>
                  )}
                </span>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[13.5px] font-bold text-brand">{alunos(p?.alunos ?? 0)}</span>
                <span className="w-24 text-right font-extrabold tabular-nums">{p ? centavosParaReais(p.total) : "—"}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-3 py-3">
            <span className="flex-1 font-bold">Total por mês</span>
            <span className="font-extrabold tabular-nums">{centavosParaReais(total)}</span>
          </li>
        </ul>
      )}
      {semTurma > 0 && <p className="text-[13px] text-ink-3">{alunos(semTurma)} sem turma (fora dos planos).</p>}
    </section>
  );
}

/** Quantos dias cada professor faltou (e ficou de férias) no mês, até hoje. */
function FaltasDosProfessores({ estudio, faltas }: { estudio: EstudioCompleto; faltas: FaltasDoProfessor[] }) {
  const porId = new Map(faltas.map((f) => [f.personalId, f]));
  const dias = (n: number) => `${n} dia${n === 1 ? "" : "s"}`;
  return (
    <section className="flex flex-col gap-2" aria-label="Faltas dos professores">
      <h3 className="text-[16px] font-bold">Faltas dos professores no mês</h3>
      {estudio.equipe.length === 0 ? (
        <p className="text-ink-3">Nenhum professor na equipe.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {estudio.equipe.map((p) => {
            const f = porId.get(p.personalId);
            const faltou = f?.faltas ?? 0;
            const ferias = f?.ferias ?? 0;
            return (
              <li key={p.personalId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="min-w-0 flex-1 font-semibold">{p.nome}</span>
                {faltou === 0 && ferias === 0 ? (
                  <span className="text-[14px] text-ink-3">Nenhuma falta</span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {faltou > 0 && <span className="rounded-full bg-bad px-2.5 py-0.5 text-[13px] font-bold text-white">{dias(faltou)} de falta</span>}
                    {ferias > 0 && <span className="rounded-full bg-estudio-soft px-2.5 py-0.5 text-[13px] font-bold text-estudio">{dias(ferias)} de férias</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[13px] text-ink-3">Conta os dias marcados em férias e faltas (só os dias em que o estúdio abre), até hoje.</p>
    </section>
  );
}

export function FinanceiroDoEstudio({
  estudio,
  mes,
  hoje,
  dados,
  historico,
  faltas,
}: {
  estudio: EstudioCompleto;
  mes: string;
  hoje: string;
  dados: FinanceiroDoMes;
  historico: MesDoEstudio[];
  faltas: FaltasDoProfessor[];
}) {
  const router = useRouter();
  const [a, m] = mes.split("-").map(Number);
  const link = (n: number) => `/estudio/${estudio.id}?aba=financeiro&mes=${mudarMes(mes, n)}`;
  const academia = estudio.config.tipo === "academia";
  const ativas = dados.mensalidades.filter((x) => x.situacao !== "cancelada");
  const recebido = ativas.filter((x) => x.situacao === "paga").reduce((s, x) => s + x.valor, 0);
  const aReceber = ativas.filter((x) => x.situacao === "aberta").reduce((s, x) => s + x.valor, 0);
  const aPagar = dados.professores.reduce((s, p) => s + (p.valorPago ?? p.valor), 0);

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2" aria-label="Mês">
        <Link href={link(-1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Mês anterior">
          ‹
        </Link>
        <h2 className="flex-1 text-center text-[18px] font-bold first-letter:uppercase">
          {NOMES_MES[m - 1]} de {a}
        </h2>
        <Link href={link(1)} scroll={false} className="grid size-10 place-items-center rounded-full border border-line bg-surface font-bold" aria-label="Próximo mês">
          ›
        </Link>
      </nav>

      <div className={`grid gap-2.5 ${academia ? "grid-cols-1" : "grid-cols-3"}`}>
        {!academia && <Numero rotulo="Recebido" valor={recebido} cor="text-ok" />}
        {!academia && <Numero rotulo="A receber" valor={aReceber} cor="text-ink" />}
        <Numero rotulo="Professores" valor={aPagar} cor="text-estudio" />
      </div>

      <GraficoDoEstudio historico={historico} academia={academia} mes={mes} />
      <PlanosDoEstudio estudio={estudio} />
      <Professores estudio={estudio} mes={mes} dados={dados} atualizar={() => router.refresh()} />
      <FaltasDosProfessores estudio={estudio} faltas={faltas} />
      {!academia && <Mensalidades estudio={estudio} hoje={hoje} dados={dados} atualizar={() => router.refresh()} />}
    </div>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-3">
      <p className="text-[13px] text-ink-3">{rotulo}</p>
      <p className={`text-[18px] font-extrabold sm:text-[22px] ${cor}`}>{centavosParaReais(valor)}</p>
    </div>
  );
}

function Professores({ estudio, mes, dados, atualizar }: { estudio: EstudioCompleto; mes: string; dados: FinanceiroDoMes; atualizar: () => void }) {
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const modelo = estudio.config.pagamentoModelo;
  const detalhe = (p: FinanceiroDoMes["professores"][number]) => {
    const horas = (p.minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const aulas = `${p.aulas} aula${p.aulas === 1 ? "" : "s"}`;
    if (modelo === "hora") return `${aulas} · ${horas} h`;
    if (modelo === "aula_comissao") return `${aulas} · ${p.presencas} presença${p.presencas === 1 ? "" : "s"}`;
    return `${aulas} · parte da mensalidade dos alunos`;
  };
  return (
    <section className="flex flex-col gap-2" aria-label="Pagamento dos professores">
      <h3 className="text-[16px] font-bold">Pagamento dos professores</h3>
      <p className="text-[13px] text-ink-3">Conta só as aulas já dadas e não canceladas. O pagamento é feito por fora; aqui você marca o que já pagou.</p>
      {dados.professores.length === 0 ? (
        <p className="text-ink-3">Nenhuma aula dada neste mês.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {dados.professores.map((p) => (
            <li key={p.personalId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.nome}</span>
                <span className="block text-[13px] text-ink-3">{detalhe(p)}</span>
              </span>
              <span className="font-extrabold">{centavosParaReais(p.valorPago ?? p.valor)}</span>
              {p.pagoEm ? (
                <span className="flex items-center gap-2 text-[13.5px]">
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 font-bold text-ok">pago {dataBr(p.pagoEm)}</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await marcarPagamentoProfessor(estudio.id, p.personalId, mes, null);
                        if (!r.ok) return setErro(r.erro);
                        atualizar();
                      })
                    }
                    className="font-semibold text-ink-3"
                  >
                    desfazer
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={ocupado || p.valor === 0}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await marcarPagamentoProfessor(estudio.id, p.personalId, mes, p.valor);
                      if (!r.ok) return setErro(r.erro);
                      atualizar();
                    })
                  }
                  className="rounded-[10px] bg-brand px-3 py-1.5 text-[14px] font-bold text-brand-ink disabled:opacity-40"
                >
                  Marcar pago
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Aviso>{erro}</Aviso>
    </section>
  );
}

function Mensalidades({ estudio, hoje, dados, atualizar }: { estudio: EstudioCompleto; hoje: string; dados: FinanceiroDoMes; atualizar: () => void }) {
  const [ocupado, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const semVencimento = estudio.alunos.filter((a) => a.turmas.length > 0 && a.diaVencimento == null).length;
  const marcar = (id: string, s: "aberta" | "paga" | "cancelada") =>
    iniciar(async () => {
      const r = await marcarMensalidade(id, s);
      if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
      atualizar();
    });
  return (
    <section className="flex flex-col gap-2" aria-label="Mensalidades dos alunos">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-[16px] font-bold">Mensalidades dos alunos</h3>
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await gerarMensalidadesAgora(estudio.id);
              setAviso(r.ok ? { tipo: "ok", texto: r.criadas ? `${r.criadas} mensalidade${r.criadas === 1 ? "" : "s"} nova${r.criadas === 1 ? "" : "s"}.` : "Nada novo: as mensalidades aparecem 7 dias antes do vencimento." } : { tipo: "erro", texto: r.erro });
              if (r.ok) atualizar();
            })
          }
          className="text-[14px] font-bold text-brand"
        >
          Atualizar agora
        </button>
      </div>
      {semVencimento > 0 && (
        <p className="rounded-[14px] bg-gold-soft px-3 py-2 text-[14px] text-gold">
          {semVencimento} aluno{semVencimento === 1 ? "" : "s"} sem dia de vencimento: abra em Alunos para começar a cobrar.
        </p>
      )}
      {dados.mensalidades.length === 0 ? (
        <p className="text-ink-3">Nenhuma mensalidade neste mês. Elas aparecem 7 dias antes do vencimento.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[20px] border border-line bg-surface px-4">
          {dados.mensalidades.map((c) => {
            const s = situacaoDaCobranca(c, hoje);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.aluno}</span>
                  <span className="block text-[13px] text-ink-3">
                    vence {dataBr(c.vencimento)}
                    {c.alunoAvisou && c.situacao === "aberta" && " · aluno avisou que pagou"}
                  </span>
                </span>
                <span className="font-extrabold">{centavosParaReais(c.valor)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-bold ${COR_COBRANCA[s]}`}>{ROTULO_COBRANCA[s]}</span>
                <span className="flex gap-3 text-[13.5px] font-semibold">
                  {c.situacao === "aberta" ? (
                    <>
                      <button type="button" disabled={ocupado} onClick={() => marcar(c.id, "paga")} className="rounded-[10px] bg-brand px-3 py-1.5 font-bold text-brand-ink">
                        Recebido
                      </button>
                      <button type="button" disabled={ocupado} onClick={() => marcar(c.id, "cancelada")} className="text-ink-3">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={ocupado} onClick={() => marcar(c.id, "aberta")} className="text-ink-3">
                      desfazer
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Aviso tipo={aviso?.tipo ?? "erro"}>{aviso?.texto}</Aviso>
    </section>
  );
}
