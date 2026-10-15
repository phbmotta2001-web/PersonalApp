// ╔══════════════════════════════════════════════════════════════════════╗
// ║  DADOS DE EXEMPLO: trocar por dados reais antes do lançamento.        ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Este arquivo existe só enquanto o app não tem banco de dados.
// As telas NÃO leem este arquivo diretamente: elas usam as funções de
// `src/data/personais.ts`. Para passar a usar dados reais, mude aquelas funções
// e depois apague este arquivo.
//
// A agenda de horários livres (disponibilidade) de TODOS foi inventada.
//
// De onde vem cada personal:
// - Camila Duarte: dados do protótipo navegável.
// - Juliana Reis, Rafael Nunes, Beatriz Lemos e Thiago Prado: o card veio do
//   protótipo, mas o perfil (textos, números e avaliações) foi INVENTADO para
//   testes. Avaliações inventadas não podem aparecer para alunos reais.

import type { Personal } from "../personais";

export const PERSONAIS_EXEMPLO: Personal[] = [
  {
    slug: "camila-duarte",
    publico: "todos",
    disponibilidade: { Seg: [7, 9], Ter: [6, 8], Qua: [7], Qui: [12], Sex: [7, 9], Sáb: [9] },
    nome: "Camila Duarte",
    genero: "f",
    cor: "av1",
    nivel: "ouro",
    bairro: "Ipanema",
    distancia: "600 m",
    especialidades: ["Fortalecimento", "Mobilidade", "50+"],
    objetivos: ["Fortalecimento", "Mobilidade", "Emagrecimento", "50+"],
    locais: ["casa", "ar-livre", "online"],
    precoAula: 110,
    nota: 4.9,
    avaliacoes: 38,
    renovacao: 92,
    perfil: {
      cref: "CREF 04••••-G/RJ",
      selo: "Fundadora nº 27",
      alunosAtivos: 12,
      tempoResposta: "~1 h",
      sobre:
        "Formada em Educação Física, com especialização em treinamento para mulheres 40+. Trabalho força, mobilidade e postura para você treinar sem dor e com constância.",
      ondeAtende: [
        { local: "casa", rotulo: "Na sua casa ou condomínio", regioes: "Ipanema, Leblon, Lagoa" },
        { local: "ar-livre", rotulo: "Ao ar livre", regioes: "Lagoa, Arpoador" },
        { local: "online", rotulo: "Online", regioes: "por vídeo" },
      ],
      planos: [
        { vezesPorSemana: 2, precoAula: 120, mensalidade: 960 },
        { vezesPorSemana: 3, precoAula: 110, mensalidade: 1320, maisEscolhido: true },
        { vezesPorSemana: 4, precoAula: 100, mensalidade: 1600 },
      ],
      depoimentos: [
        {
          autora: "Renata, 51",
          tempo: "treina há 8 meses",
          texto:
            "Cheguei com dor no joelho e medo de academia. Hoje desço a escada da praia sem pensar nisso.",
        },
        {
          autora: "Lúcia, 38",
          tempo: "treina há 1 ano",
          texto: "Pontual e organizada. O app me avisa da aula e cobra sozinho, eu só apareço.",
        },
      ],
      politicaCancelamento:
        "Cancelamentos com menos de 12 h contam como aula dada. Reposição em até 7 dias.",
    },
  },
  {
    slug: "juliana-reis",
    publico: "feminino",
    disponibilidade: { Seg: [10, 14], Ter: [9, 15], Qua: [10], Qui: [9, 14], Sáb: [8] },
    nome: "Juliana Reis",
    genero: "f",
    cor: "av2",
    nivel: "prata",
    bairro: "Leblon",
    distancia: "1,8 km",
    especialidades: ["Pilates", "Postura", "Gestantes"],
    objetivos: ["Pilates", "Mobilidade", "Pós-parto"],
    locais: ["casa", "academia"],
    precoAula: 130,
    nota: 5.0,
    avaliacoes: 21,
    renovacao: 88,
    perfil: {
      cref: "CREF 01••••-G/RJ",
      alunosAtivos: 9,
      tempoResposta: "~2 h",
      sobre:
        "Formada em Educação Física, com especialização em Pilates. Acompanho gestantes e mulheres no pós-parto, com foco em postura, respiração e fortalecimento do abdômen.",
      ondeAtende: [
        { local: "casa", rotulo: "Na sua casa ou condomínio", regioes: "Leblon, Ipanema, Gávea" },
        { local: "academia", rotulo: "Na academia", regioes: "Studio no Leblon" },
      ],
      planos: [
        { vezesPorSemana: 2, precoAula: 140, mensalidade: 1120 },
        { vezesPorSemana: 3, precoAula: 130, mensalidade: 1560, maisEscolhido: true },
        { vezesPorSemana: 4, precoAula: 120, mensalidade: 1920 },
      ],
      depoimentos: [
        {
          autora: "Carolina, 34",
          tempo: "treinou na gestação",
          texto:
            "Treinei com a Juliana até o oitavo mês. Tive menos dor nas costas e voltei a treinar rápido depois do parto.",
        },
        {
          autora: "Marta, 46",
          tempo: "treina há 6 meses",
          texto: "Minha postura mudou. As aulas são calmas, mas eu saio cansada do jeito certo.",
        },
      ],
      politicaCancelamento:
        "Cancelamentos com menos de 12 h contam como aula dada. Reposição em até 7 dias.",
    },
  },
  {
    slug: "rafael-nunes",
    publico: "todos",
    disponibilidade: { Seg: [6, 18, 19], Ter: [18], Qua: [6, 19], Qui: [18], Sex: [6, 19] },
    nome: "Rafael Nunes",
    genero: "m",
    cor: "av4",
    nivel: "elite",
    bairro: "Botafogo",
    distancia: "3,1 km",
    especialidades: ["Hipertrofia", "Força"],
    objetivos: ["Fortalecimento"],
    locais: ["academia", "online"],
    precoAula: 100,
    nota: 4.9,
    avaliacoes: 44,
    renovacao: 94,
    perfil: {
      cref: "CREF 02••••-G/RJ",
      alunosAtivos: 18,
      tempoResposta: "~30 min",
      sobre:
        "Especialista em musculação e treino de força. Monto treinos com aumento gradual de carga e acompanho cada evolução, na academia ou por vídeo.",
      ondeAtende: [
        { local: "academia", rotulo: "Na academia", regioes: "Botafogo, Flamengo" },
        { local: "online", rotulo: "Online", regioes: "por vídeo" },
      ],
      planos: [
        { vezesPorSemana: 2, precoAula: 110, mensalidade: 880 },
        { vezesPorSemana: 3, precoAula: 100, mensalidade: 1200, maisEscolhido: true },
        { vezesPorSemana: 4, precoAula: 90, mensalidade: 1440 },
      ],
      depoimentos: [
        {
          autora: "Patrícia, 41",
          tempo: "treina há 4 meses",
          texto:
            "Nunca tinha feito musculação. Ele corrige cada detalhe e me mostra a evolução das cargas.",
        },
        {
          autora: "Bruno, 29",
          tempo: "treina há 1 ano",
          texto: "Ganhei massa muscular em um ano, com treino bem explicado e sem lesão.",
        },
      ],
      politicaCancelamento:
        "Cancelamentos com menos de 12 h contam como aula dada. Reposição em até 7 dias.",
    },
  },
  {
    slug: "beatriz-lemos",
    publico: "todos",
    disponibilidade: { Seg: [6], Ter: [6, 7], Qua: [6], Qui: [7], Sex: [6], Sáb: [8, 9] },
    nome: "Beatriz Lemos",
    genero: "f",
    cor: "av3",
    nivel: "bronze",
    bairro: "Copacabana",
    distancia: "2,4 km",
    especialidades: ["Emagrecimento", "HIIT"],
    objetivos: ["Emagrecimento"],
    locais: ["casa", "ar-livre"],
    precoAula: 95,
    nota: 4.8,
    avaliacoes: 17,
    renovacao: 81,
    perfil: {
      cref: "CREF 05••••-G/RJ",
      alunosAtivos: 7,
      tempoResposta: "~3 h",
      sobre:
        "Treinos curtos e intensos para quem tem pouco tempo. Combino HIIT e exercícios funcionais com orientação de rotina para você emagrecer com saúde.",
      ondeAtende: [
        { local: "casa", rotulo: "Na sua casa ou condomínio", regioes: "Copacabana, Leme" },
        { local: "ar-livre", rotulo: "Ao ar livre", regioes: "Praia de Copacabana, Leme" },
      ],
      planos: [
        { vezesPorSemana: 2, precoAula: 105, mensalidade: 840 },
        { vezesPorSemana: 3, precoAula: 95, mensalidade: 1140, maisEscolhido: true },
        { vezesPorSemana: 4, precoAula: 85, mensalidade: 1360 },
      ],
      depoimentos: [
        {
          autora: "Aline, 32",
          tempo: "treina há 5 meses",
          texto:
            "Treino na praia antes do trabalho e já sinto a diferença. Ela me manda mensagem quando eu ameaço faltar.",
        },
        {
          autora: "Sônia, 44",
          tempo: "treina há 3 meses",
          texto: "Aulas animadas e que cabem no meu horário apertado.",
        },
      ],
      politicaCancelamento:
        "Cancelamentos com menos de 12 h contam como aula dada. Reposição em até 7 dias.",
    },
  },
  {
    slug: "thiago-prado",
    publico: "todos",
    disponibilidade: { Seg: [6, 20], Qua: [6, 20], Sáb: [7, 8] },
    nome: "Thiago Prado",
    genero: "m",
    cor: "av5",
    bairro: "Ipanema",
    distancia: "900 m",
    especialidades: ["Corrida", "Funcional"],
    objetivos: ["Corrida", "Emagrecimento"],
    locais: ["casa", "ar-livre", "online"],
    precoAula: 90,
    nota: 4.7,
    avaliacoes: 12,
    renovacao: 76,
    perfil: {
      cref: "CREF 03••••-G/RJ",
      alunosAtivos: 6,
      tempoResposta: "~2 h",
      sobre:
        "Corredor e treinador de corrida de rua. Preparo do primeiro 5 km à meia maratona, com treino funcional para fortalecer o corpo e evitar lesões.",
      ondeAtende: [
        { local: "casa", rotulo: "Na sua casa ou condomínio", regioes: "Ipanema, Copacabana" },
        { local: "ar-livre", rotulo: "Ao ar livre", regioes: "Orla de Ipanema, Lagoa" },
        { local: "online", rotulo: "Online", regioes: "planilha e vídeo" },
      ],
      planos: [
        { vezesPorSemana: 2, precoAula: 100, mensalidade: 800 },
        { vezesPorSemana: 3, precoAula: 90, mensalidade: 1080, maisEscolhido: true },
        { vezesPorSemana: 4, precoAula: 80, mensalidade: 1280 },
      ],
      depoimentos: [
        {
          autora: "Fernanda, 37",
          tempo: "treina há 7 meses",
          texto: "Saí do sofá e corri meus primeiros 10 km na Lagoa.",
        },
        {
          autora: "Rita, 52",
          tempo: "treina há 4 meses",
          texto: "Treino ao ar livre, sem pressa e com muito cuidado com os meus joelhos.",
        },
      ],
      politicaCancelamento:
        "Cancelamentos com menos de 12 h contam como aula dada. Reposição em até 7 dias.",
    },
  },
];
