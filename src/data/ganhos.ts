"use server";

// Decisão 102: quanto o personal recebe no mês, por origem — estúdios, personal (presencial),
// consultoria online, aulas avulsas — e o total.

import { mensalidadesPrevistas } from "@/lib/cobranca";
import { usuarioAtual } from "@/lib/supabase/servidor";

export interface GanhoDeEstudio {
  estudioId: string;
  nome: string;
  /** Pago (se a coordenação já marcou) ou a previsão do mês. */
  valor: number;
  pago: boolean;
}

export interface GanhosDoMes {
  estudios: GanhoDeEstudio[];
  personal: number;
  online: number;
  avulsas: number;
  total: number;
}

/** Ganhos do mês de "hoje" ("AAAA-MM-DD"): cobranças do mês (pagas ou em aberto), mensalidades a gerar e os estúdios. */
export async function ganhosDoMes(hoje: string): Promise<GanhosDoMes> {
  const zero: GanhosDoMes = { estudios: [], personal: 0, online: 0, avulsas: 0, total: 0 };
  const { supabase, id } = await usuarioAtual();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return zero;
  const [a, m] = hoje.split("-").map(Number);
  const inicio = `${hoje.slice(0, 7)}-01`;
  const proximo = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const fimDoMes = new Date(Date.parse(`${proximo}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  const [{ data: cobrancas }, { data: matriculas }, { data: mensalidades }, { data: estudios }] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("tipo, valor_centavos, valor_pago_centavos, situacao, matriculas(modalidade)")
      .eq("personal_id", id)
      .neq("situacao", "cancelada")
      .gte("vencimento", inicio)
      .lt("vencimento", proximo),
    supabase
      .from("matriculas")
      .select("id, modalidade, valor_centavos, dia_vencimento, ciclo_meses, fim")
      .eq("personal_id", id)
      .eq("situacao", "ativa")
      .not("valor_centavos", "is", null)
      .not("dia_vencimento", "is", null),
    supabase.from("cobrancas").select("matricula_id, vencimento").eq("personal_id", id).eq("tipo", "mensalidade"),
    supabase.rpc("meus_ganhos_estudios", { p_mes: inicio }),
  ]);

  let personal = 0;
  let online = 0;
  let avulsas = 0;
  for (const c of cobrancas ?? []) {
    const valor = c.situacao === "paga" ? (c.valor_pago_centavos ?? c.valor_centavos) : c.valor_centavos;
    const modalidade = (c.matriculas as unknown as { modalidade: string } | null)?.modalidade;
    if (c.tipo === "avulsa") avulsas += valor;
    else if (modalidade === "online" || modalidade === "hibrido") online += valor;
    else personal += valor;
  }

  // Mensalidades que ainda vão ser geradas neste mês.
  const ultimo = new Map<string, string>();
  for (const c of mensalidades ?? [])
    if (c.matricula_id && (ultimo.get(c.matricula_id) ?? "") < c.vencimento) ultimo.set(c.matricula_id, c.vencimento);
  const previstas = (filtro: (modalidade: string) => boolean) =>
    mensalidadesPrevistas(
      (matriculas ?? [])
        .filter((mt) => filtro(mt.modalidade ?? "presencial"))
        .map((mt) => ({
          valorCentavos: mt.valor_centavos as number,
          diaVencimento: mt.dia_vencimento as number,
          cicloMeses: mt.ciclo_meses,
          fim: mt.fim,
          ultimoVencimento: ultimo.get(mt.id) ?? null,
        })),
      hoje,
      fimDoMes,
    );
  personal += previstas((x) => x !== "online" && x !== "hibrido");
  online += previstas((x) => x === "online" || x === "hibrido");

  const lista = ((estudios ?? []) as { estudio_id: string; nome: string; previsao_centavos: number; pago_em: string | null; valor_pago_centavos: number | null }[])
    .map((e) => ({
      estudioId: e.estudio_id,
      nome: e.nome,
      valor: e.pago_em ? (e.valor_pago_centavos ?? 0) : (e.previsao_centavos ?? 0),
      pago: e.pago_em != null,
    }))
    .filter((e) => e.valor > 0);

  const total = personal + online + avulsas + lista.reduce((s, e) => s + e.valor, 0);
  return { estudios: lista, personal, online, avulsas, total };
}
