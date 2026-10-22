"use client";

import { LOCAIS, OBJETIVOS, type Genero } from "@/data/personais";
import { DIAS_SEMANA, HORA_MAX, HORA_MIN } from "@/lib/agenda";
import {
  alternar,
  FAIXAS_PRECO,
  FILTROS_VAZIOS,
  NOTAS_MINIMAS,
  type Filtros,
} from "@/lib/filtros";
import { Chip } from "../Chip";
import { Gaveta, GrupoDaGaveta } from "../Gaveta";

/** [de, de+1, …, ate] */
const horas = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);

const GENEROS:{ valor: Genero | null; rotulo: string }[] = [
  { valor: "f", rotulo: "Mulher" },
  { valor: "m", rotulo: "Homem" },
  { valor: null, rotulo: "Tanto faz" },
];

/** Gaveta com todos os filtros da busca. */
export function GavetaFiltros({
  aberta,
  aoFechar,
  filtros,
  mudarFiltros,
  totalResultados,
}: {
  aberta: boolean;
  aoFechar: () => void;
  filtros: Filtros;
  mudarFiltros: (novos: Filtros) => void;
  totalResultados: number;
}) {
  const mudar = (parte: Partial<Filtros>) => mudarFiltros({ ...filtros, ...parte });

  return (
    <Gaveta
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Filtros"
      rodape={
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => mudarFiltros(FILTROS_VAZIOS)}
            className="min-h-[50px] rounded-[15px] border border-line bg-surface px-[18px] font-bold"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={aoFechar}
            className="min-h-[50px] flex-1 rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110"
          >
            {totalResultados === 0
              ? "Nenhum resultado"
              : `Ver ${totalResultados} ${totalResultados === 1 ? "resultado" : "resultados"}`}
          </button>
        </div>
      }
    >
      <GrupoDaGaveta titulo="Quem vai te treinar">
        <div className="grid w-full grid-cols-3 gap-1.5 rounded-[14px] bg-surface-2 p-1">
          {GENEROS.map((g) => {
            const ativo = filtros.genero === g.valor;
            return (
              <button
                key={g.rotulo}
                type="button"
                aria-pressed={ativo}
                onClick={() => mudar({ genero: g.valor })}
                className={`min-h-11 rounded-[11px] text-[15px] font-bold ${
                  ativo ? "bg-surface text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {g.rotulo}
              </button>
            );
          })}
        </div>
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Objetivo">
        {OBJETIVOS.map((o) => (
          <Chip
            key={o}
            ativo={filtros.objetivos.includes(o)}
            onClick={() => mudar({ objetivos: alternar(filtros.objetivos, o) })}
          >
            {o}
          </Chip>
        ))}
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Onde">
        {LOCAIS.map((l) => (
          <Chip
            key={l.valor}
            ativo={filtros.locais.includes(l.valor)}
            onClick={() => mudar({ locais: alternar(filtros.locais, l.valor) })}
          >
            {l.rotulo}
          </Chip>
        ))}
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Quando você pode treinar">
        {DIAS_SEMANA.map((d) => (
          <Chip
            key={d}
            ativo={filtros.quando.dias.includes(d)}
            onClick={() => mudar({ quando: { ...filtros.quando, dias: alternar(filtros.quando.dias, d) } })}
          >
            {d}
          </Chip>
        ))}
        <div className="flex w-full flex-wrap items-center gap-2 text-[15px] text-ink-2">
          <label htmlFor="filtro-de">das</label>
          <select
            id="filtro-de"
            value={filtros.quando.de}
            onChange={(e) => {
              const de = Number(e.target.value);
              mudar({ quando: { ...filtros.quando, de, ate: Math.max(filtros.quando.ate, de + 1) } });
            }}
            className="min-h-10 rounded-[11px] border border-line bg-surface px-2"
          >
            {horas(HORA_MIN, HORA_MAX).map((h) => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
          <label htmlFor="filtro-ate">às</label>
          <select
            id="filtro-ate"
            value={filtros.quando.ate}
            onChange={(e) => {
              const ate = Number(e.target.value);
              mudar({ quando: { ...filtros.quando, ate, de: Math.min(filtros.quando.de, ate - 1) } });
            }}
            className="min-h-10 rounded-[11px] border border-line bg-surface px-2"
          >
            {horas(HORA_MIN + 1, HORA_MAX + 1).map((h) => (
              <option key={h} value={h}>
                {h}h
              </option>
            ))}
          </select>
        </div>
        <p className="w-full text-[13px] text-ink-3">
          Mostra quem tem aula livre nessa faixa em pelo menos um dos dias escolhidos. Aulas de 1 hora.
        </p>
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Preço por aula">
        {FAIXAS_PRECO.map((f) => (
          <Chip
            key={f.valor}
            ativo={filtros.preco === f.valor}
            onClick={() => mudar({ preco: filtros.preco === f.valor ? null : f.valor })}
          >
            {f.rotulo}
          </Chip>
        ))}
      </GrupoDaGaveta>

      <GrupoDaGaveta titulo="Avaliação">
        {NOTAS_MINIMAS.map((n) => (
          <Chip
            key={n.valor}
            ativo={filtros.notaMinima === n.valor}
            onClick={() => mudar({ notaMinima: filtros.notaMinima === n.valor ? null : n.valor })}
          >
            {n.rotulo}
          </Chip>
        ))}
      </GrupoDaGaveta>
    </Gaveta>
  );
}
