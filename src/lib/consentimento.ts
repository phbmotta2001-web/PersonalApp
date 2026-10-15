// ╔══════════════════════════════════════════════════════════════════════╗
// ║  RASCUNHO: estes textos precisam de revisão jurídica (LGPD).          ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Ao mudar o texto do consentimento, mude também a VERSÃO: o banco guarda qual
// versão cada pessoa aceitou (tabela "consentimentos").
//
// Desde 14/10/2026 as restrições são OBRIGATÓRIAS para enviar pedidos (segurança
// do aluno e respaldo do Pienel). Ver docs/plano-perfil-e-privacidade.md.

export const VERSAO_CONSENTIMENTO_SAUDE = "saude-v1-rascunho";

export const TEXTO_CONSENTIMENTO_SAUDE =
  "Autorizo o Pienel a guardar meus dados de saúde (restrições, limitações, peso, altura, " +
  "medidas e, no futuro, exames) para que personais avaliem meus pedidos e montem treinos " +
  "seguros para mim. Posso retirar esta autorização quando quiser, no meu perfil.";

export const AVISO_CONSENTIMENTO_OBRIGATORIO_PEDIDO =
  "Sem esta autorização você pode navegar, mas não pode enviar pedidos: o personal precisa " +
  "conhecer suas restrições para treinar você com segurança.";

export const TEXTO_CONFIRMACAO_RESTRICOES = "Confirmo que minhas restrições e limitações estão atualizadas";

export const AVISO_RESTRICOES_NO_PEDIDO =
  "Suas restrições (ou a declaração de que não tem nenhuma) vão junto com todo pedido, para o " +
  "personal avaliar se pode treinar você com segurança. Manter essa informação atualizada é " +
  "sua responsabilidade.";

export const AVISO_APAGAR_30_DIAS =
  "Se o pedido for recusado ou não for respondido em 24 h, as informações de saúde " +
  "enviadas nele são apagadas em até 30 dias. Seu perfil não muda.";

export const AVISO_RETIRAR_CONSENTIMENTO =
  "Ao retirar a autorização, suas restrições, peso, altura e medidas são apagados do Pienel, " +
  "as restrições de pedidos ainda sem resposta deixam de ser mostradas ao personal, e você " +
  "não poderá enviar novos pedidos até autorizar de novo.";
