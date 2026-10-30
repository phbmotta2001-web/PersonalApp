// Pix copia e cola (BR Code estático, padrão EMV do Banco Central) — Fase 1, etapa 7.
// O pagamento cai direto na chave Pix do personal; o Kout só monta o código.

export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const TIPOS_CHAVE_PIX: { valor: TipoChavePix; rotulo: string; exemplo: string }[] = [
  { valor: "cpf", rotulo: "CPF", exemplo: "000.000.000-00" },
  { valor: "telefone", rotulo: "Celular", exemplo: "(21) 99999-0000" },
  { valor: "email", rotulo: "E-mail", exemplo: "voce@exemplo.com" },
  { valor: "cnpj", rotulo: "CNPJ", exemplo: "00.000.000/0001-00" },
  { valor: "aleatoria", rotulo: "Chave aleatória", exemplo: "123e4567-e89b-12d3-a456-426614174000" },
];

export interface DadosPix {
  tipo: TipoChavePix;
  chave: string;
  /** Nome de quem recebe (até 25 letras, sem acento no código). */
  nome: string;
  /** Cidade de quem recebe (até 15 letras). */
  cidade: string;
}

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** A chave como o Pix espera: CPF/CNPJ só números, celular com +55, e-mail em minúsculas. */
export function normalizarChave(tipo: TipoChavePix, chave: string): string {
  const c = chave.trim();
  if (tipo === "cpf" || tipo === "cnpj") return soDigitos(c);
  if (tipo === "telefone") {
    const d = soDigitos(c);
    return `+${d.startsWith("55") && d.length >= 12 ? d : `55${d}`}`;
  }
  if (tipo === "email") return c.toLowerCase();
  return c.toLowerCase();
}

export function problemasDoPix(p: DadosPix): string[] {
  const problemas: string[] = [];
  const chave = normalizarChave(p.tipo, p.chave);
  const ok =
    p.tipo === "cpf"
      ? chave.length === 11
      : p.tipo === "cnpj"
        ? chave.length === 14
        : p.tipo === "telefone"
          ? /^\+55\d{10,11}$/.test(chave)
          : p.tipo === "email"
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave) && chave.length <= 77
            : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chave);
  if (!ok) problemas.push("confira a chave Pix");
  if (semAcento(p.nome).trim().length < 2) problemas.push("escreva o nome de quem recebe");
  if (semAcento(p.cidade).trim().length < 2) problemas.push("escreva a cidade");
  return problemas;
}

/** "São João" → "SAO JOAO" (o BR Code só aceita letras simples). */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase();
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o "Pix copia e cola" com o valor. `identificador` aparece no extrato de quem
 * recebe (até 25 letras e números; sem ele, "***").
 */
export function pixCopiaECola(p: DadosPix, valorCentavos?: number, identificador?: string): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizarChave(p.tipo, p.chave));
  const txid = (identificador ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const semCrc =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (valorCentavos ? campo("54", (valorCentavos / 100).toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", semAcento(p.nome).trim().slice(0, 25)) +
    campo("60", semAcento(p.cidade).trim().slice(0, 15)) +
    campo("62", campo("05", txid)) +
    "6304";
  return semCrc + crc16(semCrc);
}
