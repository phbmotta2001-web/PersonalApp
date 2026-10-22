// Confete de comemoração (decisão de 22/10/2026): sai do botão quando o personal
// confirma um pagamento. Só no navegador; quem pediu "reduzir movimento" não vê.

const CORES = ["#c8f06a", "#1c5a42", "#e8a317", "#2b5e9e", "#a23a62", "#6fd09f"];

export function soltarConfete(origem?: Element | null, quantos = 28): void {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = origem?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
  for (let i = 0; i < quantos; i++) {
    const c = document.createElement("span");
    c.className = "pienel-confete";
    const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const distancia = 60 + Math.random() * 110;
    c.style.left = `${x}px`;
    c.style.top = `${y}px`;
    c.style.background = CORES[i % CORES.length];
    c.style.setProperty("--dx", `${Math.cos(angulo) * distancia}px`);
    c.style.setProperty("--dy", `${Math.sin(angulo) * distancia + 40}px`);
    c.style.setProperty("--giro", `${Math.round(Math.random() * 540)}deg`);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
  // Um toque curto de vibração, onde o celular permite (Android).
  navigator.vibrate?.(25);
}
