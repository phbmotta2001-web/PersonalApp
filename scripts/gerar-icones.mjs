// Desenha os ícones do app (PWA) em PNG, sem dependências: fundo verde do P-Bell
// com um "P" branco e um sino verde-limão. Rodar de novo só se o desenho mudar:
//   node scripts/gerar-icones.mjs
import fs from "node:fs";
import zlib from "node:zlib";

const FUNDO = [0x1c, 0x5a, 0x42]; // --brand
const LETRA = [0xff, 0xff, 0xff];
const SINO = [0xc8, 0xf0, 0x6a]; // --lime

/** Passa o ponto do ícone para a área de `escala`, centralizada. */
const naArea = (t, escala) => (t - 0.5) / escala + 0.5;

/** O ponto (x, y), num quadrado de 0..1, está no "P"? */
function noP(x, y, escala) {
  const u = naArea(x, escala);
  const v = naArea(y, escala);
  const haste = u >= 0.2 && u <= 0.34 && v >= 0.12 && v <= 0.88;
  // Barriga do P: anel (meio círculo à direita + retângulo de ligação).
  const cx = 0.44, cy = 0.33, rFora = 0.21, rDentro = 0.07;
  const d = Math.hypot(u - cx, v - cy);
  const anel = u >= cx && d <= rFora && d >= rDentro;
  const ligacao = u >= 0.28 && u <= cx && ((v >= cy - rFora && v <= cy - rDentro) || (v >= cy + rDentro && v <= cy + rFora));
  return haste || anel || ligacao;
}

/** O ponto está no sino (no canto de baixo, à direita do P)? */
function noSino(x, y, escala) {
  const u = naArea(x, escala);
  const v = naArea(y, escala);
  const cx = 0.68;
  const ala = Math.abs(u - cx);
  const pino = Math.hypot(u - cx, v - 0.555) <= 0.026;
  const cupula = v <= 0.68 && Math.hypot(u - cx, v - 0.68) <= 0.105;
  const saia = v >= 0.68 && v <= 0.8 && ala <= 0.105 + (v - 0.68) * 0.6;
  const badalo = Math.hypot(u - cx, v - 0.845) <= 0.032;
  return pino || cupula || saia || badalo;
}

/** Quadrado de cantos arredondados (raio relativo) — ícones normais; maskable usa fundo inteiro. */
function noFundo(x, y, raio) {
  if (raio === 0) return true;
  const qx = Math.min(x, 1 - x), qy = Math.min(y, 1 - y);
  if (qx >= raio || qy >= raio) return true;
  return Math.hypot(raio - qx, raio - qy) <= raio;
}

function desenhar(tamanho, { raio, escala }) {
  const AMOSTRAS = 4; // suavização das bordas
  const linhas = [];
  for (let py = 0; py < tamanho; py++) {
    const linha = Buffer.alloc(1 + tamanho * 4);
    for (let px = 0; px < tamanho; px++) {
      let fundo = 0, letra = 0, sino = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++)
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const x = (px + (sx + 0.5) / AMOSTRAS) / tamanho;
          const y = (py + (sy + 0.5) / AMOSTRAS) / tamanho;
          if (noFundo(x, y, raio)) {
            fundo++;
            if (noP(x, y, escala)) letra++;
            else if (noSino(x, y, escala)) sino++;
          }
        }
      const total = AMOSTRAS * AMOSTRAS;
      const a = fundo / total;
      const t = fundo ? letra / fundo : 0;
      const s = fundo ? sino / fundo : 0;
      const o = 1 + px * 4;
      for (let c = 0; c < 3; c++) linha[o + c] = Math.round(FUNDO[c] * (1 - t - s) + LETRA[c] * t + SINO[c] * s);
      linha[o + 3] = Math.round(a * 255);
    }
    linhas.push(linha);
  }
  return png(tamanho, Buffer.concat(linhas));
}

function png(tamanho, dados) {
  const crcTabela = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloco = (tipo, conteudo) => {
    const t = Buffer.from(tipo);
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(conteudo.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, conteudo])));
    return Buffer.concat([tam, t, conteudo, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(dados, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

const destino = new URL("../public/icones/", import.meta.url);
fs.mkdirSync(destino, { recursive: true });
const icones = [
  ["icone-192.png", 192, { raio: 0.22, escala: 0.9 }],
  ["icone-512.png", 512, { raio: 0.22, escala: 0.9 }],
  // Maskable: o sistema recorta o formato; o símbolo fica na "zona segura" (80% do centro).
  ["icone-maskable-512.png", 512, { raio: 0, escala: 0.72 }],
  // iPhone: fundo inteiro (o iOS arredonda sozinho).
  ["apple-touch-icon.png", 180, { raio: 0, escala: 0.82 }],
];
for (const [nome, tamanho, opcoes] of icones) {
  fs.writeFileSync(new URL(nome, destino), desenhar(tamanho, opcoes));
  console.log("ok", nome);
}
