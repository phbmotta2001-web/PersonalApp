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
  type FinanceiroDoMes,
  type MesDeAlunos,
  type MesDoEstudio,
} from "@/data/estudio-financeiro";
import { COR_COBRANCA, ROTULO_COBRANCA, situacaoDaCobranca, textoDoVencimento } from "@/lib/cobranca";
import { linkWhatsapp } from "@/lib/convite";
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from "@/lib/matricula";
import { pixCopiaECola, TIPOS_CHAVE_PIX, type TipoChavePix } from "@/lib/pix";
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
      {c.tipo === "estudio" && <PlanosDoEstudio estudio={estudio} />}
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
function GraficoDoEstudio({
  historico: brutos,
  academia,
  mes,
  previsto,
}: {
  historico: MesDoEstudio[];
  academia: boolean;
  mes: string;
  /** Mês atual ou futuro: a receita e o custo previstos para o mês escolhido. */
  previsto: { receita: number; professores: number } | null;
}) {
  if (brutos.length === 0) return null;
  const historico = brutos.map((h) => ({
    ...h,
    prevista: h.mes === mes && previsto ? previsto.receita : null,
    professores: h.mes === mes && previsto ? previsto.professores : h.professores,
  }));
  const maior = Math.max(1, ...historico.map((h) => Math.max(academia ? 0 : Math.max(h.receita, h.prevista ?? 0), h.professores)));
  const barra = (v: number) => `${v > 0 ? Math.max(3, Math.round((v / maior) * 100)) : 0}%`;
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Meses anteriores">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="flex-1 text-[16px] font-bold">{academia ? "Professores por mês" : "Receita × professores"}</h3>
        {!academia && (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <span className="size-3 rounded-[4px] bg-estudio" /> Recebido
          </span>
        )}
        {!academia && previsto && (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <span className="size-3 rounded-[4px] bg-estudio/25" /> Previsto
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
                    <span className="text-[10.5px] text-ink-3 tabular-nums">
                      {h.prevista != null ? (h.prevista > 0 ? curto(h.prevista) : "") : h.receita > 0 ? curto(h.receita) : ""}
                    </span>
                    {h.prevista != null ? (
                      <span
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t-[6px] rounded-b-[2px] bg-estudio/25"
                        style={{ height: barra(Math.max(h.prevista, h.receita)) }}
                        title={`Previsto em ${nome}: ${centavosParaReais(h.prevista)} · recebido ${centavosParaReais(h.receita)}`}
                      >
                        <span className="w-full bg-estudio" style={{ height: `${Math.min(100, Math.round((h.receita / Math.max(1, h.prevista, h.receita)) * 100))}%` }} />
                      </span>
                    ) : (
                      <span
                        className={`w-full rounded-t-[6px] rounded-b-[2px] bg-estudio ${atual ? "" : "opacity-55"}`}
                        style={{ height: barra(h.receita) }}
                        title={`Recebido em ${nome}: ${centavosParaReais(h.receita)}`}
                      />
                    )}
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
        const saldo = (h.prevista ?? h.receita) - h.professores;
        return (
          <p className="text-[14px] text-ink-2">
            {h.prevista != null ? "Previsto neste mês, receita menos professores: " : "Neste mês, receita menos professores: "}
            <b className={saldo < 0 ? "text-bad" : "text-ok"}>{centavosParaReais(saldo)}</b>
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

/** Mensalidade do aluno pelo plano (vezes na semana) ou pela exceção dele. */
const mensalidadeDe = (estudio: EstudioCompleto, a: AlunoDoEstudio) =>
  a.turmas.length === 0 ? 0 : (a.valorMensal ?? estudio.config.precos[Math.min(7, a.turmas.length)] ?? 0);

/**
 * Decisão 85: a projeção do mês, bem grande. Arrecadado sobre o total previsto, quanto falta e quem
 * ainda não pagou, com o valor e o vencimento. No mês atual e nos próximos, entram também as
 * mensalidades que ainda não foram geradas (elas aparecem 7 dias antes do vencimento).
 */
function contasDoMes(estudio: EstudioCompleto, mes: string, hoje: string, dados: FinanceiroDoMes) {
  const ativas = dados.mensalidades.filter((x) => x.situacao !== "cancelada");
  const [a, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const previstas =
    mes < hoje.slice(0, 7)
      ? []
      : estudio.alunos
          // Todo aluno ativo com plano entra na previsão do mês, mesmo sem dia de vencimento (vencimento vazio).
          .filter((x) => mensalidadeDe(estudio, x) > 0 && !ativas.some((c) => c.alunoId === x.id))
          .map((x) => ({
            id: `prevista-${x.id}`,
            alunoId: x.id,
            aluno: x.nome,
            vencimento: x.diaVencimento == null ? "" : `${mes}-${String(Math.min(x.diaVencimento, ultimoDia)).padStart(2, "0")}`,
            valor: mensalidadeDe(estudio, x),
            alunoAvisou: false,
          }));
  const arrecadado = ativas.filter((x) => x.situacao === "paga").reduce((s, x) => s + x.valor, 0);
  const total = ativas.reduce((s, x) => s + x.valor, 0) + previstas.reduce((s, x) => s + x.valor, 0);
  const falta = total - arrecadado;
  const devendo = [...ativas.filter((x) => x.situacao === "aberta"), ...previstas].sort((x, y) => (x.vencimento || "9999").localeCompare(y.vencimento || "9999"));
  return { arrecadado, total, falta, devendo };
}

/** Mensagem para cobrar a mensalidade pelo WhatsApp, com o Pix do estúdio. */
function mensagemDeCobranca(estudio: EstudioCompleto, nome: string, valor: number, vencimento: string, hoje: string) {
  const atrasada = vencimento < hoje;
  const linhas = [`Oi, ${nome.split(" ")[0]}! ${atrasada ? "Passando para lembrar" : "Lembrete"} do ${estudio.nome}: a mensalidade de ${centavosParaReais(valor)} ${textoDoVencimento(vencimento, hoje)}.`];
  const pix = estudio.config.pix;
  if (pix?.chave) {
    try {
      linhas.push("", "Pix copia e cola:", pixCopiaECola({ ...pix, tipo: pix.tipo as TipoChavePix }, valor, "MENSALIDADE"));
    } catch {
      linhas.push("", `Pix: ${pix.chave}`);
    }
  }
  linhas.push("", "Obrigado!");
  return linhas.join("\n");
}

function ProjecaoDoMes({ estudio, mes, hoje, dados }: { estudio: EstudioCompleto; mes: string; hoje: string; dados: FinanceiroDoMes }) {
  const [todos, setTodos] = useState(false);
  const { arrecadado, total, falta, devendo } = contasDoMes(estudio, mes, hoje, dados);
  const pct = total ? Math.min(100, Math.round((arrecadado / total) * 100)) : 0;
  const mostrar = todos ? devendo : devendo.slice(0, 8);
  // Botão de cobrar para quem vence em até 7 dias (ou já venceu).
  const [ah, mh, dh] = hoje.split("-").map(Number);
  const limite = new Date(Date.UTC(ah, mh - 1, dh + 7)).toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-3 rounded-[24px] bg-estudio p-5 text-white" aria-label="Projeção do mês">
      <span className="text-[14px] font-semibold opacity-85">Projeção do mês</span>
      <p className="font-display leading-none font-extrabold">
        <span className="text-[34px] sm:text-[44px]">{centavosParaReais(arrecadado)}</span>
        <span className="text-[20px] opacity-75 sm:text-[26px]"> / {centavosParaReais(total)}</span>
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[18px] font-bold">{falta > 0 ? `Faltam ${centavosParaReais(falta)}` : total > 0 ? "Tudo recebido!" : "Nenhuma mensalidade neste mês."}</p>

      {devendo.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[18px] bg-white p-3.5 text-ink">
          <h3 className="text-[15px] font-bold">Alunos que ainda não pagaram ({devendo.length})</h3>
          <ul className="flex flex-col divide-y divide-line">
            {mostrar.map((c) => {
              const atrasada = c.vencimento !== "" && c.vencimento < hoje;
              const aluno = estudio.alunos.find((x) => x.id === c.alunoId);
              const cobrar = c.vencimento !== "" && c.vencimento <= limite && aluno;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-2 py-2 text-[15px]">
                  <span className="min-w-0 flex-1 font-semibold">{c.aluno}</span>
                  <span className="font-extrabold tabular-nums">{centavosParaReais(c.valor)}</span>
                  {cobrar && (
                    <a
                      href={linkWhatsapp(aluno.whatsapp ?? "", mensagemDeCobranca(estudio, aluno.nome, c.valor, c.vencimento, hoje))}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-estudio px-3 py-1 text-[13px] font-bold text-white"
                    >
                      Cobrar no WhatsApp
                    </a>
                  )}
                  <span className={`basis-full text-[13px] ${atrasada ? "font-semibold text-bad" : "text-ink-3"}`}>
                    {!c.vencimento ? "sem dia de vencimento" : atrasada ? `venceu em ${dataBr(c.vencimento)}` : c.vencimento === hoje ? "vence hoje" : `vence em ${dataBr(c.vencimento)}`}
                    {c.alunoAvisou && " · avisou que pagou"}
                  </span>
                </li>
              );
            })}
          </ul>
          {devendo.length > 8 && (
            <button type="button" onClick={() => setTodos(!todos)} className="self-start pt-1 text-[14px] font-bold text-estudio">
              {todos ? "Mostrar menos" : `Ver todos (${devendo.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Decisão 84: ticket médio, receita dos planos, potencial com as turmas cheias e o custo com professores. */
function VisaoGeral({ estudio, custo }: { estudio: EstudioCompleto; custo: number }) {
  const valores = estudio.alunos.map((a) => mensalidadeDe(estudio, a)).filter((v) => v > 0);
  const receita = valores.reduce((s, v) => s + v, 0);
  const ticket = valores.length ? Math.round(receita / valores.length) : 0;
  const turmas = estudio.turmas.filter((t) => t.tipo === "turma");
  const vagas = turmas.reduce((s, t) => s + t.vagas, 0);
  const ocupadas = turmas.reduce((s, t) => s + Math.min(t.alunos.length, t.vagas), 0);
  // Cada aluno ocupa, em média, algumas vagas por semana: com as turmas cheias, cabem vagas ÷ essa média.
  const vezes = valores.length && ocupadas ? ocupadas / valores.length : 0;
  const cabem = vezes ? Math.floor(vagas / vezes) : 0;
  const potencial = cabem * ticket;
  const resultado = receita - custo;
  return (
    <section className="flex flex-col gap-2" aria-label="Visão geral">
      <h3 className="text-[16px] font-bold">Visão geral</h3>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Cartao rotulo="Ticket médio" valor={centavosParaReais(ticket)} texto={`${valores.length} aluno${valores.length === 1 ? "" : "s"} com plano`} />
        <Cartao rotulo="Receita por mês" valor={centavosParaReais(receita)} texto="soma dos planos" />
        <Cartao
          rotulo="Potencial com turmas cheias"
          valor={potencial > receita ? centavosParaReais(potencial) : "—"}
          texto={potencial > receita ? `+${centavosParaReais(potencial - receita)} com ${cabem - valores.length} alunos a mais` : "crie turmas e coloque alunos"}
        />
        <Cartao rotulo="Custo com professores" valor={centavosParaReais(custo)} texto={receita ? `${Math.round((custo / receita) * 100)}% da receita` : "no mês"} />
        <Cartao rotulo="Resultado previsto" valor={centavosParaReais(resultado)} texto="receita menos professores" cor={resultado < 0 ? "text-bad" : "text-ok"} />
      </div>
    </section>
  );
}

function Cartao({ rotulo, valor, texto, cor = "text-ink" }: { rotulo: string; valor: string; texto: string; cor?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3">
      <p className="text-[13px] text-ink-3">{rotulo}</p>
      <p className={`text-[18px] font-extrabold tabular-nums sm:text-[22px] ${cor}`}>{valor}</p>
      <p className="text-[12.5px] text-ink-3">{texto}</p>
    </div>
  );
}

/** Quanto cada profissional custa no mês (previsto, com as aulas que ainda vão acontecer). */
function CustoComProfissionais({ estudio, custos, previsto, receita }: { estudio: EstudioCompleto; custos: Record<string, number>; previsto: boolean; receita: number | null }) {
  const linhas = estudio.equipe.map((p) => ({ id: p.personalId, nome: p.nome, valor: custos[p.personalId] ?? 0 })).sort((x, y) => y.valor - x.valor);
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const maior = Math.max(1, ...linhas.map((l) => l.valor));
  // Estúdio: quanto da receita prevista vai para cada um. Academia (sem receita): parte do custo total.
  const fatia = (v: number) =>
    receita != null ? (receita ? `${Math.round((v / receita) * 100)}% da receita` : "—") : total ? `${Math.round((v / total) * 100)}%` : "—";
  return (
    <section className="flex flex-col gap-2" aria-label="Custo com profissionais">
      <h3 className="text-[16px] font-bold">Custo com profissionais</h3>
      <ul className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
        {linhas.map((l) => (
          <li key={l.id} className="flex flex-col gap-1">
            <span className="flex gap-2 text-[14.5px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{l.nome}</span>
              <span className="font-extrabold tabular-nums">{centavosParaReais(l.valor)}</span>
              <span className="w-24 text-right text-[13px] text-ink-3 tabular-nums">{fatia(l.valor)}</span>
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-estudio" style={{ width: `${Math.round((l.valor / maior) * 100)}%` }} />
            </div>
          </li>
        ))}
        <li className="flex items-baseline gap-2 border-t border-line pt-2 font-bold">
          <span className="flex-1">Total</span>
          <span className="tabular-nums">{centavosParaReais(total)}</span>
          {receita != null && <span className="w-24 text-right text-[13px] font-normal text-ink-3 tabular-nums">{fatia(total)}</span>}
        </li>
      </ul>
      <p className="text-[13px] text-ink-3">{estudio.config.pagamentoModelo === "percentual"
          ? "Pelo mês: a % da mensalidade dos alunos das turmas de cada um, mais as reposições."
          : previsto
            ? "Previsto para o mês: as aulas já dadas e as que ainda vão acontecer."
            : "As aulas já dadas no mês."}</p>
    </section>
  );
}

/**
 * Decisão 84: alunos ativos mês a mês, com quem entrou e quem saiu, e a projeção dos próximos 3
 * meses no ritmo dos últimos 3 (entradas menos saídas).
 */
function GraficoDeCrescimento({ crescimento, ticket }: { crescimento: MesDeAlunos[]; ticket: number }) {
  if (crescimento.length < 2) return null;
  const ultimos = crescimento.slice(-3);
  const ritmo = ultimos.reduce((s, x) => s + x.novos - x.saidas, 0) / ultimos.length;
  const atual = crescimento[crescimento.length - 1];
  const anterior = crescimento[crescimento.length - 2];
  const projecao = [1, 2, 3].map((k) => {
    const [a, m] = atual.mes.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + k, 1));
    return { mes: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, ativos: Math.max(0, Math.round(atual.ativos + ritmo * k)) };
  });
  const maior = Math.max(1, ...crescimento.map((x) => x.ativos), ...projecao.map((x) => x.ativos));
  const altura = (v: number) => `${v > 0 ? Math.max(3, Math.round((v / maior) * 100)) : 0}%`;
  const nome = (mes: string) => MES_CURTO[Number(mes.slice(5)) - 1];
  const variacao = anterior.ativos ? Math.round(((atual.ativos - anterior.ativos) / anterior.ativos) * 100) : null;
  const fim = projecao[2];
  const porMes = Math.round(ritmo * 10) / 10;
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4" aria-label="Crescimento">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="flex-1 text-[16px] font-bold">Crescimento de alunos</h3>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <span className="size-3 rounded-[4px] bg-estudio" /> Alunos
        </span>
        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <span className="size-3 rounded-[4px] border border-dashed border-estudio bg-estudio-soft" /> Projeção
        </span>
      </div>
      <div className="flex h-44 items-end gap-1.5 lg:h-56 lg:gap-3">
        {crescimento.map((x) => (
          <div key={x.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11.5px] font-bold tabular-nums">{x.ativos || ""}</span>
            <span
              className={`w-full max-w-9 rounded-t-[6px] rounded-b-[2px] bg-estudio ${x === atual ? "" : "opacity-60"}`}
              style={{ height: altura(x.ativos) }}
              title={`${nome(x.mes)}: ${x.ativos} alunos, ${x.novos} entraram, ${x.saidas} saíram`}
            />
            <span className={`text-[12px] ${x === atual ? "font-bold" : "text-ink-3"}`}>{nome(x.mes)}</span>
            <span className="text-[11px] leading-tight tabular-nums">
              {x.novos > 0 && <span className="text-ok">+{x.novos}</span>}
              {x.novos > 0 && x.saidas > 0 && " "}
              {x.saidas > 0 && <span className="text-bad">−{x.saidas}</span>}
              {!x.novos && !x.saidas && <span className="text-ink-3">0</span>}
            </span>
          </div>
        ))}
        {projecao.map((x) => (
          <div key={x.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11.5px] text-ink-3 tabular-nums">{x.ativos || ""}</span>
            <span
              className="w-full max-w-9 rounded-t-[6px] rounded-b-[2px] border border-dashed border-estudio bg-estudio-soft"
              style={{ height: altura(x.ativos) }}
              title={`${nome(x.mes)} (projeção): ${x.ativos} alunos`}
            />
            <span className="text-[12px] text-ink-3">{nome(x.mes)}</span>
            <span className="text-[11px] leading-tight text-ink-3">prev.</span>
          </div>
        ))}
      </div>
      <p className="text-[14px] text-ink-2">
        Este mês: <b className="text-ok">+{atual.novos}</b> {atual.novos === 1 ? "entrou" : "entraram"}, <b className="text-bad">−{atual.saidas}</b>{" "}
        {atual.saidas === 1 ? "saiu" : "saíram"}
        {variacao != null && ` (${variacao >= 0 ? "+" : ""}${variacao}% de alunos em relação a ${nome(anterior.mes)})`}.
      </p>
      <p className="text-[14px] text-ink-2">
        No ritmo dos últimos 3 meses ({porMes >= 0 ? "+" : ""}
        {porMes.toLocaleString("pt-BR")} por mês), em {nome(fim.mes)}: <b>{fim.ativos} alunos</b>
        {ticket > 0 && (
          <>
            , cerca de <b>{centavosParaReais(fim.ativos * ticket)}</b> por mês
          </>
        )}
        .
      </p>
    </section>
  );
}

export function FinanceiroDoEstudio({
  estudio,
  mes,
  hoje,
  dados,
  historico,
  crescimento,
  previsao,
}: {
  estudio: EstudioCompleto;
  mes: string;
  hoje: string;
  dados: FinanceiroDoMes;
  historico: MesDoEstudio[];
  crescimento: MesDeAlunos[];
  previsao: Record<string, number> | null;
}) {
  const router = useRouter();
  const [a, m] = mes.split("-").map(Number);
  const link = (n: number) => `/estudio/${estudio.id}?aba=financeiro&mes=${mudarMes(mes, n)}`;
  const academia = estudio.config.tipo === "academia";
  // Custo de cada profissional: a previsão do mês (migração 46) ou, sem ela, o que já foi dado.
  const custos = previsao ?? Object.fromEntries(dados.professores.map((p) => [p.personalId, p.valorPago ?? p.valor]));
  const custo = Object.values(custos).reduce((s, v) => s + v, 0);
  const receitaPrevista = contasDoMes(estudio, mes, hoje, dados).total;
  const mesAtualOuFuturo = mes >= hoje.slice(0, 7);
  const comPlano = estudio.alunos.map((x) => mensalidadeDe(estudio, x)).filter((v) => v > 0);
  const ticket = comPlano.length ? Math.round(comPlano.reduce((s, v) => s + v, 0) / comPlano.length) : 0;

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

      {!academia && <ProjecaoDoMes estudio={estudio} mes={mes} hoje={hoje} dados={dados} />}
      {!academia && <VisaoGeral estudio={estudio} custo={custo} />}
      <CustoComProfissionais estudio={estudio} custos={custos} previsto={previsao != null} receita={academia ? null : receitaPrevista} />
      {!academia && <GraficoDeCrescimento crescimento={crescimento} ticket={ticket} />}
      <GraficoDoEstudio
        historico={historico}
        academia={academia}
        mes={mes}
        previsto={mesAtualOuFuturo && !academia ? { receita: receitaPrevista, professores: custo } : null}
      />
      <Professores estudio={estudio} mes={mes} dados={dados} atualizar={() => router.refresh()} />
      {!academia && <Mensalidades estudio={estudio} hoje={hoje} dados={dados} atualizar={() => router.refresh()} />}
    </div>
  );
}

/** Alunos das turmas do professor e a soma das mensalidades deles (dividida pelas turmas, como no banco). */
function baseDoPercentual(estudio: EstudioCompleto, professorId: string) {
  const turmas = new Map(estudio.turmas.filter((t) => t.tipo === "turma").map((t) => [t.id, t.professorId]));
  let alunos = 0;
  let base = 0;
  for (const a of estudio.alunos) {
    const minhas = a.turmas.filter((id) => turmas.has(id));
    const dele = minhas.filter((id) => turmas.get(id) === professorId).length;
    if (!dele) continue;
    alunos++;
    base += (mensalidadeDe(estudio, a) * dele) / minhas.length;
  }
  return { alunos, base: Math.round(base) };
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
    // Decisão 86: a conta do percentual, por extenso (alunos, % e a base), e o que vem à parte.
    const b = baseDoPercentual(estudio, p.personalId);
    const pct = estudio.equipe.find((m) => m.personalId === p.personalId)?.valores.percentual ?? estudio.config.valores.percentual ?? 0;
    const extra = p.valor - Math.round((b.base * pct) / 100);
    const conta = b.alunos
      ? `${b.alunos} aluno${b.alunos === 1 ? "" : "s"} · ${String(pct).replace(".", ",")}% de ${centavosParaReais(b.base)}`
      : "Nenhum aluno nas turmas dele";
    return extra > 0 ? `${conta} + ${centavosParaReais(extra)} de reposições e turnos` : conta;
  };
  return (
    <section className="flex flex-col gap-2" aria-label="Pagamento dos professores">
      <h3 className="text-[16px] font-bold">Pagamento dos professores</h3>
      <p className="text-[13px] text-ink-3">
        {modelo === "percentual"
          ? "Pelo mês: a % da mensalidade dos alunos das turmas de cada professor. Reposições são pagas à parte, por aula."
          : "Conta as aulas já dadas e não canceladas."}{" "}
        O pagamento é feito por fora; aqui você marca o que já pagou.
      </p>
      {dados.professores.length === 0 ? (
        <p className="text-ink-3">Nenhum professor neste mês.</p>
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
