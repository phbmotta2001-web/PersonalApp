// Chaves liga/desliga de partes do P-Bell (ver docs/plano-fase-1-agenda.md).
//
// MARKETPLACE_ATIVO: busca de personais, perfil público do personal, "Tenho interesse"
// e pedidos. É a base da Fase 2 e fica DESLIGADA na Fase 1 (agenda e cobrança do
// personal). Desligada, essas páginas respondem "não encontrada" e os links somem;
// nada é apagado. Para ligar em testes, coloque MARKETPLACE_ATIVO=true no .env.local
// e reinicie o npm run dev.

export const MARKETPLACE_ATIVO = process.env.MARKETPLACE_ATIVO === "true";

// TERMOS_PUBLICADOS: Política de Privacidade e Termos de Uso (src/lib/textos-legais.ts).
// Publicados em 16/11/2026 (decisão 109): ficam ligados, e o cadastro pede a caixa marcada.
// Só TERMOS_PUBLICADOS=false na Vercel desliga.
export const TERMOS_PUBLICADOS = process.env.TERMOS_PUBLICADOS !== "false";
