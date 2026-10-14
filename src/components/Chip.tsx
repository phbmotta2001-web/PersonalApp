"use client";

/** Botão em formato de pílula que liga e desliga (usado nos filtros). */
export function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex min-h-[38px] shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
        ativo
          ? "border-ink bg-ink text-app"
          : "border-line bg-surface text-ink-2 hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}
