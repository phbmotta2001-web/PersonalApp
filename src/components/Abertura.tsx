/* eslint-disable @next/next/no-img-element */

// Animação de abertura (decisão de 22/10/2026): ícone com pulo de mola, o nome subindo
// e a tela sumindo, em pouco mais de 1 segundo. Só na primeira carga de cada vez que o
// app é aberto (sessionStorage); trocar de tela não repete. Nunca bloqueia o toque, e
// quem pediu "reduzir movimento" não vê (regras em globals.css).
//
// Vem pronta do servidor (sem esperar o JavaScript), para não piscar a tela do app antes.
// O script abaixo roda antes de desenhar: se já abriu nesta sessão, esconde na hora.
const JA_ABRIU = `try{if(sessionStorage.getItem("pienel-abertura"))document.documentElement.classList.add("sem-abertura");else sessionStorage.setItem("pienel-abertura","1")}catch(e){}`;

export function Abertura() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JA_ABRIU }} />
      <div className="abertura" aria-hidden="true">
        <img src="/icones/icone-192.png" alt="" width={96} height={96} className="abertura-icone" />
        <span className="abertura-nome">Pienel</span>
      </div>
    </>
  );
}
