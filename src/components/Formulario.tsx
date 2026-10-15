// Peças comuns dos formulários (cadastro, entrar, perfil, pedido).

export const ESTILO_CAIXA =
  "min-h-12 w-full rounded-[13px] border border-line bg-surface px-3.5 placeholder:text-ink-3 disabled:bg-surface-2 disabled:text-ink-3";

export const ESTILO_BOTAO_PRINCIPAL =
  "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100";

export const ESTILO_BOTAO_SECUNDARIO =
  "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[15px] border border-line bg-surface px-[18px] font-bold hover:border-brand";

export function Campo({
  id,
  rotulo,
  opcional = false,
  ajuda,
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  ajuda?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-[13px] font-bold text-ink-2">
        {rotulo} {opcional && <span className="font-normal text-ink-3">(opcional)</span>}
      </label>
      {children}
      {ajuda && <p className="text-xs text-ink-3">{ajuda}</p>}
    </div>
  );
}

/** Mensagem de erro ou de sucesso, lida em voz alta por leitores de tela. */
export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-[13px] px-3.5 py-2.5 text-[13px] ${
        tipo === "erro" ? "bg-bad/10 text-bad" : "bg-ok-soft text-ok"
      }`}
    >
      {children}
    </p>
  );
}

export function Carregando() {
  return <p className="px-[18px] py-6 text-sm text-ink-3">Carregando…</p>;
}

export function Cabecalho({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2.5 pt-3.5 pr-3.5 pb-2 pl-2">
      {children}
      <h1 className="text-[21px] font-semibold">{titulo}</h1>
    </header>
  );
}
