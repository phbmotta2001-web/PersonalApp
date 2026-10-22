// Animação de abertura (decisão de 22/10/2026, opção "Traço"): uma linha verde-limão
// desenha o símbolo, as letras de "Pienel" sobem uma a uma, aparece "Sua agenda em dia"
// e um círculo se fecha no centro revelando o app. Uns 4 segundos, movimentos suaves.
//
// Vem pronta do servidor (sem esperar o JavaScript), cobrindo a tela enquanto o app
// carrega; a animação só começa quando a página termina de carregar (classe
// "abertura-toca"). Só na primeira carga de cada vez que o app é aberto (sessionStorage);
// trocar de tela não repete. Nunca bloqueia o toque, e quem pediu "reduzir movimento"
// não vê. Se algo falhar, ela some sozinha em 7 segundos (regras em globals.css).
const SCRIPT = `try{var h=document.documentElement;if(sessionStorage.getItem("pienel-abertura")){h.classList.add("sem-abertura")}else{sessionStorage.setItem("pienel-abertura","1");var t=function(){setTimeout(function(){h.classList.add("abertura-toca")},60)};if(document.readyState==="complete")t();else addEventListener("load",t)}}catch(e){}`;

const NOME = "Pienel";

export function Abertura() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div className="abertura" aria-hidden="true">
        <svg width="100" height="100" viewBox="0 0 100 100" className="abertura-simbolo">
          <path className="abertura-traco" d="M30 85V18h26a20 20 0 0 1 0 40H30" />
          <circle className="abertura-ponto" cx="70" cy="80" r="7" />
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
    </>
  );
}
