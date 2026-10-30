# Plano: perfil do aluno, cadastro e privacidade

Registro das decisões de produto e dos pontos pendentes. Atualizar sempre que uma
decisão mudar.

## ⚠️ Pendências que bloqueiam o uso com dados reais

| Pendência | Situação | Data |
|---|---|---|
| **Região do Supabase** | O projeto atual (`pienel-dev`) está em **us-west-2 (Oregon, EUA)**, **provisório e só para testes com dados de exemplo**. Aguardando resposta do suporte sobre São Paulo. Antes de qualquer dado real: criar o projeto definitivo na região escolhida (de preferência South America / São Paulo) e, se ficar fora do Brasil, tratar a transferência internacional (LGPD, art. 33) na Política de Privacidade e nos contratos. | 08/10/2026 |
| Revisão jurídica | Textos de consentimento, Política de Privacidade e Termos de Uso são **rascunhos**. Com as restrições obrigatórias: definir a base legal (consentimento condicionado, art. 9º §3º, ou art. 11, II, "e" — proteção da vida/integridade física — ou "f" — tutela da saúde por profissional de saúde); revisar a confirmação "restrições atualizadas" e incluir nos Termos que o aluno é responsável por mantê-las atualizadas; termo de confidencialidade do personal. | 14/10/2026 |
| Envio de e-mails | O envio padrão do Supabase serve só para testes. Contratar serviço de e-mail antes do lançamento. | — |

**Regra:** nenhum dado de pessoa real (cadastro, saúde, endereço) entra no projeto
`pienel-dev`. Ele é apagado ou substituído quando o projeto definitivo existir.

## Decisões tomadas

### Cadastro e conta
- Cadastro obrigatório antes de qualquer pedido: e-mail, senha, nome completo, data
  de nascimento e gênero (opcional).
- Só maiores de 18 anos.
- Nome completo e data de nascimento são fixos; correção só pelo suporte.
- E-mail muda só com confirmação ("Secure email change" no Supabase).
- Consentimento para dados de saúde no cadastro: separado, desmarcado por padrão, com
  finalidade explicada; registrar data e versão do texto; retirada a qualquer momento.

### Gênero
- Opções: Feminino, Masculino, Outro, Prefiro não informar. Campo opcional e editável.
- Usos (a Política de Privacidade explica cada um):
  1. Guardado no perfil, se informado.
  2. Busca: quem marcou Feminino não vê personais especializados só em treino
     masculino, e vice-versa. **"Outro", "Prefiro não informar" ou em branco nunca são
     excluídos.** A mesma regra vale no servidor ao receber um pedido.
  3. Visível ao personal só depois do aceite.
  4. Nunca usado para preço, ordem da busca, ranking, publicidade ou estatística individual.
- Dados de exemplo: Juliana Reis = especializada em treino feminino; demais = todos.

### Quem vê o quê

| Dado | Antes do aceite | Depois do aceite |
|---|---|---|
| Primeiro nome, objetivo, nível, bairro | sim | sim |
| Restrições declaradas (ou "declarou não ter") | sim, sempre | sim |
| Mensagem do pedido (até 200 caracteres, pode ter saúde) | sim | sim |
| Nome completo, idade, gênero, endereço completo | não | sim |
| Peso, altura, outras medidas | não | sim |
| Exames | não | só os que o aluno compartilhar; revogável |
| E-mail, senha, data de nascimento | não | não (o personal vê a idade) |

- **Restrições obrigatórias (decisão de 14/10/2026, substitui a autorização opcional).**
  Motivo: segurança do aluno e respaldo jurídico do Kout em caso de lesão.
  - No perfil, o aluno declara "Não tenho" ou "Sim, tenho" + descrição. A data da
    declaração fica guardada e muda só quando a resposta ou o texto mudam.
  - Todo pedido leva a declaração e exige marcar "Confirmo que minhas restrições e
    limitações estão atualizadas" (data guardada no pedido).
  - Para declarar, é preciso a autorização de dados de saúde; logo, ela é necessária
    para enviar pedidos (dá para navegar sem ela).
  - O personal vê "Restrições: …" ou "Declarou não ter restrições (confirmado em …)".
- O pedido guarda uma cópia (restrições declaradas + mensagem) do momento do envio.
- Pedido recusado ou expirado (24 h sem resposta): a cópia de saúde é apagada **no
  dia seguinte** (prometido ao aluno: "em até 30 dias"). O perfil do aluno não muda.
- Controle em duas camadas: função única no servidor (`perfilParaPersonal`) e regras
  de segurança por linha (RLS) no Supabase.

### Horários (decisão de 14/10/2026)
- Cada personal tem uma agenda semanal de horários livres (aulas de 1 h, começando
  em hora cheia, entre 06:00 e 21:00). Hoje vem dos dados de exemplo (inventados);
  depois, da agenda que o personal mantém no app.
- O perfil do personal mostra os horários livres de cada dia.
- No pedido, o aluno escolhe exatamente tantos horários quanto o plano (4x = 4),
  um por dia. Planos maiores que a agenda ficam desativados.
- O pedido não reserva o horário: ele só fica do aluno quando o personal aceitar.
- Busca: filtro "Quando você pode treinar" (dias + faixa "das Xh às Yh"). Aparece
  quem tem horário livre na faixa em pelo menos um dos dias; o card mostra "Livre em
  X de Y dias" e quem combina mais vem primeiro.

### WhatsApp
- A mensagem ao personal **não leva dados de saúde nem detalhes do pedido**: só
  "Você recebeu um novo pedido, abra o app".

## Fora desta etapa
Esqueci minha senha, trocar senha, excluir conta, baixar meus dados, upload de exames
e telas do personal.
