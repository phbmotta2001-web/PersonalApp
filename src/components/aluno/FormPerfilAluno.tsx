"use client";

import { useState, useTransition } from "react";
import { salvarAlunoAtual } from "@/data/alunos";
import { LIMITES, NIVEIS_ALUNO, problemasDoAluno, type Aluno } from "@/lib/aluno";
import { juntarComE } from "@/lib/pedido";
import { Avatar } from "../Avatar";
import { Icone } from "../Icone";

// Peso e altura são digitados como texto ("68,5") e viram número na hora de conferir/salvar.
interface Formulario extends Omit<Aluno, "privado"> {
  peso: string;
  altura: string;
  outrasMedidas: string;
}

function paraFormulario(a: Aluno): Formulario {
  return {
    nome: a.nome,
    objetivos: a.objetivos,
    restricoes: a.restricoes,
    nivel: a.nivel,
    peso: a.privado.pesoKg?.toLocaleString("pt-BR") ?? "",
    altura: a.privado.alturaCm?.toLocaleString("pt-BR") ?? "",
    outrasMedidas: a.privado.outrasMedidas,
  };
}

/** "" → nenhum valor; "68,5" → 68.5; texto que não é número → NaN (a conferência recusa). */
function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  return limpo === "" ? null : Number(limpo);
}

function paraAluno(f: Formulario): Aluno {
  return {
    nome: f.nome,
    objetivos: f.objetivos,
    restricoes: f.restricoes,
    nivel: f.nivel,
    privado: { pesoKg: paraNumero(f.peso), alturaCm: paraNumero(f.altura), outrasMedidas: f.outrasMedidas },
  };
}

export function FormPerfilAluno({ inicial }: { inicial: Aluno }) {
  const [form, setForm] = useState(() => paraFormulario(inicial));
  const [salvo, setSalvo] = useState(() => paraFormulario(inicial));
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, iniciarSalvamento] = useTransition();

  const problemas = problemasDoAluno(paraAluno(form));
  const mudou = JSON.stringify(form) !== JSON.stringify(salvo);
  const mudar = (parte: Partial<Formulario>) => {
    setAviso(null);
    setForm({ ...form, ...parte });
  };

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    iniciarSalvamento(async () => {
      try {
        const resposta = await salvarAlunoAtual(paraAluno(form));
        if (resposta.ok) {
          const novo = paraFormulario(resposta.aluno);
          setForm(novo);
          setSalvo(novo);
          setAviso("Perfil salvo.");
        } else {
          setAviso(resposta.erro);
        }
      } catch {
        setAviso("Não foi possível salvar agora. Confira sua internet e tente de novo.");
      }
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-[18px] pt-2 pb-6">
        <div className="flex justify-center">
          <Avatar nome={form.nome.trim() || "?"} cor="av6" tamanho="grande" />
        </div>

        {/* ── Parte pública ── */}
        <section className="flex flex-col gap-4" aria-labelledby="titulo-publico">
          <div>
            <h2 id="titulo-publico" className="text-[17px] font-semibold">
              Visível para o personal
            </h2>
            <p className="text-[12.5px] text-ink-3">Vai junto com cada pedido que você enviar.</p>
          </div>

          <Campo id="aluno-nome" rotulo="Nome">
            <input
              id="aluno-nome"
              value={form.nome}
              maxLength={LIMITES.nome}
              autoComplete="name"
              onChange={(e) => mudar({ nome: e.target.value })}
              className={estiloCaixa}
            />
          </Campo>

          <Campo id="aluno-objetivos" rotulo="Objetivos">
            <textarea
              id="aluno-objetivos"
              rows={3}
              value={form.objetivos}
              maxLength={LIMITES.texto}
              onChange={(e) => mudar({ objetivos: e.target.value })}
              placeholder="Ex.: Fortalecimento e postura. Quero perder 4 kg."
              className={`${estiloCaixa} min-h-[84px] resize-none py-3`}
            />
          </Campo>

          <Campo id="aluno-restricoes" rotulo="Restrições" opcional>
            <textarea
              id="aluno-restricoes"
              rows={3}
              value={form.restricoes}
              maxLength={LIMITES.texto}
              onChange={(e) => mudar({ restricoes: e.target.value })}
              placeholder="Ex.: Dor lombar leve, liberada pelo ortopedista. Deixe em branco se não tiver."
              className={`${estiloCaixa} min-h-[84px] resize-none py-3`}
            />
          </Campo>

          <fieldset className="flex flex-col gap-[7px]">
            <legend className="mb-[7px] text-[13px] font-bold text-ink-2">
              Nível de experiência com treino
            </legend>
            <div role="radiogroup" aria-label="Nível de experiência com treino" className="flex flex-col gap-2">
              {NIVEIS_ALUNO.map((n) => {
                const ativo = form.nivel === n.valor;
                return (
                  <button
                    key={n.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => mudar({ nivel: n.valor })}
                    className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] bg-surface px-3.5 py-3 text-left ${
                      ativo ? "border-brand" : "border-line"
                    }`}
                  >
                    <span
                      className={`grid size-[22px] shrink-0 place-items-center rounded-full border-2 ${
                        ativo ? "border-brand" : "border-line"
                      }`}
                    >
                      {ativo && <span className="size-[11px] rounded-full bg-brand" />}
                    </span>
                    <span>
                      <span className="block text-[14.5px] font-bold">{n.rotulo}</span>
                      <span className="block text-[12.5px] text-ink-3">{n.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* ── Parte privada ── */}
        <section
          className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface-2 p-4"
          aria-labelledby="titulo-privado"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-brand">
              <Icone nome="cadeado" />
            </span>
            <div>
              <h2 id="titulo-privado" className="text-[17px] font-semibold">
                Privado: só depois do aceite
              </h2>
              <p className="text-[12.5px] text-ink-3">
                Só você vê. O personal passa a ver depois de aceitar seu pedido.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo id="aluno-peso" rotulo="Peso (kg)" opcional>
              <input
                id="aluno-peso"
                inputMode="decimal"
                value={form.peso}
                onChange={(e) => mudar({ peso: e.target.value })}
                placeholder="Ex.: 68"
                className={estiloCaixa}
              />
            </Campo>
            <Campo id="aluno-altura" rotulo="Altura (cm)" opcional>
              <input
                id="aluno-altura"
                inputMode="numeric"
                value={form.altura}
                onChange={(e) => mudar({ altura: e.target.value })}
                placeholder="Ex.: 165"
                className={estiloCaixa}
              />
            </Campo>
          </div>

          <Campo id="aluno-outras" rotulo="Outras medidas" opcional>
            <textarea
              id="aluno-outras"
              rows={2}
              value={form.outrasMedidas}
              maxLength={LIMITES.texto}
              onChange={(e) => mudar({ outrasMedidas: e.target.value })}
              placeholder="Ex.: cintura 78 cm, quadril 100 cm"
              className={`${estiloCaixa} min-h-[64px] resize-none py-3`}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <EmBreve titulo="Fotos" texto="Para acompanhar sua evolução" />
            <EmBreve titulo="Exames" texto="Exames e laudos médicos" />
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <button
          type="submit"
          disabled={!mudou || problemas.length > 0 || salvando}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[15px] bg-brand px-[18px] font-bold text-brand-ink hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <p aria-live="polite" className="flex min-h-4 items-center justify-center gap-1 text-center text-xs text-ink-3">
          {aviso === "Perfil salvo." && !mudou && <Icone nome="certo" className="size-3.5 text-ok" />}
          {problemas.length > 0
            ? `Para salvar, ${juntarComE(problemas)}.`
            : (aviso ?? (mudou ? "Você tem alterações não salvas." : ""))}
        </p>
      </div>
    </form>
  );
}

const estiloCaixa =
  "min-h-12 w-full rounded-[13px] border border-line bg-surface px-3.5 placeholder:text-ink-3";

function Campo({
  id,
  rotulo,
  opcional = false,
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-[13px] font-bold text-ink-2">
        {rotulo} {opcional && <span className="font-normal text-ink-3">(opcional)</span>}
      </label>
      {children}
    </div>
  );
}

/** Espaço reservado para fotos e exames, que chegam junto com o banco de dados. */
function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[14px] border border-dashed border-line px-2 py-3 text-center">
      <span className="text-sm font-bold text-ink-2">{titulo}</span>
      <span className="text-xs text-ink-3">{texto}</span>
      <span className="mt-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-3">
        Em breve
      </span>
    </div>
  );
}
