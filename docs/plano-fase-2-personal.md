# Plano: fase 2, o lado do personal

Decisões tomadas em 14/10/2026. Complementa `docs/plano-perfil-e-privacidade.md`.
A fase 2 é entregue em 4 partes, cada uma testada antes da próxima:
**2A** conta, perfil e agenda · **2B** pedidos do personal · **2C** proposta e
contratação · **2D** avisos por e-mail.

## Decisões

| Tema | Decisão |
|---|---|
| Contas | Separadas: cada e-mail é aluno **ou** personal. |
| Aprovação do CREF | A equipe confere no site do CONFEF e aprova com um comando no SQL Editor (tela de administração depois). Até aprovar, o personal não aparece na busca. |
| Personais de exemplo | Continuam na busca com selo **"Exemplo"** e saem antes do lançamento. Pedidos para eles não podem ser respondidos. |
| Prazo de resposta | O personal tem **24 h** para responder o pedido. |
| Reserva temporária | Começa quando o aluno **envia o pedido** e dura até **48 h** a partir do envio. |
| Reserva permanente | Quando o aluno **paga pelo app** (fase 3). **Na fase 2, provisoriamente, ao aluno aceitar a proposta.** O horário entra sozinho na agenda do personal. |
| Limite | No máximo **3 pedidos em aberto** por aluno ao mesmo tempo. O aluno pode cancelar um pedido. |
| Pagamento | Fora da fase 2. A proposta mostra o valor e avisa que o pagamento pelo app chega depois. |
| Avisos | E-mail na 2D, sem dados de saúde. WhatsApp depois. |

## Linha do tempo de um pedido e dos horários

```
Aluno envia o pedido ────────► horários RESERVADOS TEMPORARIAMENTE
                                (somem da agenda livre para outros alunos)
   │
   ├─ personal não responde em 24 h ──► pedido EXPIRA ──► horários LIVRES de novo
   ├─ personal RECUSA ────────────────────────────────► horários LIVRES de novo
   ├─ aluno CANCELA ──────────────────────────────────► horários LIVRES de novo
   │
   └─ personal ACEITA e envia a PROPOSTA (pode trocar por outros horários livres;
      a reserva acompanha a troca)
         │
         ├─ passam 48 h desde o pedido sem o aluno aceitar ─► horários LIVRES
         ├─ aluno RECUSA a proposta ───────────────────────► horários LIVRES
         └─ aluno ACEITA ("Aceitar e agendar") ────────────► horários FIXOS
             (fase 3: só depois do pagamento)                na agenda do personal
```

**Pedido "em aberto"** (conta no limite de 3): aguardando o personal, ou com
proposta aguardando o aluno.

**Situações do pedido:** aguardando resposta · recusado · expirado · cancelado pelo
aluno · aceito (montando proposta) · proposta enviada · contratado · proposta
recusada · proposta expirada.

## Quem vê o quê (acréscimos)

- Depois do aceite, o personal vê os dados completos **enquanto o pedido estiver em
  andamento** (aceito / proposta enviada) e **enquanto o aluno estiver contratado**.
- Se não virar contrato (proposta recusada ou expirada, pedido cancelado), o personal
  volta a ver só o resumo, e a cópia de saúde do pedido é apagada no dia seguinte,
  como já acontece com pedidos recusados e expirados.
- Qualquer visitante vê o **perfil público** dos personais **aprovados**. CREF
  completo, celular e e-mail do personal não aparecem na busca.

## Parte 2A: conta, perfil e agenda do personal

1. **Cadastro** (`/profissional/cadastro`): e-mail, senha, nome completo, CREF
   (número + estado), gênero (para os textos "a Camila / o Rafael"), celular
   (avisos futuros) e aceite do **termo de confidencialidade** (rascunho, com versão
   e data guardadas).
2. **Situação da conta**: "em análise" → "aprovado" (ou "suspenso"). Fica um comando
   pronto em `docs/` para a equipe aprovar pelo SQL Editor.
3. **Perfil público editável**: sobre, especialidades, objetivos que atende, onde
   atende + regiões, público atendido (todos / treino feminino / masculino), planos
   (2x/3x/4x com preço por aula), bairro e cidade.
4. **Agenda** (`/profissional/agenda`): grade Seg–Sáb, 6h–21h. Cada horário aparece
   como livre, reservado (pedido aguardando, com prazo) ou ocupado (aluno contratado).
   O personal marca e desmarca horários livres; não consegue desmarcar os reservados
   nem os ocupados.
5. **Busca e perfil do personal passam a ler do banco**. Os 5 de exemplo vão para o
   banco com selo "Exemplo". Personal novo mostra **"Novo no P-Bell"** no lugar de
   nota, avaliações, nível e "% renovam". A distância sai; fica o bairro.
6. **Entrar** reconhece o tipo da conta e leva o personal para a área dele.

## Parte 2B: pedidos do personal

1. **`/profissional/pedidos`**: abas "Novos" e "Respondidos", com o tempo restante
   das 24 h e o selo "Bate com sua agenda".
2. **Detalhe do pedido** (tela "Pedido de aula" do protótipo), lendo pela função
   `perfil_para_personal` (dados bloqueados até o aceite).
3. **Aceitar** (vai para a proposta) ou **Recusar** (motivo opcional, ex.: "horários
   não batem"). Recusar libera os horários na hora.
4. **Aluno**: o pedido passa a reservar os horários, entra o limite de 3 em aberto e
   a opção **Cancelar pedido**.

## Parte 2C: proposta e contratação

1. **Montar proposta**: plano, preço mensal, horários (os do pedido, ou outros
   livres) e a data da **aula experimental** gratuita.
2. **Aluno ganha "Meus pedidos"** (aba "Pedidos" do protótipo): situação de cada
   pedido, a proposta, **"Aceitar e agendar"** ou recusar, e o prazo das 48 h.
3. **Aceitar a proposta** fixa os horários na agenda do personal, com o nome do aluno.

## Parte 2D: avisos por e-mail

- Personal: "Você recebeu um novo pedido, abra o P-Bell."
- Aluno: "Sua proposta chegou" / "Seu pedido foi recusado ou expirou".
- Nenhum dado de saúde. Exige contratar um serviço de envio de e-mail.

## Banco de dados (um arquivo SQL por parte)

- `personais`: perfil público, situação (em análise / aprovado / suspenso), CREF,
  celular, termo aceito (versão e data), se é exemplo.
- `agenda_personal`: horário semanal (dia + hora) e situação (livre / reservado /
  ocupado), ligado ao pedido que o reservou.
- `propostas`: plano, preço, horários, aula experimental, situação e prazo.
- `pedidos`: passa a apontar para o personal do banco e ganha as novas situações.
- Regras de segurança por linha: o público vê só personais aprovados; o personal
  edita só o próprio perfil e a própria agenda e vê só os pedidos feitos para ele;
  o aluno vê só os próprios pedidos e propostas.
- A limpeza de hora em hora também expira propostas e libera reservas vencidas.

## Como testar

Você cria uma conta de personal com outro apelido do seu e-mail
(ex.: `seuemail+personal@gmail.com`), aprova pelo SQL Editor e faz pedidos para
ela com a sua conta de aluno. Assim vê os dois lados de verdade. **Só dados de
exemplo**, porque o projeto do Supabase ainda é o provisório nos EUA.

## Pontos para revisão jurídica (novos)

- Termo de confidencialidade do personal (dados de saúde vistos antes do aceite,
  inclusive por quem recusa).
- CREF, celular e e-mail do personal como dados pessoais dele.
- O que acontece com o acesso do personal aos dados de saúde quando o aluno encerra
  o plano (fase 3 em diante).
- A reserva temporária de horário como compromisso (o que acontece se o personal
  aceitar e depois não cumprir).
