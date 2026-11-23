// Decisão 117: relatório do mês do aluno do personal (treinos registrados e avaliação física).

import { MEDIDAS, type AvaliacaoFisica } from "./avaliacao";
import { volumeDoRegistro, type MedidaDaSerie, type PontoDeTreino, type Unidade } from "./treino";

export interface ExercicioNoMes {
  chave: string;
  nome: string;
  unidade: Unidade;
  medida: MedidaDaSerie;
  /** Maior carga (ou repetições/segundos, se não tem carga) de cada aula do mês. */
  pontos: { data: string; valor: number }[];
  porCarga: boolean;
  /** Total levantado no mês, em kg (0 em placas e isometrias). */
  volumeKg: number;
}

export interface ComparacaoDeMedida {
  rotulo: string;
  unidade: string;
  antes: number;
  depois: number;
}

export interface RelatorioDoMes {
  /** "AAAA-MM" */
  mes: string;
  aulas: number;
  aulasAntes: number;
  volumeKg: number;
  volumeAntesKg: number;
  /** Total levantado em cada aula do mês. */
  volumePorAula: { data: string; valor: number }[];
  exercicios: ExercicioNoMes[];
  /** As duas últimas avaliações até o fim do mês (a mais nova em "depois"). */
  avaliacao: { antes: string; depois: string; itens: ComparacaoDeMedida[] } | null;
  /** Só uma avaliação até o fim do mês (sem comparação). */
  avaliacaoUnica: AvaliacaoFisica | null;
}

/** "2026-11" → "2026-10" */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
export function mesSeguinte(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** "2026-11" → "novembro de 2026"; curto: "novembro" */
export function nomeDoMes(mes: string, curto = false): string {
  const nome = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return curto ? nome : `${nome} de ${mes.slice(0, 4)}`;
}

/** Nos 7 primeiros dias do mês, o relatório padrão é o do mês que acabou; depois, o do mês atual. */
export const mesPadraoDoRelatorio = (hoje: string) => (Number(hoje.slice(8, 10)) <= 7 ? mesAnterior(hoje.slice(0, 7)) : hoje.slice(0, 7));

const chaveDaAula = (p: PontoDeTreino) => p.aulaId ?? p.data;

export function montarRelatorio(pontos: PontoDeTreino[], avaliacoes: AvaliacaoFisica[], mes: string): RelatorioDoMes {
  const doMes = pontos.filter((p) => p.data.startsWith(mes));
  const antes = pontos.filter((p) => p.data.startsWith(mesAnterior(mes)));
  const soma = (l: PontoDeTreino[]) => l.reduce((t, p) => t + volumeDoRegistro(p), 0);

  const porAula = new Map<string, { data: string; valor: number }>();
  for (const p of doMes) {
    const k = chaveDaAula(p);
    const x = porAula.get(k) ?? { data: p.data, valor: 0 };
    x.valor += volumeDoRegistro(p);
    porAula.set(k, x);
  }

  const grupos = new Map<string, PontoDeTreino[]>();
  for (const p of doMes) {
    const k = p.exercicioId ?? `nome:${p.nome}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const exercicios: ExercicioNoMes[] = [...grupos.entries()].map(([chave, l]) => {
    const ultimo = l[l.length - 1];
    const porCarga = l.some((p) => p.cargaKg != null);
    const porDia = new Map<string, number>();
    for (const p of l) {
      // Gráfico numa unidade só (a do registro mais recente).
      if (porCarga && p.unidade !== ultimo.unidade) continue;
      const v = porCarga ? p.cargaKg : maiorReps(p);
      if (v == null) continue;
      porDia.set(p.data, Math.max(v, porDia.get(p.data) ?? -Infinity));
    }
    return {
      chave,
      nome: ultimo.nome,
      unidade: ultimo.unidade,
      medida: ultimo.medida,
      porCarga,
      pontos: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, valor]) => ({ data, valor })),
      volumeKg: soma(l),
    };
  });
  exercicios.sort((a, b) => b.pontos.length - a.pontos.length || a.nome.localeCompare(b.nome));

  // Avaliações até o fim do mês: compara a última com a anterior.
  const fim = `${mesSeguinte(mes)}-01`;
  const ate = avaliacoes.filter((a) => a.data < fim);
  const depois = ate[ate.length - 1];
  const anterior = ate[ate.length - 2];
  let avaliacao: RelatorioDoMes["avaliacao"] = null;
  if (depois && anterior) {
    const itens: ComparacaoDeMedida[] = [];
    const add = (rotulo: string, unidade: string, a: number | null | undefined, d: number | null | undefined) => {
      if (a != null && d != null) itens.push({ rotulo, unidade, antes: a, depois: d });
    };
    add("Peso", "kg", anterior.pesoKg, depois.pesoKg);
    add("% de gordura", "%", anterior.gorduraPct, depois.gorduraPct);
    for (const m of MEDIDAS) add(m.rotulo, "cm", anterior.medidas[m.chave], depois.medidas[m.chave]);
    if (itens.length > 0) avaliacao = { antes: anterior.data, depois: depois.data, itens };
  }

  return {
    mes,
    aulas: porAula.size,
    aulasAntes: new Set(antes.map(chaveDaAula)).size,
    volumeKg: soma(doMes),
    volumeAntesKg: soma(antes),
    volumePorAula: [...porAula.values()].sort((a, b) => a.data.localeCompare(b.data)),
    exercicios,
    avaliacao,
    avaliacaoUnica: !avaliacao && depois ? depois : null,
  };
}

function maiorReps(p: PontoDeTreino): number | null {
  const r = p.series.map((s) => s.reps).filter((n): n is number => n != null);
  return r.length ? Math.max(...r) : p.repeticoes;
}

/** 8450.3 → "8.450 kg" */
export const textoDoVolume = (kg: number) => `${Math.round(kg).toLocaleString("pt-BR")} kg`;

/** Variação em %: 12 → "+12%"; null sem base. */
export function variacao(agora: number, antes: number): string | null {
  if (!antes) return null;
  const p = Math.round(((agora - antes) / antes) * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

/** Texto para o WhatsApp. */
export function textoDoWhatsapp(nome: string, r: RelatorioDoMes, noApp: boolean): string {
  const linhas = [`Oi, ${nome.split(" ")[0]}! Seu relatório de ${nomeDoMes(r.mes, true)}:`, ""];
  linhas.push(`• ${r.aulas} ${r.aulas === 1 ? "aula" : "aulas"} com treino registrado`);
  if (r.volumeKg > 0) {
    const v = variacao(r.volumeKg, r.volumeAntesKg);
    linhas.push(`• ${textoDoVolume(r.volumeKg)} levantados no mês${v ? ` (${v} em relação a ${nomeDoMes(mesAnterior(r.mes), true)})` : ""}`);
  }
  const subiram = r.exercicios.filter((e) => e.porCarga && e.pontos.length >= 2 && e.pontos[e.pontos.length - 1].valor > e.pontos[0].valor);
  for (const e of subiram.slice(0, 5)) {
    const u = e.unidade === "placas" ? " placas" : ` ${e.unidade}`;
    linhas.push(`• ${e.nome}: de ${numero(e.pontos[0].valor)} para ${numero(e.pontos[e.pontos.length - 1].valor)}${u}`);
  }
  if (r.avaliacao) {
    for (const i of r.avaliacao.itens.slice(0, 4)) {
      const d = Math.round((i.depois - i.antes) * 10) / 10;
      linhas.push(`• ${i.rotulo}: ${numero(i.depois)} ${i.unidade}${d ? ` (${d > 0 ? "+" : ""}${numero(d)})` : ""}`);
    }
  }
  if (noApp) linhas.push("", "Os gráficos estão no app P-Bell, no botão “Relatório do mês”.");
  linhas.push("", "Bora para o próximo mês! 💪");
  return linhas.join("\n");
}

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
