import Link from "next/link";
import type { Personal } from "@/data/personais";
import { formatarReais } from "@/lib/formato";
import { Avatar } from "../Avatar";
import { Icone } from "../Icone";
import { Nota } from "../Nota";
import { SeloNivel } from "../SeloNivel";

export function CartaoPersonal({
  personal: p,
  compatibilidade,
}: {
  personal: Personal;
  /** Quando o filtro de horário está ligado: em quantos dos dias pedidos há horário livre. */
  compatibilidade?: { livres: number; total: number };
}) {
  return (
    <Link
      href={`/personais/${p.slug}`}
      className="flex w-full items-start gap-3 rounded-[20px] border border-line bg-surface p-3.5 text-left transition-colors hover:border-brand"
    >
      <Avatar nome={p.nome} cor={p.cor} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[16.5px] font-bold">{p.nome}</span>
          {p.nivel && <SeloNivel nivel={p.nivel} />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[14px] text-ink-3">
          <span className="inline-flex items-center gap-1 font-semibold text-ok">
            <Icone nome="escudo" className="size-4" />
            CREF verificado
          </span>
          · {p.bairro} · {p.distancia}
        </div>
        {compatibilidade && (
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-bold ${
              compatibilidade.livres === compatibilidade.total ? "bg-ok-soft text-ok" : "bg-gold-soft text-gold"
            }`}
          >
            <Icone nome="relogio" className="size-3.5" />
            Livre em {compatibilidade.livres} de {compatibilidade.total}{" "}
            {compatibilidade.total === 1 ? "dia" : "dias"}
          </span>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.especialidades.map((e) => (
            <span
              key={e}
              className="rounded-lg bg-surface-2 px-2 py-0.5 text-[13px] font-semibold text-ink-2"
            >
              {e}
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[14px]">
          <Nota nota={p.nota} avaliacoes={p.avaliacoes} />
          <span className="text-[13px] font-bold text-ok">{p.renovacao}% renovam</span>
          <span className="tabular-nums">
            <b className="text-[16px]">{formatarReais(p.precoAula)}</b>
            <span className="text-ink-3">/aula</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
