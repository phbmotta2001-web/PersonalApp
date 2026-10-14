"use client";

import { LOCAIS, OBJETIVOS, type Genero } from "@/data/personais";
import {
  alternar,
  FAIXAS_PRECO,
  FILTROS_VAZIOS,
  NOTAS_MINIMAS,
  type Filtros,
} from "@/lib/filtros";
import { Chip } from "../Chip";
import { Gaveta, GrupoDaGaveta } from "../Gaveta";

const GENEROS: { valor: Genero | null; rotulo: string }[] = [
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
                className={`min-h-11 rounded-[11px] text-sm font-bold ${
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
