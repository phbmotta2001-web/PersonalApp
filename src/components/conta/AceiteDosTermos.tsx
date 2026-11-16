import Link from "next/link";

/**
 * Decisão 109: caixa obrigatória dos Termos de Uso e da Política de Privacidade (no cadastro e
 * na tela de aceite de quem já tinha conta). O profissional também aceita a responsabilidade pelos
 * dados dos alunos.
 */
export function AceiteDosTermos({
  marcado,
  mudar,
  profissional,
  faltou,
}: {
  marcado: boolean;
  mudar: (v: boolean) => void;
  /** Personal, estúdio ou professor. */
  profissional: boolean;
  /** Tentou seguir sem marcar. */
  faltou: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-2xl border bg-surface p-3.5 ${faltou ? "border-2 border-bad" : "border-line"}`}>
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => mudar(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
      />
      <span className="text-[14px] text-ink-2">
        Li e aceito os{" "}
        <Link href="/termos" target="_blank" className="font-semibold text-brand underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" target="_blank" className="font-semibold text-brand underline">
          Política de Privacidade
        </Link>
        .
        {profissional && (
          <span className="mt-1 block">
            Sou responsável pelos dados que cadastro e recebo dos meus alunos e da minha equipe, e por ter a autorização deles. O
            P-Bell só guarda e organiza esses dados.
          </span>
        )}
        {faltou && <span className="mt-1 block font-semibold text-bad">Marque para continuar.</span>}
      </span>
    </label>
  );
}
