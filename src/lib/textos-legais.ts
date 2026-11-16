// Política de Privacidade e Termos de Uso, publicados em 16/11/2026 (decisão 109), antes da
// revisão jurídica, que ainda vai acontecer.
//
// Ao mudar o texto, mude também a VERSÃO (em versao-termos.ts): ela fica guardada na conta de
// quem aceitou, e quem aceitou uma versão anterior precisa aceitar de novo para entrar.

export { VERSAO_TERMOS } from "./versao-termos";
export const ATUALIZADO_EM = "16 de novembro de 2026";
export const CONTATO = "app.pbell@gmail.com";
const RESPONSAVEL = "Pedro Henrique Baptista Motta";

export type Bloco = string | { itens: string[] } | { tabela: { cabecalho: string[]; linhas: string[][] } };
export interface Secao {
  titulo: string;
  blocos: Bloco[];
}

export const POLITICA: Secao[] = [
  {
    titulo: "Quem somos",
    blocos: [
      `O P-Bell é um aplicativo para personal trainers, estúdios e academias organizarem agenda, turmas, alunos e mensalidades, e para os alunos acompanharem aulas, treinos e pagamentos. O responsável pelo P-Bell é ${RESPONSAVEL}.`,
      `Fale com a gente sobre privacidade em ${CONTATO}.`,
    ],
  },
  {
    titulo: "Quem decide o quê",
    blocos: [
      "Cada personal, estúdio ou academia que usa o P-Bell é o controlador dos dados dos seus alunos (LGPD, art. 5º, VI): decide quais dados coleta, para quê e com que base legal, e responde por isso perante os alunos e as autoridades.",
      "O P-Bell atua como operador desses dados (art. 5º, VII): só os guarda e organiza para o app funcionar, seguindo o uso que o personal, o estúdio ou a academia faz do app. O P-Bell não usa esses dados para fins próprios.",
      "Os dados da sua conta no P-Bell, como e-mail e senha, e os registros técnicos do serviço são responsabilidade do P-Bell.",
    ],
  },
  {
    titulo: "Que dados guardamos",
    blocos: [
      {
        tabela: {
          cabecalho: ["De quem", "Dados"],
          linhas: [
            ["Personal", "Nome completo, e-mail, senha (guardada de forma embaralhada, que não pode ser revertida), WhatsApp e, se informado, CREF. Também horários de trabalho, bloqueios, regras, valores, chave Pix e cidade, e os modelos de questionário e de formulário."],
            ["Estúdio ou academia", "Nome, tipo, horários de funcionamento, turmas, planos e valores, chave Pix, comunicados e a equipe: nome e WhatsApp dos profissionais, papéis e o que cada um recebe."],
            ["Aluno do estúdio", "Nome, WhatsApp, data de nascimento, turmas, presenças e faltas, reposições, mensalidades e as anotações da ficha feitas pela equipe."],
            ["Aluno com conta", "Nome completo, data de nascimento, e-mail, senha embaralhada, objetivo e nível. Se informados: gênero, WhatsApp, CEP, endereço, bairro e cidade."],
            ["Dados de saúde do aluno", "Restrições e limitações (ou a declaração de que não tem), peso, altura, outras medidas e o histórico dessas alterações. Avaliações físicas (peso, % de gordura e medidas). Respostas ao ParQ, à anamnese e aos questionários de acompanhamento, que podem falar de saúde, treino, sono e bem-estar. O treino de cada dia."],
            ["Aluno sem app", "O que o personal cadastrar: nome, data de nascimento, WhatsApp e observações. Em caso de menor de idade, também nome e WhatsApp do responsável e a data em que o personal confirmou a autorização dele."],
            ["Uso do serviço", "Aulas, faltas, remarcações, reposições, pausas, matrículas e cobranças (valor, vencimento e situação). O registro dos aceites, com data e versão do texto."],
            ["Técnicos", "Cookie de sessão, a inscrição para notificações do aparelho e registros técnicos dos nossos fornecedores."],
          ],
        },
      },
      "O P-Bell não recebe dados de cartão nem de conta bancária. O Pix é pago direto ao personal ou ao estúdio, fora do app. O aluno só avisa que pagou, e quem recebe confirma.",
    ],
  },
  {
    titulo: "Para que usamos",
    blocos: [
      {
        tabela: {
          cabecalho: ["Finalidade", "Base legal"],
          linhas: [
            ["Criar e manter sua conta, agenda, matrículas e cobranças", "Execução de contrato (LGPD, art. 7º, V)"],
            ["Permitir que o personal treine o aluno com segurança, conhecendo restrições e medidas", "Consentimento específico (art. 11, I)"],
            ["Enviar lembretes e avisos no celular, se você ativar", "Consentimento (art. 7º, I)"],
            ["Manter o serviço seguro e prevenir fraude", "Legítimo interesse (art. 7º, IX) e prevenção à fraude (art. 11, II, g)"],
            ["Cumprir obrigações legais e exercer direitos em processos", "Art. 7º, II e VI, e art. 11, II, a e d"],
          ],
        },
      },
      "Não vendemos seus dados e não os usamos para publicidade. O P-Bell não usa ferramentas de anúncios nem de análise de visitantes.",
    ],
  },
  {
    titulo: "Quem pode ver seus dados",
    blocos: [
      {
        itens: [
          "Seu personal: vê seu perfil, seus dados de saúde, avaliações, aulas, cobranças e respostas enquanto vocês tiverem vínculo. Ele não vê sua senha.",
          "O estúdio ou a academia onde você treina: a coordenação e os professores da equipe veem os seus dados no estúdio (ficha, saúde, avaliações, respostas, turmas, presença e mensalidades), conforme o papel de cada um.",
          "Seu estúdio: se você é professor, a coordenação vê seus dados na equipe, suas aulas e o que você recebe.",
          "Seus alunos: veem seu nome, seu WhatsApp, seu CREF, se informado, e sua chave Pix nas cobranças.",
          "Outros usuários: não veem seus dados.",
          "Fornecedores: veja a próxima seção.",
          "Autoridades: quando a lei ou uma ordem judicial exigir.",
        ],
      },
    ],
  },
  {
    titulo: "Fornecedores e transferência internacional",
    blocos: [
      {
        tabela: {
          cabecalho: ["Fornecedor", "Para quê", "Onde"],
          linhas: [
            ["Supabase", "Banco de dados e login", "São Paulo; empresa estrangeira"],
            ["Vercel", "Hospedagem do site", "São Paulo; empresa estrangeira"],
            ["Resend", "E-mails de confirmação e de senha", "São Paulo; empresa estrangeira"],
            ["Apple, Google e outros serviços de push", "Entregar notificações, com o texto do aviso, aos aparelhos", "Exterior"],
            ["GoDaddy", "Registro do domínio; não recebe dados de contas", "Exterior"],
          ],
        },
      },
      "Quando alguém usa os botões de WhatsApp, o aparelho abre o WhatsApp com a mensagem pronta. O envio é feito pela própria pessoa, e o uso segue as regras do WhatsApp.",
    ],
  },
  {
    titulo: "Por quanto tempo guardamos",
    blocos: [
      {
        tabela: {
          cabecalho: ["Situação", "O que acontece"],
          linhas: [
            ["Aluno retira a autorização de saúde", "Restrições, peso, altura e medidas são apagados."],
            ["Aluno exclui a conta", "Perfil, dados de saúde e autorizações são apagados. O personal mantém o nome usado no convite e os registros de aulas e cobranças, sem ligação com a conta."],
            ["Personal exclui a conta", "A conta, horários, convites, vínculos, aulas e cobranças dele são apagados. As contas dos alunos continuam."],
            ["Notificações enviadas", "Apagadas depois de 30 dias."],
            ["Contas, aulas e cobranças", "Ficam guardadas enquanto a conta existir. Você pode pedir a exclusão a qualquer momento."],
          ],
        },
      },
      "Podemos guardar por mais tempo o que a lei exigir.",
    ],
  },
  {
    titulo: "Crianças e adolescentes",
    blocos: [
      "Só maiores de 18 anos criam conta. Um aluno menor de idade só entra no P-Bell cadastrado pelo personal ou pelo estúdio, com a autorização de um responsável, que quem cadastra se compromete a obter. O responsável pode pedir a correção ou a exclusão desses dados ao personal, ao estúdio ou pelo nosso contato.",
    ],
  },
  {
    titulo: "Seus direitos",
    blocos: [
      "Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização ou eliminação do que for desnecessário, portabilidade, informação sobre com quem compartilhamos e a retirada do consentimento (art. 18 da LGPD). Também pode reclamar à ANPD.",
      {
        itens: [
          "No app: editar seu perfil, retirar a autorização de saúde, desligar notificações e excluir sua conta.",
          `Pelo contato (${CONTATO}): pedidos de cópia dos dados e os demais. Respondemos em até 15 dias.`,
          "Com o personal ou o estúdio: como controladores, eles respondem pelos dados que cadastraram e pelos pedidos sobre eles.",
        ],
      },
      "Nome completo e data de nascimento só mudam pelo nosso suporte.",
    ],
  },
  {
    titulo: "Segurança",
    blocos: [
      "O acesso ao site é criptografado, a senha não fica guardada de forma legível, e o banco só libera a cada usuário os dados que ele pode ver. Nenhum sistema é totalmente seguro: se houver um incidente com risco relevante, avisaremos você e a ANPD, como manda a lei. Use uma senha só sua e não a compartilhe.",
    ],
  },
  {
    titulo: "Cookies e armazenamento no aparelho",
    blocos: [
      "Usamos um cookie para manter você conectado e guardamos no aparelho se você dispensou os convites para instalar o app ou ativar as notificações. Sem o cookie de sessão, o login não funciona. O app não guarda dados de alunos, agenda ou cobranças no aparelho para uso sem internet.",
    ],
  },
  {
    titulo: "Mudanças nesta política",
    blocos: [
      "Se esta política mudar de forma relevante, avisaremos pelo app ou por e-mail antes de a mudança valer. Se depender do seu consentimento, pediremos de novo.",
    ],
  },
];

export const TERMOS: Secao[] = [
  {
    titulo: "O que é o P-Bell",
    blocos: [
      `O P-Bell é uma ferramenta de organização para personal trainers, estúdios, academias e seus alunos: agenda, turmas, reposições, pausas, cobranças, avisos, treinos, avaliações e formulários. É oferecido por ${RESPONSAVEL}. Para usar o P-Bell, você precisa aceitar estes termos e a Política de Privacidade.`,
    ],
  },
  {
    titulo: "O que o P-Bell não é",
    blocos: [
      {
        itens: [
          "Não presta serviço de treino, não prescreve exercícios e não dá orientação de saúde.",
          "Não contrata nem indica personais, e não confere formação nem registro profissional.",
          "Não participa do combinado entre personal, estúdio e aluno, não recebe nem repassa os pagamentos e não cobra inadimplentes.",
          "Não confere, não usa e não decide sobre os dados que os usuários cadastram.",
        ],
      },
    ],
  },
  {
    titulo: "Versão de testes (beta)",
    blocos: [
      "Esta é uma versão de testes, oferecida gratuitamente. Funções podem mudar, falhar ou sair do ar. Não use o P-Bell como único registro de informações importantes. Avisaremos com antecedência razoável sobre o fim da beta ou o início de cobrança.",
    ],
  },
  {
    titulo: "Sua conta",
    blocos: [
      {
        itens: [
          "É preciso ter pelo menos 18 anos e informar dados verdadeiros.",
          "A conta é pessoal. Você responde pelo que for feito com a sua senha.",
          "Você pode excluir a conta a qualquer momento, no próprio app.",
        ],
      },
    ],
  },
  {
    titulo: "Dados dos alunos: de quem é a responsabilidade",
    blocos: [
      "O personal, o estúdio ou a academia é o controlador dos dados que cadastra ou recebe dos seus alunos e profissionais (LGPD, art. 5º, VI) e responde por eles. Isso inclui:",
      {
        itens: [
          "ter base legal para cada dado e, quando a lei exigir, o consentimento do aluno, ou do responsável se for menor de idade, inclusive para os dados de saúde;",
          "informar os alunos sobre como os dados são usados;",
          "usar os dados só para os treinos, as aulas, as avaliações e as cobranças, em sigilo, também depois do fim do vínculo;",
          "manter os dados corretos e atender os pedidos dos alunos sobre os próprios dados;",
          "controlar quem da sua equipe tem acesso e responder pelo que os profissionais fizerem com os dados.",
        ],
      },
      "O P-Bell é operador desses dados (art. 5º, VII): só os guarda e organiza para o app funcionar. Na medida em que a lei permitir, o P-Bell não responde pelo uso que o personal, o estúdio, a academia ou os seus profissionais fizerem dos dados, nem pela falta de autorização para cadastrá-los. Quem causar um dano por uso indevido de dados se compromete a ressarcir o P-Bell pelo que ele tiver de pagar ou gastar por causa disso.",
      "Cada usuário responde pela verdade dos dados que informa sobre si mesmo, inclusive os de saúde.",
    ],
  },
  {
    titulo: "Compromissos do personal, do estúdio e da academia",
    blocos: [
      {
        itens: [
          "Atuar de acordo com as leis e as regras da profissão, inclusive quanto a registro e supervisão. Se informar um CREF, ele deve estar ativo.",
          "Responder pelos treinos, pelas orientações, pelas avaliações, pelos valores cobrados e pela relação com cada aluno.",
          "Cadastrar aluno sem app só com autorização dele e, se for menor de idade, do responsável.",
          "Manter corretos os dados de cobrança e a chave Pix, que é de sua responsabilidade.",
          "No estúdio ou na academia: convidar para a equipe só profissionais de confiança e retirar o acesso de quem sair.",
        ],
      },
    ],
  },
  {
    titulo: "Compromissos do aluno",
    blocos: [
      {
        itens: [
          "Manter atualizadas suas restrições e limitações de saúde, porque seu personal depende delas para treinar você com segurança.",
          "Consultar um profissional de saúde quando necessário. O P-Bell não avalia se você pode treinar.",
          "Combinar diretamente com o personal ou o estúdio os pagamentos, as regras de cancelamento e as reposições.",
          "Saber que seus dados de saúde, avaliações e respostas ficam visíveis para o seu personal ou para a equipe do estúdio onde você treina, que decidem como usá-los e respondem por isso.",
        ],
      },
    ],
  },
  {
    titulo: "Uso proibido",
    blocos: [
      "Não é permitido usar o P-Bell para fraudar, enganar ou assediar, inserir dados de terceiros sem autorização, tentar acessar dados de outras pessoas, atrapalhar o funcionamento do serviço ou copiar o app.",
    ],
  },
  {
    titulo: "Suspensão e encerramento",
    blocos: [
      "Podemos suspender ou encerrar contas que descumpram estes termos ou a lei, avisando sempre que possível. Depois do encerramento, os dados seguem o que está na Política de Privacidade.",
    ],
  },
  {
    titulo: "Propriedade intelectual",
    blocos: [
      `O app, a marca e os textos do P-Bell pertencem a ${RESPONSAVEL}. Os dados que você insere continuam sendo seus. Você nos autoriza a tratá-los apenas para fazer o serviço funcionar.`,
    ],
  },
  {
    titulo: "Limites de responsabilidade",
    blocos: [
      "Nos limites da lei, o P-Bell não responde por lesões ou danos ligados aos treinos, por dívidas ou desacordos entre personal, estúdio e aluno, por erros em dados inseridos pelos usuários, pelo uso que personais, estúdios, academias e seus profissionais fizerem dos dados dos alunos, por acessos feitos com a sua senha, nem por falhas de internet, aparelhos ou serviços de terceiros. Estes termos não retiram direitos garantidos pelo Código de Defesa do Consumidor.",
    ],
  },
  {
    titulo: "Mudanças nos termos",
    blocos: [
      "Avisaremos pelo app ou por e-mail sobre mudanças relevantes, antes de valerem. Se não concordar, você pode excluir sua conta.",
    ],
  },
  {
    titulo: "Lei e foro",
    blocos: [
      `Valem as leis do Brasil. Fica eleito o foro da comarca do Rio de Janeiro (RJ), sem prejuízo do direito do consumidor de usar o foro do próprio domicílio. Contato: ${CONTATO}.`,
    ],
  },
];
