// Animação de abertura (decisão de 22/10/2026, opção "Traço"): uma linha verde-limão
// desenha o P, um sino aparece e balança, as letras de "P-Bell" sobem uma a uma, aparece "Sua agenda em dia"
// e um círculo se abre do centro revelando o app (o símbolo cresce e some). Uns 4 segundos, movimentos suaves.
//
// Vem pronta do servidor (sem esperar o JavaScript), cobrindo a tela enquanto o app
// carrega, e a animação começa logo na primeira pintura (classe "abertura-toca"). Esperar
// a página terminar de carregar deixava a tela vazia por segundos: com os dados vindo em
// partes, o "load" só acontece no fim. Aparece a cada carga completa da página, isto é, ao abrir o app:
// trocar de tela dentro do app não recarrega a página, então não repete. (Antes havia
// uma memória da sessão, mas no iPhone ela sobrevive ao fechar o app e a abertura
// deixava de aparecer.) Nunca bloqueia o toque, e quem pediu "reduzir movimento" não
// vê. Se algo falhar, ela some sozinha em 7 segundos (regras em globals.css).
const SCRIPT = `try{document.documentElement.classList.add("abertura-toca")}catch(e){}`;

const NOME = "P-Bell";

export function Abertura() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div className="abertura" aria-hidden="true">
        <div className="abertura-marca">
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            className="abertura-simbolo"
          >
            <path
              className="abertura-traco"
              d="M30 85V18h26a20 20 0 0 1 0 40H30"
            />
            <g className="abertura-sino">
              <path d="M72 60a3 3 0 0 1 3 3c6 1.5 8 6 8 11v6l4 4H57l4-4v-6c0-5 2-9.5 8-11a3 3 0 0 1 3-3z" />
              <circle cx="72" cy="90" r="3.5" />
            </g>
          </svg>
          <span className="abertura-nome">
            {[...NOME].map((letra, i) => (
              <span key={i} style={{ animationDelay: `${1.3 + i * 0.12}s` }}>
                {letra}
              </span>
            ))}
          </span>
          <span className="abertura-frase">Sua agenda em dia</span>
        </div>
      </div>
    </>
  );
}
