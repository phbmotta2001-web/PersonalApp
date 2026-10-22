"use client";

import { useState } from "react";
import type { Personal } from "@/data/personais";
import { compatibilidade, quandoAtivo } from "@/lib/agenda";
import { alternar, FILTROS_VAZIOS, filtrarPersonais, temFiltroAtivo } from "@/lib/filtros";
import { BotaoVoltar } from "../BotaoVoltar";
import { Chip } from "../Chip";
import { Icone } from "../Icone";
import { CartaoPersonal } from "./CartaoPersonal";
import { GavetaFiltros } from "./GavetaFiltros";

export function TelaBusca({ personais }: { personais: Personal[] }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [gavetaAberta, setGavetaAberta] = useState(false);

  const resultados = filtrarPersonais(personais, filtros);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-center gap-2.5 pt-3.5 pr-3.5 pb-2 pl-2">
        <BotaoVoltar reserva="/" className="hover:bg-surface-2" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-semibold">Personais</h1>
          <p className="text-[14px] text-ink-3" aria-live="polite">
            <span className="tabular-nums">{resultados.length}</span> perto de Ipanema
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Filtros"
          className="relative grid size-11 place-items-center rounded-full hover:bg-surface-2"
        >
          <Icone nome="filtros" />
          {temFiltroAtivo(filtros) && (
            <span className="absolute top-[9px] right-2.5 size-[9px] rounded-full border-2 border-app bg-bad" />
          )}
        </button>
      </header>

      <div className="flex flex-col gap-[18px] px-[18px] pt-1 pb-6">
        <div
          role="group"
          aria-label="Filtros rápidos"
          className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] [scrollbar-width:none]"
        >
          <Chip
            ativo={filtros.genero === "f"}
            onClick={() => setFiltros({ ...filtros, genero: filtros.genero === "f" ? null : "f" })}
          >
            Só mulheres
          </Chip>
          <Chip
            ativo={filtros.locais.includes("casa")}
            onClick={() => setFiltros({ ...filtros, locais: alternar(filtros.locais, "casa") })}
          >
            Atende em casa
          </Chip>
          <Chip
            ativo={filtros.preco === "ate-110"}
            onClick={() =>
              setFiltros({ ...filtros, preco: filtros.preco === "ate-110" ? null : "ate-110" })
            }
          >
            Até R$ 110/aula
          </Chip>
          <Chip
            ativo={filtros.locais.includes("online")}
            onClick={() => setFiltros({ ...filtros, locais: alternar(filtros.locais, "online") })}
          >
            Online
          </Chip>
        </div>

        {resultados.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {resultados.map((p) => (
              <li key={p.slug}>
                <CartaoPersonal
                  personal={p}
                  compatibilidade={
                    quandoAtivo(filtros.quando) ? compatibilidade(p.disponibilidade, filtros.quando) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center text-[15px] text-ink-3">
            <p>Nenhum profissional com esses filtros. Tire um filtro para ver mais opções.</p>
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_VAZIOS)}
              className="text-[14.5px] font-semibold text-brand"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <GavetaFiltros
        aberta={gavetaAberta}
        aoFechar={() => setGavetaAberta(false)}
        filtros={filtros}
        mudarFiltros={setFiltros}
        totalResultados={resultados.length}
      />
    </div>
  );
}
