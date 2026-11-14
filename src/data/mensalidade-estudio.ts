"use server";

// Decisão 102: o aluno do estúdio vê as mensalidades no app, paga pelo Pix do estúdio e avisa
// "Já paguei"; a coordenação confirma. Leituras devolvem vazio se a migração 64 não foi rodada.

import QRCode from "qrcode";
import { pixCopiaECola, type TipoChavePix } from "@/lib/pix";
import { criarClienteSupabase, usuarioAtual } from "@/lib/supabase/servidor";
import type { Resposta } from "./conta";

export interface MensalidadeNoEstudio {
  id: string;
  tipo: "mensalidade" | "taxa";
  vencimento: string;
  valorCentavos: number;
  situacao: "aberta" | "paga";
  pagoEm: string | null;
  avisou: boolean;
  /** Pix copia e cola e QR Code (só nas em aberto, se o estúdio cadastrou a chave). */
  pix: { codigo: string; qrSvg: string } | null;
}

export async function minhasMensalidadesNoEstudio(estudioId: string): Promise<MensalidadeNoEstudio[]> {
  const { supabase, id } = await usuarioAtual();
  if (!id) return [];
  const [{ data, error }, { data: pixs }] = await Promise.all([
    supabase.rpc("minhas_mensalidades_estudio", { p_estudio: estudioId }),
    supabase.rpc("pix_do_estudio_para_aluno", { p_estudio: estudioId }),
  ]);
  if (error || !data) return [];
  const pix = ((pixs ?? []) as { tipo: string; chave: string; nome: string | null; cidade: string | null }[])[0] ?? null;
  const lista = data as { id: string; tipo: string; vencimento: string; valor_centavos: number; situacao: string; pago_em: string | null; aluno_avisou_em: string | null }[];
  return Promise.all(
    lista.map(async (c) => {
      let codigo: { codigo: string; qrSvg: string } | null = null;
      if (pix && c.situacao === "aberta") {
        try {
          const texto = pixCopiaECola(
            { tipo: pix.tipo as TipoChavePix, chave: pix.chave, nome: pix.nome ?? "", cidade: pix.cidade ?? "" },
            c.valor_centavos,
            `PBELL${c.id.replace(/-/g, "").slice(0, 19)}`,
          );
          codigo = { codigo: texto, qrSvg: await QRCode.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
        } catch {
          codigo = null;
        }
      }
      return {
        id: c.id,
        tipo: c.tipo === "taxa" ? "taxa" : "mensalidade",
        vencimento: c.vencimento,
        valorCentavos: c.valor_centavos,
        situacao: c.situacao === "paga" ? "paga" : "aberta",
        pagoEm: c.pago_em,
        avisou: c.aluno_avisou_em != null,
        pix: codigo,
      } satisfies MensalidadeNoEstudio;
    }),
  );
}

export async function avisarPagamentoNoEstudio(cobrancaId: string): Promise<Resposta> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.rpc("avisar_pagamento_estudio", { p_cobranca: cobrancaId });
  if (!error) return { ok: true };
  return { ok: false, erro: /não/.test(error.message) && !/function|permission/.test(error.message) ? error.message : "Não foi possível avisar agora." };
}
