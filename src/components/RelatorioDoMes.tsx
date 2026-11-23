import { Grafico } from "@/components/agenda/AvaliacaoFisica";
import { numeroBr } from "@/lib/avaliacao";
import { dataCurta } from "@/lib/expediente";
import { mesAnterior, nomeDoMes, textoDoVolume, variacao, type RelatorioDoMes } from "@/lib/relatorio";
import { textoDaCarga } from "@/lib/treino";

// Decisão 117: o relatório do mês (o mesmo para o personal e para o aluno).

export function RelatorioDoMesNaTela({ r }: { r: RelatorioDoMes }) {
  const antes = nomeDoMes(mesAnterior(r.mes), true);
  const vVolume = variacao(r.volumeKg, r.volumeAntesKg);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="Aulas com treino" valor={String(r.aulas)} detalhe={r.aulasAntes ? `${r.aulasAntes} em ${antes}` : null} />
        <Numero
          rotulo="Total levantado"
          valor={r.volumeKg > 0 ? textoDoVolume(r.volumeKg) : "—"}
          detalhe={vVolume ? `${vVolume} sobre ${antes}` : r.volumeKg > 0 ? "repetições × carga" : null}
          destaque={vVolume?.startsWith("+")}
        />
      </div>

      {r.volumePorAula.filter((p) => p.valor > 0).length >= 2 && (
        <Caixa titulo="Total levantado por aula">
          <Grafico pontos={r.volumePorAula.filter((p) => p.valor > 0)} unidade=" kg" />
        </Caixa>
      )}

      {r.exercicios.length > 0 ? (
        <Caixa titulo="Cada exercício">
          <ul className="flex flex-col divide-y divide-line">
            {r.exercicios.map((e) => {
              const primeiro = e.pontos[0];
              const ultimo = e.pontos[e.pontos.length - 1];
              const suf = e.porCarga ? (e.unidade === "placas" ? " placas" : ` ${e.unidade}`) : e.medida === "segundos" ? " s" : " rep.";
              const dif = primeiro && ultimo ? Math.round((ultimo.valor - primeiro.valor) * 10) / 10 : 0;
              return (
                <li key={e.chave} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 text-[15.5px] font-bold">{e.nome}</p>
                    {ultimo && (
                      <p className="text-[14px] font-bold tabular-nums">
                        {e.porCarga ? textoDaCarga(ultimo.valor, e.unidade) : `${numeroBr(ultimo.valor)}${suf}`}
                        {e.pontos.length >= 2 && dif !== 0 && (
                          <span className={`ml-1.5 ${dif > 0 ? "text-ok" : "text-ink-3"}`}>
                            {dif > 0 ? "▲" : "▼"} {numeroBr(Math.abs(dif))}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {e.pontos.length >= 2 && <Grafico pontos={e.pontos} unidade={suf} />}
                  {e.volumeKg > 0 && <p className="text-[13px] text-ink-3">{textoDoVolume(e.volumeKg)} levantados no mês</p>}
                </li>
              );
            })}
          </ul>
        </Caixa>
      ) : (
        <p className="rounded-[18px] border border-line bg-surface p-4 text-[15px] text-ink-3">
          Nenhum treino registrado em {nomeDoMes(r.mes, true)}. Os exercícios marcados no treino em andamento aparecem aqui.
        </p>
      )}

      {r.avaliacao && (
        <Caixa titulo={`Medidas: ${dataCurta(r.avaliacao.antes)} → ${dataCurta(r.avaliacao.depois)}`}>
          <ul className="grid grid-cols-2 gap-2">
            {r.avaliacao.itens.map((i) => {
              const d = Math.round((i.depois - i.antes) * 10) / 10;
              return (
                <li key={i.rotulo} className="flex flex-col rounded-[14px] bg-surface-2 px-3 py-2">
                  <span className="text-[12.5px] font-bold text-ink-3">{i.rotulo}</span>
                  <span className="text-[18px] font-extrabold tabular-nums">
                    {numeroBr(i.depois)}
                    <span className="text-[13px] font-bold"> {i.unidade}</span>
                  </span>
                  <span className="text-[12.5px] text-ink-3 tabular-nums">
                    {d === 0 ? "igual" : `${d > 0 ? "▲" : "▼"} ${numeroBr(Math.abs(d))}${i.unidade === "%" ? " p.p." : ` ${i.unidade}`}`} (era {numeroBr(i.antes)})
                  </span>
                </li>
              );
            })}
          </ul>
        </Caixa>
      )}
      {r.avaliacaoUnica && (
        <p className="text-[14px] text-ink-3">
          Uma avaliação física até agora ({dataCurta(r.avaliacaoUnica.data)}). A comparação das medidas aparece a partir da segunda.
        </p>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe: string | null; destaque?: boolean }) {
  return (
    <div className="flex flex-col rounded-[18px] border border-line bg-surface px-4 py-3">
      <span className="text-[13px] font-bold text-ink-3">{rotulo}</span>
      <span className="font-display text-[26px] leading-tight font-extrabold tabular-nums">{valor}</span>
      {detalhe && <span className={`text-[13px] font-semibold ${destaque ? "text-ok" : "text-ink-3"}`}>{detalhe}</span>}
    </div>
  );
}

function Caixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4">
      <h2 className="text-[16px] font-bold">{titulo}</h2>
      {children}
    </section>
  );
}
