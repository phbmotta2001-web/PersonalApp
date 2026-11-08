import Link from "next/link";

/** Aviso acima do botão de criar conta: criar a conta é aceitar os termos e a política. */
export function AceiteDosTermos() {
  return (
    <p className="text-center text-[13px] text-ink-3">
      Ao criar a conta, você concorda com os{" "}
      <Link href="/termos" target="_blank" className="font-semibold text-brand underline">
        Termos de Uso
      </Link>{" "}
      e a{" "}
      <Link href="/privacidade" target="_blank" className="font-semibold text-brand underline">
        Política de Privacidade
      </Link>
      .
    </p>
  );
}
