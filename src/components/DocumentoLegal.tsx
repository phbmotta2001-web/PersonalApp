import { ATUALIZADO_EM, type Secao } from "@/lib/textos-legais";

/** Política de Privacidade ou Termos de Uso: seções numeradas, com listas e tabelas. */
export function DocumentoLegal({ titulo, secoes }: { titulo: string; secoes: Secao[] }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-[18px] pt-8 pb-16 text-[15.5px] leading-relaxed">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-extrabold">{titulo}</h1>
        <p className="text-[14px] text-ink-3">Última atualização: {ATUALIZADO_EM}</p>
      </header>
      {secoes.map((s, i) => (
        <section key={s.titulo} className="flex flex-col gap-2.5">
          <h2 className="text-[19px] font-bold">
            {i + 1}. {s.titulo}
          </h2>
          {s.blocos.map((b, j) =>
            typeof b === "string" ? (
              <p key={j} className="text-ink-2">
                {b}
              </p>
            ) : "itens" in b ? (
              <ul key={j} className="flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
                {b.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div key={j} className="overflow-x-auto">
                <table className="w-full border-collapse text-[14.5px]">
                  <thead>
                    <tr>
                      {b.tabela.cabecalho.map((c) => (
                        <th key={c} scope="col" className="border-b border-line py-2 pr-3 text-left font-bold text-ink-3">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.tabela.linhas.map((linha) => (
                      <tr key={linha[0]}>
                        {linha.map((celula, k) => (
                          <td key={k} className={`border-b border-line py-2 pr-3 align-top ${k === 0 ? "font-semibold" : "text-ink-2"}`}>
                            {celula}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
