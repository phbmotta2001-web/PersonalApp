// Gera os guias da beta (professores e coordenação) em HTML e PDF.
// Uso: node docs/guias-beta/gerar.mjs  (precisa do Microsoft Edge instalado)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const logo = fs.readFileSync(path.join(aqui, "../../public/icones/icone-192.png")).toString("base64");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const CSS = `
:root { --cor: #1c5a42; --fundo: #123b2c; --suave: #e6efe9; --borda: #c3d6cb; --fundo-claro: #edf2ef; }
body.estudio { --cor: #1f5f6b; --fundo: #17474f; --suave: #e2eef0; --borda: #bcd8dc; --fundo-claro: #ebf3f4; }
body.aluno { --cor: #1f4f8a; --fundo: #163a66; --suave: #e4ecf7; --borda: #bfd0ea; --fundo-claro: #edf2f9; }
.grande { font-size: 11.6pt; }
.destaque { background: var(--fundo); color: #fff; border-radius: 14px; padding: 14px 16px; margin: 8px 0 10px; break-inside: avoid; }
.destaque h3 { color: #c8f06a; margin: 0 0 6px; font-size: 13pt; }
.destaque p { margin: 0 0 6px; }
.destaque ul { margin: 0; }
@page { size: A4; margin: 16mm 15mm 16mm 15mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Figtree", system-ui, sans-serif; color: #10201a; font-size: 10.6pt; line-height: 1.45; }
h1, h2, h3 { font-family: "Bricolage Grotesque", "Figtree", sans-serif; margin: 0; }
.capa { background: var(--fundo); color: #fff; border-radius: 18px; padding: 26px 28px; margin-bottom: 18px; }
.capa .marca { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.capa .marca img { width: 44px; height: 44px; border-radius: 11px; }
.capa .marca span { font-family: "Bricolage Grotesque"; font-weight: 800; font-size: 18pt; }
.capa .rotulo { color: #c8f06a; text-transform: uppercase; letter-spacing: .08em; font-size: 8.5pt; font-weight: 700; opacity: .8; }
.capa h1 { font-size: 25pt; line-height: 1.1; font-weight: 800; margin: 4px 0 8px; }
.capa p { margin: 0; font-size: 11pt; opacity: .92; }
h2 { font-size: 15pt; font-weight: 800; color: var(--cor); margin: 16px 0 7px; break-after: avoid; }
h2 .n { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--cor); color: #fff; font-size: 11pt; margin-right: 8px; vertical-align: 2px; }
h3 { font-size: 11.5pt; font-weight: 700; margin: 12px 0 4px; break-after: avoid; }
p { margin: 0 0 7px; }
ul, ol { margin: 0 0 8px; padding-left: 20px; }
li { margin-bottom: 3px; }
b { font-weight: 700; }
.botao { display: inline-block; border: 1px solid var(--borda); background: var(--suave); color: var(--cor); border-radius: 6px; padding: 0 6px; font-weight: 700; font-size: 9.8pt; white-space: nowrap; }
.caixa { border: 1px solid #d6dfda; border-radius: 14px; padding: 12px 14px; margin: 8px 0 10px; break-inside: avoid; }
.dica { background: var(--fundo-claro); border-left: 4px solid var(--cor); border-radius: 10px; padding: 9px 12px; margin: 8px 0 10px; break-inside: avoid; }
.dica b:first-child { color: var(--cor); }
.atencao { background: #fbf4e6; border-left: 4px solid #7a5400; border-radius: 10px; padding: 9px 12px; margin: 8px 0 10px; break-inside: avoid; }
.atencao b:first-child { color: #7a5400; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.duas .caixa { margin: 0; }
.caixa h3 { margin-top: 0; }
.passos { counter-reset: p; list-style: none; padding-left: 0; }
.passos > li { counter-increment: p; position: relative; padding-left: 30px; margin-bottom: 6px; }
.passos > li::before { content: counter(p); position: absolute; left: 0; top: 1px; width: 21px; height: 21px; border-radius: 50%; background: var(--cor); color: #fff; font-weight: 700; font-size: 9pt; display: grid; place-items: center; }
.abas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 6px 0 10px; }
.abas.seis { grid-template-columns: repeat(3, 1fr); }
.abas.cinco { grid-template-columns: repeat(5, 1fr); gap: 6px; }
.abas.cinco .aba { padding: 8px 9px; }
.aba { background: var(--fundo-claro); border-radius: 12px; padding: 9px 11px; break-inside: avoid; }
.aba b { display: block; color: var(--cor); font-size: 11pt; }
.aba span { font-size: 9.5pt; color: #3f5148; }
.icones span { display: inline-block; margin-right: 10px; }
.rodape { margin-top: 22px; padding-top: 10px; border-top: 1px solid #d6dfda; font-size: 9pt; color: #4b5a53; }
.quebra { break-before: page; }
`;

const pagina = (titulo, corpo, tema = "") => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Figtree:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body class="${tema}">${corpo.replaceAll("{LOGO}", `data:image/png;base64,${logo}`)}</body></html>`;

// ── Instalação: igual nos dois guias ──────────────────────────────────────────
const instalar = (onde, comNotificacoes = true) => `
<p>O P-Bell não fica na App Store nem no Google Play durante a beta: ele é instalado pelo navegador, em menos de um minuto, e depois abre com um toque, em tela cheia, como qualquer app.</p>
<div class="duas">
  <div class="caixa">
    <h3>iPhone</h3>
    <ol class="passos">
      <li>Abra ${onde} no <b>Safari</b>. Em outro navegador não dá para instalar.</li>
      <li>Toque no botão <span class="botao">Compartilhar</span> (o quadrado com a seta para cima, embaixo da tela).</li>
      <li>Role a lista e toque em <span class="botao">Adicionar à Tela de Início</span>.</li>
      <li>Toque em <span class="botao">Adicionar</span>. O ícone do P-Bell aparece junto dos seus apps.</li>
      <li>Abra o P-Bell <b>pelo ícone</b> e entre com seu e-mail e senha.</li>
    </ol>
  </div>
  <div class="caixa">
    <h3>Android</h3>
    <ol class="passos">
      <li>Abra ${onde} no <b>Chrome</b>.</li>
      <li>Se aparecer <span class="botao">Instalar o P-Bell</span>, toque nele.</li>
      <li>Se não aparecer, toque no menu <span class="botao">⋮</span> (canto de cima) e depois em <span class="botao">Instalar app</span> ou <span class="botao">Adicionar à tela inicial</span>.</li>
      <li>Confirme em <span class="botao">Instalar</span>. O ícone do P-Bell aparece junto dos seus apps.</li>
      <li>Abra o P-Bell <b>pelo ícone</b> e entre com seu e-mail e senha.</li>
    </ol>
  </div>
</div>
${comNotificacoes ? `<h3>Ligue as notificações</h3>
<p>Na primeira vez que abrir o app instalado, aparece o quadro <span class="botao">Ligue as notificações</span>. Toque em <span class="botao">Ligar notificações</span> e depois em <b>Permitir</b>. É assim que chegam no celular os pedidos, as mudanças de aula e os avisos.</p>
<div class="atencao"><b>No iPhone,</b> as notificações só funcionam com o app instalado e aberto pelo ícone (iOS 16.4 ou mais novo). Se você recusou sem querer, libere em <b>Ajustes do iPhone &gt; Notificações &gt; P-Bell</b>.</div>` : ""}
`;

// ── Guia dos professores (personal que trabalha por conta própria) ────────────
const PROFESSORES = `
<div class="capa">
  <div class="marca"><img src="{LOGO}" alt=""><span>P-Bell</span></div>
  <div class="rotulo">Guia da beta · Professores</div>
  <h1>Sua agenda e seus alunos em dia</h1>
  <p>Aulas, reposições, mensalidades por Pix, treinos e avaliações, tudo no celular.</p>
</div>

<h2><span class="n">1</span>Crie sua conta</h2>
<ol class="passos">
  <li>Abra <b>pbell.com.br</b> e toque em criar conta de personal.</li>
  <li>Preencha e-mail, uma senha de pelo menos 8 caracteres, nome completo, WhatsApp (com DDD) e, se tiver, o CREF.</li>
  <li>Marque o <b>termo de confidencialidade</b> e a caixa dos <b>Termos de Uso e da Política de Privacidade</b>. Se pedir, confirme o e-mail pelo link que chega na sua caixa de entrada.</li>
  <li>No <b>primeiro acesso</b>, o app pergunta, em etapas: seus horários de trabalho, se você trabalha nos feriados, as regras de cancelamento e reposição, o valor das aulas, se você atende online e sua chave Pix. Na dúvida, os valores sugeridos são os mais usados, e tudo pode ser mudado depois em <b>Conta</b>.</li>
</ol>

<h2><span class="n">2</span>Instale o app no celular</h2>
${instalar("<b>pbell.com.br</b>")}

<h2><span class="n">3</span>As abas do app</h2>
<div class="abas cinco">
  <div class="aba"><b>Início</b><span>Próxima aula e o que precisa de você.</span></div>
  <div class="aba"><b>Agenda</b><span>Suas aulas da semana.</span></div>
  <div class="aba"><b>Alunos</b><span>Convites, fichas e matrículas.</span></div>
  <div class="aba"><b>Financeiro</b><span>Mensalidades, Pix e o mês.</span></div>
  <div class="aba"><b>Conta</b><span>Horários, regras, valores e Pix.</span></div>
</div>
<div class="dica"><b>Regra de ouro:</b> tudo o que precisa de você aparece <b>no alto do Início</b>, no quadro <b>Precisa de você</b>: aluno pedindo para remarcar, aluno que avisou que pagou, mensalidade atrasada, aluno novo para pôr na agenda. O sino no canto mostra todos os avisos, cada um com seu ícone.</div>

<h2><span class="n">4</span>Traga seus alunos</h2>
<p>Em <b>Alunos</b>, toque em <span class="botao">Novo aluno</span>. Há dois jeitos:</p>
<div class="duas">
  <div class="caixa">
    <h3>Convidar aluno (com o app)</h3>
    <p>Escreva o nome e o WhatsApp e toque em <span class="botao">Criar link de convite</span>. Mande com <span class="botao">Enviar pelo WhatsApp</span> ou <span class="botao">Copiar link</span>.</p>
    <p>O aluno cria a conta, preenche os dados de saúde e recebe o <b>ParQ e a anamnese</b> para responder. Depois ele vê as aulas, os avisos e os pagamentos no app dele.</p>
  </div>
  <div class="caixa">
    <h3>Aluno sem app</h3>
    <p>Para quem não vai usar o app, como um aluno menor de idade. Você cadastra os dados (e os do responsável, se for o caso) e cuida da agenda e das cobranças dele.</p>
    <p>Se um dia ele quiser usar o app, dá para mandar o convite pela ficha.</p>
  </div>
</div>

<h2><span class="n">5</span>Matrícula: horários fixos e mensalidade</h2>
<p>Na ficha do aluno, toque em <span class="botao">Criar matrícula</span>:</p>
<ul>
  <li><b>Tipo de acompanhamento:</b> presencial, online ou híbrido.</li>
  <li><b>Dias e horários fixos</b>, duração da aula e local (academia, casa do aluno…).</li>
  <li><b>Mensalidade</b> (sai pronta pelos seus valores, mas dá para mudar), de quanto em quanto tempo cobra e o <b>dia do vencimento</b>.</li>
</ul>
<p>Pronto: as aulas entram sozinhas na sua agenda e as mensalidades aparecem no Financeiro conforme o vencimento.</p>

<h2><span class="n">6</span>A ficha do aluno</h2>
<ul>
  <li><b>Treino:</b> escreva o treino de cada dia. O aluno vê no app.</li>
  <li><b>ParQ e anamnese:</b> as respostas aparecem aqui, com qualquer "sim" do ParQ em destaque. Use <span class="botao">Enviar ParQ e anamnese</span> para mandar de novo.</li>
  <li><b>Avaliação física:</b> registre peso, % de gordura e medidas. A ficha mostra o último valor, quanto mudou e o gráfico da evolução. O aluno também pode registrar pelo app.
    <ul>
      <li><span class="botao">Pedir ao aluno</span> manda uma notificação pedindo que ele registre.</li>
      <li>Em <b>Pedir sempre</b>, escolha <i>todo mês</i>, <i>a cada 2 meses</i> ou <i>a cada 3 meses</i>, e o app pede sozinho.</li>
    </ul>
  </li>
  <li><b>Pausas:</b> viagem, doença… Registre o período, com ou sem desconto na mensalidade.</li>
  <li><b>Suspender se não pagar:</b> ligado, a matrícula é suspensa quando a mensalidade vence sem pagamento. Enquanto estiver suspensa, o aluno não marca nem remarca aulas.</li>
  <li><b>Este mês:</b> aulas dadas e faltas. E um botão para abrir a conversa no WhatsApp.</li>
</ul>

<h2><span class="n">7</span>Agenda, cancelamentos e reposições</h2>
<ul>
  <li>Na <b>Agenda</b>, veja a semana, toque numa aula para remarcar, cancelar ou marcar falta, e crie uma <b>aula avulsa</b> quando precisar.</li>
  <li><b>Bloqueios:</b> em Conta, marque os dias em que não vai trabalhar (viagem, compromisso).</li>
  <li><b>Quando o aluno cancela pelo app</b> dentro do prazo das suas regras, ele ganha uma reposição. Em cima da hora, a aula conta como dada.</li>
  <li><b>Pedidos do aluno</b> (reposição ou remarcação) chegam no Início e no celular: <b>aceite, recuse ou sugira outro horário</b>.</li>
  <li><b>Reposições pendentes:</b> o Início mostra quem tem reposição para marcar e quando vence, com o botão <span class="botao">Lembrar</span> no WhatsApp.</li>
  <li>O <b>calendário de aulas</b> guarda o histórico de cada mês: aulas dadas, reposições, cancelamentos e faltas.</li>
</ul>

<h2><span class="n">8</span>Financeiro e Pix</h2>
<ul>
  <li>No <b>Financeiro</b>: recebido no mês, a receber, atrasado e o gráfico dos últimos 6 meses.</li>
  <li>O aluno com app vê a mensalidade com o seu <b>Pix pronto</b> (QR Code e copia e cola), paga e toca em <span class="botao">Já paguei</span>. Você recebe o aviso, confere no banco e toca em <span class="botao">Confirmar recebimento</span>.</li>
  <li>Aluno sem app ou pagamento em dinheiro: abra a cobrança e use <span class="botao">Marcar como recebido</span>.</li>
  <li><b>Cobrança avulsa:</b> para uma aula extra, uma avaliação ou o que mais quiser cobrar.</li>
  <li><b>Relatório do mês:</b> o que você recebeu, pronto para o carnê-leão ou o contador.</li>
</ul>
<div class="atencao"><b>Importante:</b> o P-Bell não recebe nem repassa dinheiro. O aluno paga direto no seu Pix.</div>

<h2><span class="n">9</span>Alunos online</h2>
<p>Se você atende a distância, a matrícula pode ser <b>online</b> ou <b>híbrida</b>. Em <b>Alunos online</b>, monte seus <b>questionários</b> de acompanhamento (check-ins), mande para os alunos e veja as respostas de cada um.</p>

<h2><span class="n">10</span>O que o seu aluno faz pelo app</h2>
<ul>
  <li>Vê as próximas aulas, o treino de cada dia e a evolução das avaliações.</li>
  <li>Cancela ou remarca seguindo as suas regras, marca reposição e pede outro horário.</li>
  <li>Paga a mensalidade pelo seu Pix e avisa que pagou.</li>
  <li>Responde o ParQ, a anamnese, os questionários e registra a avaliação física quando você pedir.</li>
</ul>

<div class="dica"><b>É uma beta:</b> pode aparecer algum detalhe estranho. Se algo não funcionar ou ficar confuso, escreva para <b>app.pbell@gmail.com</b>. Sua opinião define o que melhora primeiro.</div>
<div class="rodape">P-Bell · Guia da beta para professores · novembro de 2026</div>
`;

// ── Guia da coordenação ───────────────────────────────────────────────────────
const COORDENACAO = `
<div class="capa">
  <div class="marca"><img src="{LOGO}" alt=""><span>P-Bell</span></div>
  <div class="rotulo">Guia da beta · Coordenação</div>
  <h1>O estúdio inteiro num lugar só</h1>
  <p>Agenda e turmas, professores, alunos, mensalidades e formulários, no computador ou no celular.</p>
</div>

<h2><span class="n">1</span>Entre e instale</h2>
<p>A coordenação entra em <b>pbell.com.br</b> com o e-mail e a senha da conta do estúdio e cai direto na coordenação. No computador, use o navegador mesmo: as abas ficam num menu à esquerda. No celular, vale instalar o app:</p>
${instalar("<b>pbell.com.br</b>")}

<h2><span class="n">2</span>As seis abas</h2>
<div class="abas seis">
  <div class="aba"><b>Agenda</b><span>Turmas e turnos do dia e da semana, faltas e férias da equipe.</span></div>
  <div class="aba"><b>Professores</b><span>Equipe, convites e como cada um recebe.</span></div>
  <div class="aba"><b>Alunos</b><span>Cadastro, turmas, fichas, atenção e comunicados.</span></div>
  <div class="aba"><b>Financeiro</b><span>Resumo do mês, mensalidades, planos e Pix.</span></div>
  <div class="aba"><b>Ajustes</b><span>Funcionamento, regras dos alunos e feriados.</span></div>
  <div class="aba"><b>Formulários</b><span>ParQ e anamnese dos alunos.</span></div>
</div>
<div class="dica"><b>Regra de ouro:</b> tudo o que precisa de você (pedidos de troca de turma, experimentais concluídas, alunos que precisam de atenção) aparece <b>no alto da tela</b>.</div>

<h2><span class="n">3</span>Primeira configuração (na ordem)</h2>
<ol class="passos">
  <li><b>Ajustes:</b> dias e horários de funcionamento, regras de faltas e reposições, trânsito livre e feriados.</li>
  <li><b>Professores:</b> convide a equipe pelo link e defina como cada um recebe.</li>
  <li><b>Agenda:</b> cadastre as turmas da semana e dê um professor a cada uma.</li>
  <li><b>Financeiro:</b> chave Pix do estúdio, tabela de mensalidades, planos e taxa de matrícula.</li>
  <li><b>Alunos:</b> cadastre os alunos (pelo link, um a um ou colando uma lista) e coloque cada um nas turmas.</li>
  <li><b>Formulários:</b> confira o ParQ e a anamnese, que já vêm prontos.</li>
</ol>

<h2><span class="n">4</span>Ajustes</h2>
<ul>
  <li><b>Dias e horários de funcionamento:</b> as turmas e os turnos ficam dentro desse horário.</li>
  <li><b>Faltas e reposições dos alunos:</b> com quantas horas de antecedência o aviso de falta gera reposição, até quando dá para marcar a reposição e por quanto tempo ela vale (por exemplo, até o fim do mês).</li>
  <li><b>Valor da reposição:</b> quanto recebe o professor que dá uma aula de reposição (por hora ou por aluno presente).</li>
  <li><b>Trânsito livre:</b> <i>ligado</i>, o aluno troca de horário e muda a quantidade de aulas sozinho. <i>Desligado</i>, cada mudança vira um pedido para você aprovar ou recusar.</li>
  <li><b>Feriados:</b> escolha se o estúdio abre ou fecha nos feriados. Fechando, as aulas das turmas que caem no feriado são canceladas; as aulas extras continuam.</li>
</ul>

<h2><span class="n">5</span>Agenda</h2>
<ul>
  <li><b>Dia:</b> uma coluna por professor, com as aulas e a ocupação das turmas. <b>Semana:</b> os dias lado a lado, com a cor de cada professor.</li>
  <li><span class="botao">Novo horário</span>: turma ou turno, modalidade, professor e vagas. Dá para criar vários dias e intervalos de uma vez ("das 6h às 10h", aulas seguidas da duração escolhida) ou uma <b>aula extra</b> numa data.</li>
  <li><b>Editar</b> a grade: adicionar horários, remover e dar professor a horários sem professor.</li>
  <li><b>Tocando numa aula:</b> mude só aquela data (exceção) ou daqui para frente (vira o padrão). Também dá para trocar o professor ou usar <span class="botao">Cancelar só esta aula</span>.</li>
  <li><b>Fechar o estúdio num dia</b> (emenda de feriado, imprevisto): todas as aulas do dia são canceladas e alunos e professores são avisados.</li>
  <li><b>Férias e faltas:</b> marque as de qualquer professor. As aulas que ficam sem professor podem ser oferecidas a toda a equipe ou a um professor específico. Quem confirmar primeiro fica com o horário.</li>
</ul>

<h2><span class="n">6</span>Professores</h2>
<ul>
  <li><span class="botao">Convidar professor</span> &gt; <span class="botao">Criar link de convite</span> &gt; <span class="botao">Copiar link</span> e mande pelo WhatsApp. O professor cria a conta e entra direto na equipe.</li>
  <li><b>Como cada um recebe:</b> <i>por hora</i> (valor da hora × horas de aula dadas), <i>hora-aula + comissão</i> (valor por aula dada + valor por aluno presente) ou <i>percentual dos alunos</i> (uma % da mensalidade dos alunos das turmas dele).</li>
  <li>O app calcula a <b>previsão de pagamento</b> de cada professor no mês.</li>
</ul>

<h2><span class="n">7</span>Alunos</h2>
<h3>Cadastrar</h3>
<ul>
  <li><b>Link de alunos:</b> um link do estúdio para o aluno novo se cadastrar sozinho. Ele aparece na lista e você é avisado para escolher as turmas.</li>
  <li><span class="botao">Cadastrar aluno</span>: um de cada vez.</li>
  <li><span class="botao">Cadastrar alunos</span> em lista: cole um aluno por linha, como <i>Ana Souza, (21) 98888-1111</i>, e toque em <span class="botao">Cadastrar lista</span>.</li>
</ul>
<h3>Acompanhar</h3>
<ul>
  <li><b>Precisam de atenção:</b> no alto da aba, quem faltou às últimas aulas ou tem reposição vencendo, com a mensagem pronta para o WhatsApp.</li>
  <li><b>Comunicados:</b> escreva um recado e envie para todos ou só para os alunos escolhidos. Ele aparece no app do aluno.</li>
  <li><b>Ficha do aluno:</b> turmas, mensalidade e plano, limitações, objetivos, anotações da equipe, treino de cada dia e as respostas do ParQ e da anamnese.</li>
  <li><b>Pedidos de mudança de turma</b> (com o trânsito livre desligado): <span class="botao">Aprovar</span> ou <span class="botao">Recusar</span>. Na turma cheia, o aluno entra na <b>lista de espera</b> e é avisado quando abre vaga (tem 24 h para entrar).</li>
  <li><b>Saída do aluno:</b> tire o aluno do estúdio informando a data de saída.</li>
</ul>
<h3>Aulas experimentais</h3>
<p>Agende uma experimental numa aula com vaga. O nome aparece em azul na chamada. Depois da aula, aparece o aviso <i>Aula experimental concluída</i> com três opções: <span class="botao">Cadastrar aluno</span>, <span class="botao">Entrar em contato</span> (mensagem pronta) ou <span class="botao">Descartar</span>. O app mostra as experimentais do mês por professor e quantas viraram matrícula.</p>

<h2><span class="n">8</span>Financeiro</h2>
<ul>
  <li><b>Resumo do mês</b> no alto: alunos novos, recebido, atrasos, experimentais e frequência.</li>
  <li><b>Pix do estúdio</b> e <b>tabela de mensalidades:</b> valor pelo número de turmas por semana do aluno, planos mensal, trimestral e semestral, e taxa de matrícula.</li>
  <li><b>Começar a cobrar:</b> na ficha do aluno, escolha o plano. O vencimento começa no dia da matrícula, e um aluno pode ter um valor próprio, diferente da tabela.</li>
  <li><b>Mensalidades:</b> são geradas 7 dias antes do vencimento. A lista separa quem está <b>Devendo</b> e quem <b>vence em até 7 dias</b>.</li>
  <li><span class="botao">Cobrar no WhatsApp</span> abre a mensagem pronta com o Pix copia e cola. Quando o dinheiro cair, toque em <span class="botao">Recebido</span>. O aluno também pode avisar no app que já pagou.</li>
  <li>Planos de mais de um mês mostram <b>até quando vão</b> e renovam sozinhos.</li>
  <li><b>Meses anteriores:</b> professores por mês e receita × professores.</li>
</ul>
<div class="atencao"><b>Importante:</b> o P-Bell não recebe nem repassa dinheiro. O aluno paga direto no Pix do estúdio, e a coordenação confirma no app.</div>

<h2><span class="n">9</span>Formulários: ParQ e anamnese</h2>
<ul>
  <li>Já vêm prontos e você pode editar as perguntas.</li>
  <li>Todo aluno novo recebe os dois para preencher no app.</li>
  <li>Dá para enviar a todos os alunos ou só aos escolhidos.</li>
  <li>As respostas ficam na ficha do aluno. Um <b>"sim" no ParQ</b> aparece em destaque.</li>
</ul>

<h2><span class="n">10</span>O que o aluno faz pelo app</h2>
<ul>
  <li>Vê as próximas aulas, o treino de cada dia e os comunicados.</li>
  <li>Avisa falta (dentro do prazo, ganha reposição), marca reposição ou entra na lista de espera.</li>
  <li>Troca de horário ou pede a troca, conforme o trânsito livre.</li>
  <li>Paga a mensalidade pelo Pix do estúdio, avisa que pagou e vê até quando vai o plano.</li>
  <li>Responde o ParQ e a anamnese.</li>
</ul>
<p>Para entrar, o aluno usa o link de alunos do estúdio ou o link que chega quando você ou um professor cadastram ele. A instalação é a mesma da seção 1.</p>

<div class="dica"><b>É uma beta:</b> pode aparecer algum detalhe estranho. Se algo não funcionar ou ficar confuso, escreva para <b>app.pbell@gmail.com</b>. Sua opinião define o que melhora primeiro.</div>
<div class="rodape">P-Bell · Guia da beta para a coordenação · novembro de 2026</div>
`;

// ── Guia dos alunos (de personal que trabalha por conta própria) ──────────────
const ALUNOS = `
<div class="capa">
  <div class="marca"><img src="{LOGO}" alt=""><span>P-Bell</span></div>
  <div class="rotulo">Guia da beta · Alunos</div>
  <h1>Suas aulas com o seu personal, no celular</h1>
  <p>Aulas, treino e mensalidade num lugar só. São 3 passos e leva uns 2 minutos.</p>
</div>

<h2><span class="n">1</span>Crie sua conta pelo convite</h2>
<ol class="passos">
  <li>Abra o <b>link de convite</b> que o seu personal mandou pelo WhatsApp.</li>
  <li>Preencha seus dados, crie uma senha e marque a caixa dos <b>Termos de Uso e da Política de Privacidade</b>. Se pedir, confirme o e-mail pelo link que chega na sua caixa de entrada.</li>
  <li>Responda as perguntas de saúde, o <b>ParQ</b> e a <b>anamnese</b>. Elas ajudam o seu personal a montar o treino com segurança.</li>
</ol>

<h2><span class="n">2</span>Instale o app no celular</h2>
${instalar("<b>pbell.com.br</b>", false)}

<h2><span class="n">3</span>Ligue as notificações</h2>
<div class="destaque">
  <h3>Esse passo é o mais importante</h3>
  <p>Sem as notificações, você só fica sabendo das coisas quando abre o app. Com elas ligadas, o celular avisa na hora quando:</p>
  <ul>
    <li>o seu personal muda ou cancela uma aula;</li>
    <li>ele responde um pedido seu de remarcação ou reposição;</li>
    <li>ele pede alguma coisa para você, como uma avaliação física ou um questionário.</li>
  </ul>
</div>
<p class="grande">Abra o P-Bell <b>pelo ícone</b>, toque em <span class="botao">Ligar notificações</span> e depois em <b>Permitir</b>. Lembretes sem pressa não viram notificação: eles ficam só dentro do app.</p>
<div class="atencao"><b>No iPhone,</b> as notificações só funcionam com o app instalado e aberto pelo ícone (iOS 16.4 ou mais novo). Se você tocou em "Não permitir" sem querer, libere em <b>Ajustes do iPhone &gt; Notificações &gt; P-Bell</b>. No Android, libere em <b>Configurações &gt; Apps &gt; P-Bell &gt; Notificações</b>.</div>

<h2><span class="n">4</span>O que você faz pelo app</h2>
<div class="abas" style="grid-template-columns: repeat(4, 1fr)">
  <div class="aba"><b>Início</b><span>Próxima aula, treino do dia e o que precisa de você.</span></div>
  <div class="aba"><b>Aulas</b><span>Cancelar, remarcar e marcar reposição.</span></div>
  <div class="aba"><b>Pagamentos</b><span>Mensalidade com o Pix do seu personal.</span></div>
  <div class="aba"><b>Perfil</b><span>Seus dados e informações de saúde.</span></div>
</div>
<ul>
  <li>Tudo que precisa de você, como uma mensalidade para pagar ou um pedido do personal, aparece <b>no alto do Início</b>.</li>
  <li>Para cancelar ou remarcar, siga as regras do seu personal. Cancelando com antecedência, você ganha uma reposição.</li>
  <li>Para pagar, copie o Pix ou use o QR Code, pague no seu banco e toque em <span class="botao">Já paguei</span>. O dinheiro vai direto para o seu personal.</li>
</ul>

<div class="dica"><b>É uma beta:</b> se algo não funcionar ou ficar confuso, fale com o seu personal ou escreva para <b>app.pbell@gmail.com</b>.</div>
<div class="rodape">P-Bell · Guia da beta para alunos · novembro de 2026</div>
`;

for (const [nome, titulo, corpo, tema] of [
  ["P-Bell - Guia dos professores", "Guia dos professores · P-Bell", PROFESSORES, ""],
  ["P-Bell - Guia da coordenacao", "Guia da coordenação · P-Bell", COORDENACAO, "estudio"],
  ["P-Bell - Guia dos alunos", "Guia dos alunos · P-Bell", ALUNOS, "aluno"],
]) {
  const html = path.join(aqui, `${nome}.html`);
  const pdf = path.join(aqui, `${nome}.pdf`);
  fs.writeFileSync(html, pagina(titulo, corpo, tema));
  execFileSync(EDGE, [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--virtual-time-budget=8000",
    `--print-to-pdf=${pdf}`,
    `file:///${html.replaceAll("\\", "/")}`,
  ]);
  console.log("ok", pdf);
}
