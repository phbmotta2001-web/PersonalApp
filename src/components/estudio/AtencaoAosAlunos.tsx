import type { AlunoEmAtencao } from "@/data/estudio-atencao";
import { linkWhatsapp } from "@/lib/convite";
import { dataCurta } from "@/lib/expediente";

/**
 * Decisão 101: no alto da aba Alunos, quem precisa de atenção — faltou às últimas aulas ou tem
 * reposição vencendo — com a mensagem pronta para o WhatsApp.
 */
export function AtencaoAosAlunos({ estudio, alunos }: { estudio: string; alunos: AlunoEmAtencao[] }) {
  if (alunos.length === 0) return null;
  const mensagem = (a: AlunoEmAtencao) => {
    const nome = a.nome.split(" ")[0];
    return a.tipo === "sumindo"
      ? `Oi, ${nome}! Sentimos sua falta nas últimas aulas aqui no ${estudio}. Está tudo bem? Se precisar trocar de horário, é só falar.`
      : `Oi, ${nome}! Você tem ${a.quantidade === 1 ? "1 reposição" : `${a.quantidade} reposições`} no ${estudio} que ${a.quantidade === 1 ? "vence" : "vencem"} até ${dataCurta(a.ate ?? "")}. Quer marcar?`;
  };
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-gold/50 bg-surface p-4" aria-label="Alunos que precisam de atenção">
      <h2 className="font-bold">Precisam de atenção</h2>
      <ul className="flex flex-col divide-y divide-line">
        {alunos.map((a) => (
          <li key={`${a.tipo}-${a.id}`} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{a.nome}</span>
              <span className={`block text-[13px] font-semibold ${a.tipo === "sumindo" ? "text-gold" : "text-estudio"}`}>
                {a.tipo === "sumindo"
                  ? `Faltou às últimas ${a.quantidade} aulas`
                  : `${a.quantidade === 1 ? "1 reposição vence" : `${a.quantidade} reposições vencem`} até ${dataCurta(a.ate ?? "")}${a.comApp ? " · vê no app" : ""}`}
              </span>
            </span>
            {a.whatsapp ? (
              <a href={linkWhatsapp(a.whatsapp, mensagem(a))} target="_blank" rel="noreferrer" className="shrink-0 text-[14px] font-bold text-brand">
                Entrar em contato
              </a>
            ) : (
              <span className="shrink-0 text-[13px] text-ink-3">Sem WhatsApp</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
