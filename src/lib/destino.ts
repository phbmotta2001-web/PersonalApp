/**
 * Garante que um endereço de retorno (ex.: ?voltar=/personais/camila-duarte) é uma
 * página deste site. Evita que um link malicioso mande a pessoa para outro site
 * depois do login.
 */
export function destinoSeguro(destino: unknown, padrao = "/perfil"): string {
  return typeof destino === "string" &&
    destino.startsWith("/") &&
    !destino.startsWith("//") &&
    !destino.includes("\\")
    ? destino
    : padrao;
}
