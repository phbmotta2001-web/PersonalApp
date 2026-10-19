# Plano: Fase 1, agenda e cobrança do personal

**Pivot decidido em 15/10/2026.** Antes, o Pienel era um marketplace para alunos
encontrarem personais. Agora a **Fase 1** é a ferramenta de agenda e cobrança do
personal; o marketplace vira **Fase 2**, depois de uma base grande de personais ativos.
O plano anterior do marketplace continua em `docs/plano-fase-2-personal.md` (guardado).

## Proposta de valor
O personal organiza toda a vida profissional num só lugar (agenda, autoagendamento
dos alunos, lembretes e cobrança), em vez de juntar Google Agenda, link de pagamento
e WhatsApp na mão. **Não** é app de prescrição de treino.

## Escopo da Fase 1
1. Agenda do personal: aulas fixas, horários livres, remarcações e reposições.
2. Área do aluno: vê os treinos, remarca, cancela e usa reposições; o evento cai na
   agenda do personal na hora.
3. Lembretes automáticos por WhatsApp (aula do dia, remarcação, cobrança).
4. Cobrança recorrente das mensalidades dentro do app, com controle de inadimplência.
5. Modelo de negócio: mensalidade fixa paga pelo personal (R$ 120 a R$ 160/mês),
   gratuito para o aluno, **sem** taxa percentual sobre as aulas.

**Fora do escopo agora:** prescrição de treinos, gamificação e prêmios, taxa de 3 a
5% sobre as aulas, marketing e captação de alunos.

## Objetivo do beta
Validar com personais reais: agenda usada toda semana, personais dispostos a pagar e
volume cobrado pelo app, para levar números a um investidor.

## Decisões (15/10/2026)

| # | Tema | Decisão |
|---|---|---|
| 0 | Conta do aluno | **Existe e é obrigatória.** Nasce do **convite** do personal (link) e mantém as perguntas atuais (nome completo, nascimento, gênero opcional, objetivo, nível, restrições obrigatórias, peso, altura, medidas, autorização de saúde). Serve para: pagar o personal, ver os treinos, receber WhatsApp, reagendar ou cancelar, manter o cadastro que o personal consulta e um painel de acompanhamento aluno + personal. **Não** é usada para buscar personais na Fase 1. |
| 1 | Plano | Aprovado, começando pela etapa 0. |
| 2 | Pagamento no beta | Começa **registrando e lembrando** (pagamento por fora); o PSP entra no meio do beta. |
| 3 | PSP | **Asaas** como primeira opção (a confirmar tarifas, Pix Automático e o modelo BaaS/subcontas com o gerente de contas). |
| 4 | Aluno com mais de um personal | **Sim.** Ao abrir o convite de um segundo personal, o aluno **não refaz o cadastro**: ganha mais uma aba com os dados daquele personal. A agenda de treinos é outra aba, que junta os treinos de todos. Os dados do aluno são compartilhados com cada personal ligado a ele. |
| 5 | Agenda antes do cadastro do aluno | **Não.** O aluno só ocupa espaço na agenda depois de aceitar o convite e se cadastrar. Evita conflito de horário no cadastro e faz o personal trazer todos os alunos para o app. O cadastro do aluno é obrigatório e padrão. |
| 6 | Menores de 18 | **Só maiores têm conta no beta.** Para alunos menores, o personal poderá **adicioná-los manualmente na agenda**, sem conta (exceção prevista). |
| 7 | Entrada do aluno | **E-mail e senha** (o que já existe). |
| 8 | CREF | **Sem conferência na Fase 1** (sem captação): a conta nasce liberada. Volta na Fase 2. |
| 9 | Horários padrão | **Todos os dias ligados** (06:00–21:00); o personal desliga os que não trabalha. |
| 10 | Convite | **Link individual por aluno**, válido por **14 dias**, um aluno por link. Na Fase 2: link único do personal, para divulgar em redes sociais e captar alunos. |
| 11 | WhatsApp do aluno | **Opcional** (idosos, estrangeiros, quem não quer mensagens). Caixa "Quero receber notificações do meu treino e avisos via WhatsApp" no cadastro e no perfil. Sem número, sem avisos por lá. |
| 12 | Perfil completo | Obrigatório para o vínculo ficar ativo: objetivo, nível, autorização de saúde e declaração de restrições. |
| 13 | Excluir conta | Aluno e personal podem excluir a própria conta, confirmando com a senha. Hoje a exclusão é completa; quando houver cobranças, registros financeiros podem precisar ser guardados (apagando os dados pessoais). |
| 14 | Horário de aluno (16/10) | **Exclusivo:** um horário aceito por um aluno fica indisponível para os outros (o banco impede dois alunos no mesmo horário). Aula em dupla ou grupo fica para depois. |
| 15 | Duração por aluno (16/10) | **Pode ser diferente** da padrão do personal (a matrícula já vem com a padrão). |
| 16 | Fora do expediente (16/10) | Horário fixo fora do horário de trabalho **pode**, com aviso. |
| 17 | Valor e vencimento (16/10) | Pedidos **já na matrícula** (opcionais), só anotados até a etapa 7. |
| 18 | Tabela de valores (16/10) | O personal cadastra o **valor de cada aula por frequência semanal** (1x a 7x por semana), uma tabela só para qualquer duração. **Mensalidade = aula × vezes por semana × 4**, calculada sozinha na matrícula; "valor fora do padrão" é a exceção manual. Fase 2: o perfil público mostra "a partir de" (menor valor por aula) e a tabela completa. |
| 19 | Dias fixos do aluno (16/10) | Escolhidos em **caixas de marcar** (Seg a Dom), um horário por dia; marcar um dia já traz a hora do último. |
| 20 | Vencimento (16/10) | **Automático:** a 1ª mensalidade é paga no início da matrícula e as seguintes vencem um mês depois, todo mês no mesmo dia do início (no último dia do mês, se o dia não existir). O personal pode trocar o dia. |
| 21 | Aula sem marcação (16/10) | Aula que passou sem marcação **conta como dada**: o personal só marca as exceções. |
| 22 | Antecedência (16/10) | Aluno que cancela com **12 h** ou mais (ajustável: 2, 4, 6, 12, 24, 48 h ou outro valor até 168 h) ganha reposição; em cima da hora conta como dada. Cancelada pelo personal: sempre reposição. |
| 23 | Validade da reposição (16/10) | **Até o vencimento da mensalidade atual** (sem vencimento na matrícula: 30 dias). |
| 24 | Falta (16/10) | Falta sem aviso conta como dada, sem reposição. |
| 25 | Menores sem conta (16/10) | Ficam para uma etapa 5b, depois. |
| 26 | Histórico do perfil (16/10) | Peso, altura, outras medidas e objetivo guardam a data de cada mudança (histórico), para comparar no painel de acompanhamento. A ficha mostra "informado em". |
| 27 | Aluno resolve sozinho (17/10) | O **aluno cancela, remarca e marca reposição pelo app**; o personal recebe um **aviso** (sininho na agenda; WhatsApp na etapa 9). A opção manual do personal continua (menores, quem não usa o app). |
| 28 | Reposição pelo aluno (17/10) | Entra **direto na agenda**, nos horários livres do personal, com pelo menos **8 h** de antecedência (ajustável), para o personal ver o aviso. |
| 29 | Remarcar (17/10) | Num passo só, só com a antecedência de cancelamento; em cima da hora, o aluno fala com o personal. |
| 30 | Aniversários (17/10) | A agenda mostra os **aniversários dos alunos do mês** (e o do dia escolhido). O personal passa a ver o dia e o mês do aniversário, além da idade; o aluno é avisado no convite e no perfil. |
| 31 | Aprovação dos pedidos (18/10) | **Substitui a 28:** reposição e remarcação pedidas pelo aluno ficam **pendentes** (horário reservado) até o personal **aceitar, recusar (com motivo) ou sugerir outro horário**; na remarcação a aula original vale até o aceite. Sem resposta, o pedido **expira 2 h antes** e a reposição volta. Sem opção de aceitar automaticamente. |
| 32 | Calendário (18/10) | **Calendário do mês** na agenda (mês inteiro, filtro por aluno). Dias passados com as aulas em cores; dias futuros com as aulas marcadas (bolinha vazada); tocar no dia mostra a lista. Cores: verde = dada, azul = reposição, cinza = cancelada com antecedência, vermelho = perdida (falta ou em cima da hora). |
| 33 | Cobranças (18/10) | 1ª mensalidade **proporcional**, calculada pelo Pienel; mensalidade aparece **uma semana antes** do vencimento (com aviso); atrasada fica em vermelho para os dois e o nome do aluno fica vermelho na lista; sem bloqueio por enquanto; "Cobrar no WhatsApp" com um toque. Baixa automática só com o Asaas (etapa 10). |

### O que reaproveita, o que muda, o que fica escondido
- **Reaproveita:** base do app e visual; Supabase, login e regras de segurança do
  banco; cadastro e perfil do aluno (inclusive restrições e saúde); consentimentos;
  limpeza automática de hora em hora; regras de horário de `src/lib/agenda.ts`.
- **Muda:** a conta principal passa a ser a do **personal**; o aluno entra por
  convite; a agenda passa a ter datas reais, duração e bloqueios.
- **Escondido atrás da chave `MARKETPLACE_ATIVO` (desligada):** busca e filtros,
  perfil público do personal, "Tenho interesse", pedido e "Pedido enviado", página de
  teste da visão do personal e os 5 personais de exemplo. Nada é apagado; as tabelas
  de pedidos ficam congeladas.
- **Campo previsto para a Fase 2:** "Mostrar minha agenda na busca pública"
  (`visivel_na_busca`), padrão **desligado**.

## Modelo de dados

| Gaveta | O que guarda |
|---|---|
| **Personal** | nome, WhatsApp, CREF + estado, situação da conta, termo de confidencialidade (versão e data), regras (duração da aula, antecedência mínima para remarcar, cancelamento em cima da hora conta como aula, limite e validade das reposições), `visivel_na_busca` (desligado). |
| **Horários de trabalho** | por dia da semana, faixas de horário. |
| **Bloqueios** | período (data e hora) e motivo: férias, feriado, compromisso. |
| **Aluno (conta)** | o cadastro atual (tabelas `alunos`, `alunos_saude`, `consentimentos`). |
| **Vínculo personal ↔ aluno** | situação (convidado, ativo, encerrado), link de convite. Um aluno pode ter vários. O personal vê todos os dados do aluno enquanto o vínculo está ativo. |
| **Aluno sem conta (menor)** | nome e responsável, cadastrado à mão pelo personal (exceção). |
| **Matrícula** | vínculo, vezes por semana, horários fixos, local, valor mensal, dia de vencimento, início e fim. |
| **Aula** | data e hora reais, duração, aluno, local, origem (fixa, avulsa, reposição, experimental), situação (agendada, confirmada, realizada, falta, cancelada com aviso, cancelada em cima da hora, que conta como dada), quem marcou, aula original (se remarcada). |
| **Crédito de reposição** | aula que originou, válido até, aula em que foi usado. |
| **Cobrança** | matrícula, mês, valor, vencimento, situação (a vencer, paga, atrasada, cancelada, estornada), como foi paga (manual ou PSP), código no PSP. |
| **Mensagem** | tipo de lembrete, destinatário, quando deve sair, quando saiu, resultado. |
| **Assinatura do personal** | plano, valor, situação, período de teste. |

## Pagamentos (como integrar e custos)
- **Forma recomendada:** cada personal ganha uma **subconta Asaas** criada pelo
  Pienel (modelo BaaS / white label). O aluno paga dentro do Pienel e o dinheiro cai
  **direto na subconta do personal**; o Pienel nunca guarda dinheiro. O Asaas avisa o
  Pienel quando a cobrança é paga (webhook) e o app dá baixa sozinho.
- **Mensalidade:** padrão **Pix Automático** (o aluno autoriza uma vez); alternativas
  cartão recorrente e boleto/Pix avulso.
- **Mensalidade do personal ao Pienel:** cobrada pela conta própria do Pienel no Asaas.
- **Antes de integrar:** alinhar o BaaS com o gerente de contas do Asaas (as chaves das
  subcontas só funcionam além do período de avaliação dentro do BaaS), confirmar
  tarifas e o custo das subcontas por escrito.
- **Custos de referência** (outubro/2026, conferir na tabela oficial): Pix R$ 1,99
  por cobrança recebida; boleto entre R$ 1,99 e R$ 3,49; cartão 2,99% + R$ 0,49.
  Descontados da subconta do personal; o Pienel não cobra percentual.
- **WhatsApp automático:** mensagem de utilidade a ~R$ 0,035 cada (Meta, desde
  01/10/2026), mais mensalidade do provedor, se houver. Exemplo: ~15 mensagens por
  aluno por mês ≈ R$ 0,53 por aluno.

## Etapas

| # | Etapa | Situação |
|---|---|---|
| 0 | Preparação: marketplace desligado, conta de personal, página inicial nova | pronta (15/10) |
| 1 | Horários de trabalho e bloqueios (seg–dom, de 30 em 30 min, duração padrão 30/45/60/90) | pronta (15/10) |
| 2 | Convite e vínculo: o personal convida, o aluno se cadastra (ou só aceita, se já tem conta), abas por personal; excluir conta | pronta (15/10) |
| 3 | Matrículas e aulas fixas na agenda da semana e do dia | pronta (16/10) |
| 4 | App no celular (PWA) | — |
| 5 | Dia a dia da agenda: realizada, falta, cancelar, remarcar, avulsa, reposição, experimental, regras | pronta (16/10) |
| 5b | Alunos sem conta (menores) adicionados à mão, com matrícula | — |
| 6 | Área do aluno: cancelar, remarcar e marcar reposição pelo app; avisos para o personal (treinos ficam para depois) | pronta (17/10) |
| 7 | Cobranças registradas: mensalidades (1ª proporcional), atrasos, "marcar como recebido", Pix copia e cola + QR, "Já paguei" do aluno, cobrança avulsa | pronta (19/10) |
| 8 | WhatsApp com um toque (texto pronto) | cobrança pronta (19/10, junto da 7) |
| 9 | WhatsApp automático (aula do dia, remarcação, cobrança) | — |
| 10 | Pagamento pelo Asaas (subcontas, Pix Automático, baixa automática) | — |
| 11 | Painel de acompanhamento do aluno (presença, sequência, evolução) | — |
| 12 | Painel do beta (métricas para o investidor) | — |

## CREF (decisão de 15/10/2026)
Na Fase 1 **não há conferência do CREF**: o Pienel é a agenda do personal com os
próprios alunos, sem captação. Toda conta de personal nasce liberada ("aprovado").
O CREF continua sendo pedido no cadastro. A conferência (e uma tela de administração
para isso) volta na **Fase 2**, junto com o marketplace.

## Horários de trabalho (decisão de 15/10/2026)
Quem ainda não configurou começa com **todos os dias ligados, das 06:00 às 21:00**,
e desliga os dias em que não trabalha. Religar um dia copia o horário de outro dia
já ligado.

## Matrículas e aulas (decisão de 16/10/2026)
Cada aluno ativo tem no máximo uma matrícula ativa: horários fixos, duração, local,
valor mensal e dia de vencimento, início e fim. As aulas viram registros de verdade
para as **próximas 8 semanas**; um robô diário no banco estende a janela. Mudar os
horários vale **a partir de uma data** e refaz só as aulas futuras ainda agendadas.
Encerrar a matrícula, o vínculo ou a conta do aluno tira as aulas futuras da agenda.
Bloqueio por cima de aulas: o app avisa e as aulas continuam marcadas (o que fazer
com elas chega na etapa 5).

## Para começar já, fora do código
1. Pedido da conta empresarial verificada na Meta (WhatsApp), com número próprio.
2. Conta Asaas da plataforma e conversa sobre BaaS/subcontas com o gerente de contas.
3. **Região definitiva do Supabase antes do primeiro personal real** (o beta terá
   dados reais).
4. LGPD: o personal é o **controlador** dos dados dos alunos dele e o Pienel o
   **operador**; Termos, Política e contrato de tratamento de dados mudam.
5. CNPJ do Pienel, se ainda não existir.
