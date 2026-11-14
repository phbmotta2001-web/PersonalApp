import Link from "next/link";
import type { FormularioPendente } from "@/data/formularios-estudio";

/** Decisão 97: formulários do estúdio para o aluno responder (ParQ e anamnese antes da 1ª aula). */
export function FormulariosPendentes({ lista }: { lista: FormularioPendente[] }) {
  const inicial = lista.some((f) => f.tipo !== "pesquisa");
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border-2 border-brand bg-brand-soft p-4" aria-label="Formulários para responder">
      <div>
        <p className="text-[13px] font-bold tracking-wide text-brand uppercase">Para responder</p>
        <p className="text-[15px] text-ink-2">
          {inicial ? "Preencha antes de treinar: quem treina você lê antes da aula." : "O estúdio quer saber sua opinião. Leva poucos minutos."}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {lista.map((f) => (
          <li key={f.id}>
            <Link
              href={`/aluno/formulario/${f.id}`}
              className="flex min-h-[52px] items-center gap-3 rounded-[14px] bg-surface px-4 font-bold"
            >
              <span className="min-w-0 flex-1">
                {f.titulo}
                <span className="block text-[13px] font-normal text-ink-3">{f.estudio}</span>
              </span>
              <span className="text-brand">Responder ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
