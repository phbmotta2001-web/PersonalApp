// ╔══════════════════════════════════════════════════════════════════════╗
// ║  DADOS DE EXEMPLO: trocar por dados reais antes do lançamento.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Enquanto o app não tem cadastro nem login, todo mundo que usa o app é esta
// aluna. Nome, objetivos, restrições e nível vêm do protótipo (a "Mariana Couto"
// que envia o pedido para a Camila). As medidas foram inventadas.
// As telas NÃO leem este arquivo diretamente: elas usam `src/data/alunos.ts`.

import type { Aluno } from "@/lib/aluno";

export const ALUNO_EXEMPLO: Aluno = {
  nome: "Mariana Couto",
  objetivos: "Fortalecimento e postura. Quero perder 4 kg.",
  restricoes: "Dor lombar leve, já liberada pelo ortopedista.",
  nivel: "iniciante",
  privado: {
    pesoKg: 68,
    alturaCm: 165,
    outrasMedidas: "",
  },
};
