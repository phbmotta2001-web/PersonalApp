// Chaves liga/desliga de partes do Pienel (ver docs/plano-fase-1-agenda.md).
//
// MARKETPLACE_ATIVO: busca de personais, perfil público do personal, "Tenho interesse"
// e pedidos. É a base da Fase 2 e fica DESLIGADA na Fase 1 (agenda e cobrança do
// personal). Desligada, essas páginas respondem "não encontrada" e os links somem;
// nada é apagado. Para ligar em testes, coloque MARKETPLACE_ATIVO=true no .env.local
// e reinicie o npm run dev.

export const MARKETPLACE_ATIVO = process.env.MARKETPLACE_ATIVO === "true";
