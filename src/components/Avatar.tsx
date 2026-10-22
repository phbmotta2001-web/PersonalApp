import type { CorAvatar } from "@/data/personais";
import { iniciais } from "@/lib/formato";

const CORES: Record<CorAvatar, string> = {
  av1: "bg-av1",
  av2: "bg-av2",
  av3: "bg-av3",
  av4: "bg-av4",
  av5: "bg-av5",
  av6: "bg-av6",
};

/** Uma cor fixa por aluno (a mesma em todas as telas), a partir do id. */
export function corPorId(id: string): CorAvatar {
  let soma = 0;
  for (const c of id) soma = (soma * 31 + c.charCodeAt(0)) % 997;
  return (["av1", "av2", "av3", "av4", "av5", "av6"] as const)[soma % 6];
}

const TAMANHOS = {
  pequeno: "size-9 text-[13px]",
  normal: "size-11 text-[15px]",
  grande: "size-[76px] text-[26px] font-display",
};

export function Avatar({
  nome,
  cor,
  tamanho = "normal",
}: {
  nome: string;
  cor: CorAvatar;
  tamanho?: keyof typeof TAMANHOS;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${CORES[cor]} ${TAMANHOS[tamanho]}`}
    >
      {iniciais(nome)}
    </span>
  );
}
