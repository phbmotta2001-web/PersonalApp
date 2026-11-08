// Chaves liga/desliga de partes do P-Bell (ver docs/plano-fase-1-agenda.md).
//
// MARKETPLACE_ATIVO: busca de personais, perfil público do personal, "Tenho interesse"
// e pedidos. É a base da Fase 2 e fica DESLIGADA na Fase 1 (agenda e cobrança do
// personal). Desligada, essas páginas respondem "não encontrada" e os links somem;
// nada é apagado. Para ligar em testes, coloque MARKETPLACE_ATIVO=true no .env.local
// e reinicie o npm run dev.

export const MARKETPLACE_ATIVO = process.env.MARKETPLACE_ATIVO === "true";

// TERMOS_PUBLICADOS: Política de Privacidade e Termos de Uso (src/lib/textos-legais.ts).
// Ficam DESLIGADOS até a revisão jurídica. Desligados, as páginas /privacidade e /termos
// só abrem com npm run dev (para conferir o texto) e o cadastro não mostra o aceite.
// Para publicar: TERMOS_PUBLICADOS=true na Vercel (Production) e Redeploy.
export const TERMOS_PUBLICADOS = process.env.TERMOS_PUBLICADOS === "true";
