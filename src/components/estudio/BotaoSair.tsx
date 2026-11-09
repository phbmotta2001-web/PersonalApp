import { sair } from "@/data/conta";

/** Sair da conta (conta empresarial, que não tem a área de personal com o menu Conta). */
export function BotaoSair({ className = "" }: { className?: string }) {
  return (
    <form action={sair} className={className}>
      <button type="submit" className="rounded-[12px] border border-line px-3 py-2 text-[14px] font-semibold text-ink-2 hover:bg-surface-2">
        Sair
      </button>
    </form>
  );
}
