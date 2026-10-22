import type { Nivel } from "@/data/personais";

const ESTILOS: Record<Nivel, string> = {
  ouro: "bg-gold-soft text-gold",
  prata: "bg-silver-soft text-silver",
  bronze: "bg-bronze-soft text-bronze",
  elite: "bg-lime text-lime-ink",
};

export function SeloNivel({ nivel }: { nivel: Nivel }) {
  return (
    <span
      className={`inline-flex min-h-[22px] items-center rounded-[7px] px-2 text-[13px] font-extrabold uppercase tracking-wide ${ESTILOS[nivel]}`}
    >
      {nivel}
    </span>
  );
}
