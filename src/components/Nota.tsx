import { formatarNota } from "@/lib/formato";

export function Nota({ nota, avaliacoes }: { nota: number; avaliacoes?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[14px] font-bold">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-star">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
      </svg>
      <span className="sr-only">Nota </span>
      {formatarNota(nota)}
      {avaliacoes !== undefined && (
        <span className="font-normal text-ink-3">({avaliacoes})</span>
      )}
    </span>
  );
}
