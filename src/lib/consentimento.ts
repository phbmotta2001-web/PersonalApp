// ╔══════════════════════════════════════════════════════════════════════╗
// ║  RASCUNHO: estes textos precisam de revisão jurídica (LGPD).          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Ao mudar o texto do consentimento, mude também a VERSÃO: o banco guarda qual
// versão cada pessoa aceitou (tabela "consentimentos").
//
// Desde 14/10/2026 as restrições são OBRIGATÓRIAS para enviar pedidos (segurança
// do aluno e respaldo do P-Bell). Ver docs/plano-perfil-e-privacidade.md.

export const VERSAO_CONSENTIMENTO_SAUDE = "saude-v1-rascunho";

// ─── Avisos por WhatsApp (aluno) ──────────────────────────────────────────
// Opcional (decisão de 15/10/2026). Fica registrado como consentimento tipo
// "whatsapp", com versão e data; só vale com número informado.
export const VERSAO_CONSENTIMENTO_WHATSAPP = "whatsapp-v1-rascunho";

export const TEXTO_CONSENTIMENTO_WHATSAPP = "Quero receber notificações do meu treino e avisos via WhatsApp";

export const AJUDA_CONSENTIMENTO_WHATSAPP =
  "Lembretes de aula, remarcações e cobranças. Você pode desligar quando quiser, no seu perfil.";

// ─── Personal ─────────────────────────────────────────────────────────────
// Aceito no cadastro do personal; a versão fica guardada na tabela "personais".
export const VERSAO_TERMO_CONFIDENCIALIDADE = "confidencialidade-v1-rascunho";

export const TEXTO_TERMO_CONFIDENCIALIDADE =
  "Comprometo-me a usar os dados dos meus alunos, inclusive os de saúde (restrições, " +
  "limitações, medidas), apenas para planejar e acompanhar os treinos deles, a não " +
  "compartilhá-los com terceiros e a mantê-los em sigilo, também depois do fim do vínculo. " +
  "Declaro que meu registro no CREF está ativo.";

export const TEXTO_CONSENTIMENTO_SAUDE =
  "Autorizo o P-Bell a guardar meus dados de saúde (restrições, limitações, peso, altura, " +
  "medidas e, no futuro, exames) para que personais avaliem meus pedidos e montem treinos " +
  "seguros para mim. Posso retirar esta autorização quando quiser, no meu perfil.";

// Fase 1: a autorização é necessária para o vínculo com o personal ficar ativo
// (perfil completo). O nome da constante vem do marketplace (Fase 2).
export const AVISO_CONSENTIMENTO_OBRIGATORIO_PEDIDO =
  "Necessária para treinar com um personal pelo P-Bell: ele precisa conhecer suas restrições " +
  "para treinar você com segurança.";

export const TEXTO_CONFIRMACAO_RESTRICOES = "Confirmo que minhas restrições e limitações estão atualizadas";

export const AVISO_RESTRICOES_NO_PEDIDO =
  "Suas restrições (ou a declaração de que não tem nenhuma) vão junto com todo pedido, para o " +
  "personal avaliar se pode treinar você com segurança. Manter essa informação atualizada é " +
  "sua responsabilidade.";

export const AVISO_APAGAR_30_DIAS =
  "Se o pedido for recusado ou não for respondido em 24 h, as informações de saúde " +
  "enviadas nele são apagadas em até 30 dias. Seu perfil não muda.";

export const AVISO_RETIRAR_CONSENTIMENTO =
  "Ao retirar a autorização, suas restrições, peso, altura e medidas são apagados do P-Bell, " +
  "as restrições de pedidos ainda sem resposta deixam de ser mostradas ao personal, e você " +
  "não poderá enviar novos pedidos até autorizar de novo.";
