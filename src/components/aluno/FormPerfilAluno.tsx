"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  darConsentimentoSaude,
  retirarConsentimentoSaude,
  salvarPerfil,
  salvarSaude,
} from "@/data/alunos";
import { sair, trocarEmail } from "@/data/conta";
import {
  GENEROS,
  idadeEm,
  LIMITES,
  NIVEIS_ALUNO,
  problemasDaSaude,
  problemasDoPerfil,
  type ContaAluno,
  type DadosSaude,
  type PerfilEditavel,
} from "@/lib/aluno";
import { AVISO_RETIRAR_CONSENTIMENTO, TEXTO_CONSENTIMENTO_SAUDE } from "@/lib/consentimento";
import { frase } from "@/lib/formato";
import { Avatar } from "../Avatar";
import { Chip } from "../Chip";
import {
  Aviso,
  Campo,
  ESTILO_BOTAO_PRINCIPAL,
  ESTILO_BOTAO_SECUNDARIO,
  ESTILO_CAIXA,
} from "../Formulario";
import { Icone } from "../Icone";

// Peso e altura são digitados como texto ("68,5") e viram número na hora de conferir/salvar.
interface SaudeDigitada {
  restricoes: string;
  peso: string;
  altura: string;
  outrasMedidas: string;
}

const paraDigitada = (s: DadosSaude): SaudeDigitada => ({
  restricoes: s.restricoes,
  peso: s.pesoKg?.toLocaleString("pt-BR") ?? "",
  altura: s.alturaCm?.toLocaleString("pt-BR") ?? "",
  outrasMedidas: s.outrasMedidas,
});

/** "" → nenhum valor; "68,5" → 68.5; texto que não é número → NaN (a conferência recusa). */
function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  return limpo === "" ? null : Number(limpo);
}

const paraSaude = (s: SaudeDigitada): DadosSaude => ({
  restricoes: s.restricoes,
  pesoKg: paraNumero(s.peso),
  alturaCm: paraNumero(s.altura),
  outrasMedidas: s.outrasMedidas,
});

const editavel = (c: ContaAluno): PerfilEditavel => ({
  genero: c.perfil.genero,
  objetivo: c.perfil.objetivo,
  nivel: c.perfil.nivel,
  cep: c.perfil.cep,
  endereco: c.perfil.endereco,
  bairro: c.perfil.bairro,
  cidade: c.perfil.cidade,
});

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function FormPerfilAluno({ conta }: { conta: ContaAluno }) {
  const router = useRouter();
  const [perfil, setPerfil] = useState(() => editavel(conta));
  const [perfilSalvo, setPerfilSalvo] = useState(() => editavel(conta));
  const [saude, setSaude] = useState(() => paraDigitada(conta.saude));
  const [saudeSalva, setSaudeSalva] = useState(() => paraDigitada(conta.saude));
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const { perfil: p, consentimentoSaude } = conta;

  const mudouPerfil = JSON.stringify(perfil) !== JSON.stringify(perfilSalvo);
  const mudouSaude = consentimentoSaude && JSON.stringify(saude) !== JSON.stringify(saudeSalva);
  const problemas = [
    ...problemasDoPerfil(perfil),
    ...(consentimentoSaude ? problemasDaSaude(paraSaude(saude)) : []),
  ];

  const mudarPerfil = (parte: Partial<PerfilEditavel>) => {
    setAviso(null);
    setPerfil({ ...perfil, ...parte });
  };
  const mudarSaude = (parte: Partial<SaudeDigitada>) => {
    setAviso(null);
    setSaude({ ...saude, ...parte });
  };

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      try {
        if (mudouPerfil) {
          const r = await salvarPerfil(perfil);
          if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
          setPerfilSalvo(perfil);
        }
        if (mudouSaude) {
          const r = await salvarSaude(paraSaude(saude));
          if (!r.ok) return setAviso({ tipo: "erro", texto: r.erro });
          setSaudeSalva(saude);
        }
        setAviso({ tipo: "ok", texto: "Perfil salvo." });
      } catch {
        setAviso({ tipo: "erro", texto: "Não foi possível salvar agora. Confira sua internet." });
      }
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-[18px] pt-2 pb-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Avatar nome={p.nomeCompleto} cor="av6" tamanho="grande" />
          <p className="mt-1 text-lg font-bold">{p.nomeCompleto}</p>
          <p className="text-[13px] text-ink-3">{idadeEm(p.dataNascimento)} anos</p>
        </div>

        {/* ── Conta ── */}
        <Bloco titulo="Sua conta" descricao="O personal nunca vê seu e-mail nem sua data de nascimento.">
          <TrocarEmail emailAtual={p.email} />
          <Campo id="pf-nome" rotulo="Nome completo">
            <input id="pf-nome" value={p.nomeCompleto} disabled className={ESTILO_CAIXA} />
          </Campo>
          <Campo
            id="pf-nascimento"
            rotulo="Data de nascimento"
            ajuda="Nome e data de nascimento só podem ser corrigidos pelo suporte do Pienel."
          >
            <input id="pf-nascimento" value={dataBr(p.dataNascimento)} disabled className={ESTILO_CAIXA} />
          </Campo>
        </Bloco>

        {/* ── Antes do aceite ── */}
        <Bloco
          titulo="O personal vê ao receber seu pedido"
          descricao="Junto com seu primeiro nome."
        >
          <Campo id="pf-objetivo" rotulo="Objetivo">
            <textarea
              id="pf-objetivo"
              rows={3}
              maxLength={LIMITES.objetivo}
              value={perfil.objetivo}
              onChange={(e) => mudarPerfil({ objetivo: e.target.value })}
              placeholder="Ex.: Fortalecimento e postura. Quero perder 4 kg."
              className={`${ESTILO_CAIXA} min-h-[84px] resize-none py-3`}
            />
          </Campo>

          <fieldset className="flex flex-col gap-[7px]">
            <legend className="mb-[7px] text-[13px] font-bold text-ink-2">Nível de experiência com treino</legend>
            <div role="radiogroup" aria-label="Nível de experiência com treino" className="flex flex-col gap-2">
              {NIVEIS_ALUNO.map((n) => {
                const ativo = perfil.nivel === n.valor;
                return (
                  <button
                    key={n.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => mudarPerfil({ nivel: n.valor })}
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

          <Campo id="pf-bairro" rotulo="Bairro">
            <input
              id="pf-bairro"
              maxLength={LIMITES.bairro}
              autoComplete="address-level3"
              value={perfil.bairro}
              onChange={(e) => mudarPerfil({ bairro: e.target.value })}
              placeholder="Ex.: Ipanema"
              className={ESTILO_CAIXA}
            />
          </Campo>
        </Bloco>

        {/* ── Depois do aceite ── */}
        <Bloco
          titulo="O personal vê só depois de aceitar"
          descricao="Endereço para treinos em casa, gênero e, abaixo, seus dados de saúde."
        >
          <fieldset className="flex flex-col gap-[7px]">
            <legend className="mb-[7px] text-[13px] font-bold text-ink-2">
              Gênero <span className="font-normal text-ink-3">(opcional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {GENEROS.map((g) => (
                <Chip
                  key={g.valor}
                  ativo={perfil.genero === g.valor}
                  onClick={() => mudarPerfil({ genero: perfil.genero === g.valor ? null : g.valor })}
                >
                  {g.rotulo}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-ink-3">
              Na busca, esconde só personais especializados no treino do outro gênero. &quot;Outro&quot;,
              &quot;Prefiro não informar&quot; ou sem resposta: você vê todos.
            </p>
          </fieldset>

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Campo id="pf-cep" rotulo="CEP" opcional>
              <input
                id="pf-cep"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={9}
                value={perfil.cep}
                onChange={(e) => mudarPerfil({ cep: e.target.value })}
                placeholder="22410-000"
                className={ESTILO_CAIXA}
              />
            </Campo>
            <Campo id="pf-cidade" rotulo="Cidade" opcional>
              <input
                id="pf-cidade"
                maxLength={LIMITES.cidade}
                autoComplete="address-level2"
                value={perfil.cidade}
                onChange={(e) => mudarPerfil({ cidade: e.target.value })}
                className={ESTILO_CAIXA}
              />
            </Campo>
          </div>
          <Campo id="pf-endereco" rotulo="Endereço" opcional ajuda="Rua, número e complemento.">
            <input
              id="pf-endereco"
              maxLength={LIMITES.endereco}
              autoComplete="street-address"
              value={perfil.endereco}
              onChange={(e) => mudarPerfil({ endereco: e.target.value })}
              className={ESTILO_CAIXA}
            />
          </Campo>
        </Bloco>

        {/* ── Saúde ── */}
        <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface-2 p-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-brand">
              <Icone nome="cadeado" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold">Dados de saúde</h2>
              <p className="text-[12.5px] text-ink-3">
                As restrições só aparecem antes do aceite se você autorizar em cada pedido. Peso,
                altura e medidas, só depois do aceite.
              </p>
            </div>
          </div>

          {consentimentoSaude ? (
            <>
              <Campo id="pf-restricoes" rotulo="Restrições e limitações" opcional>
                <textarea
                  id="pf-restricoes"
                  rows={3}
                  maxLength={LIMITES.restricoes}
                  value={saude.restricoes}
                  onChange={(e) => mudarSaude({ restricoes: e.target.value })}
                  placeholder="Ex.: Dor lombar leve, liberada pelo ortopedista."
                  className={`${ESTILO_CAIXA} min-h-[84px] resize-none py-3`}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo id="pf-peso" rotulo="Peso (kg)" opcional>
                  <input
                    id="pf-peso"
                    inputMode="decimal"
                    value={saude.peso}
                    onChange={(e) => mudarSaude({ peso: e.target.value })}
                    placeholder="Ex.: 68"
                    className={ESTILO_CAIXA}
                  />
                </Campo>
                <Campo id="pf-altura" rotulo="Altura (cm)" opcional>
                  <input
                    id="pf-altura"
                    inputMode="numeric"
                    value={saude.altura}
                    onChange={(e) => mudarSaude({ altura: e.target.value })}
                    placeholder="Ex.: 165"
                    className={ESTILO_CAIXA}
                  />
                </Campo>
              </div>
              <Campo id="pf-outras" rotulo="Outras medidas" opcional>
                <textarea
                  id="pf-outras"
                  rows={2}
                  maxLength={LIMITES.outrasMedidas}
                  value={saude.outrasMedidas}
                  onChange={(e) => mudarSaude({ outrasMedidas: e.target.value })}
                  placeholder="Ex.: cintura 78 cm, quadril 100 cm"
                  className={`${ESTILO_CAIXA} min-h-[64px] resize-none py-3`}
                />
              </Campo>
              <EmBreve titulo="Exames e laudos" texto="Ficam privados. Você escolhe compartilhar com o personal depois do aceite." />
              <RetirarConsentimento aoRetirar={() => router.refresh()} />
            </>
          ) : (
            <DarConsentimento aoDar={() => router.refresh()} />
          )}
        </section>

        <button type="button" onClick={() => sair()} className={ESTILO_BOTAO_SECUNDARIO}>
          Sair da conta
        </button>
      </div>

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-surface px-[18px] pt-3 pb-3.5">
        <button
          type="submit"
          disabled={(!mudouPerfil && !mudouSaude) || problemas.length > 0 || ocupado}
          className={ESTILO_BOTAO_PRINCIPAL}
        >
          {ocupado ? "Salvando…" : "Salvar"}
        </button>
        <p aria-live="polite" className="min-h-4 text-center text-xs text-ink-3">
          {problemas.length > 0
            ? `Para salvar: ${frase(problemas)}`
            : aviso && !(aviso.tipo === "ok" && (mudouPerfil || mudouSaude))
              ? aviso.texto
              : mudouPerfil || mudouSaude
                ? "Você tem alterações não salvas."
                : ""}
        </p>
      </div>
    </form>
  );
}

function Bloco({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold">{titulo}</h2>
        <p className="text-[12.5px] text-ink-3">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-line px-3.5 py-3">
      <div className="flex-1">
        <p className="text-sm font-bold text-ink-2">{titulo}</p>
        <p className="text-xs text-ink-3">{texto}</p>
      </div>
      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-3">Em breve</span>
    </div>
  );
}

function TrocarEmail({ emailAtual }: { emailAtual: string }) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  function enviar() {
    iniciar(async () => {
      const r = await trocarEmail(novo);
      setAviso(
        r.ok
          ? { tipo: "ok", texto: `Enviamos um link de confirmação para ${novo.trim()}. A troca só vale depois de confirmar.` }
          : { tipo: "erro", texto: r.erro },
      );
      if (r.ok) setAberto(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Campo id="pf-email" rotulo="E-mail">
        <div className="flex gap-2">
          <input id="pf-email" value={emailAtual} disabled className={ESTILO_CAIXA} />
          {!aberto && (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="shrink-0 rounded-[13px] border border-line bg-surface px-3 text-[13px] font-semibold"
            >
              Trocar
            </button>
          )}
        </div>
      </Campo>
      {aberto && (
        <div className="flex gap-2">
          <input
            type="email"
            aria-label="Novo e-mail"
            autoComplete="email"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Novo e-mail"
            className={ESTILO_CAIXA}
          />
          <button
            type="button"
            onClick={enviar}
            disabled={ocupado || !novo}
            className="shrink-0 rounded-[13px] bg-brand px-3 text-[13px] font-bold text-brand-ink disabled:opacity-60"
          >
            {ocupado ? "…" : "Enviar"}
          </button>
        </div>
      )}
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
    </div>
  );
}

function DarConsentimento({ aoDar }: { aoDar: () => void }) {
  const [marcado, setMarcado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
        />
        <span className="text-[13px] text-ink-2">{TEXTO_CONSENTIMENTO_SAUDE}</span>
      </label>
      <Aviso>{erro}</Aviso>
      <button
        type="button"
        disabled={!marcado || ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await darConsentimentoSaude();
            if (r.ok) aoDar();
            else setErro(r.erro);
          })
        }
        className={ESTILO_BOTAO_SECUNDARIO + " disabled:opacity-60"}
      >
        {ocupado ? "Registrando…" : "Autorizar e preencher dados de saúde"}
      </button>
    </div>
  );
}

function RetirarConsentimento({ aoRetirar }: { aoRetirar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (!confirmando)
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="self-start text-[13px] font-semibold text-bad"
      >
        Retirar autorização dos dados de saúde
      </button>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-bad/40 bg-surface p-3.5">
      <p className="text-[13px] text-ink-2">{AVISO_RETIRAR_CONSENTIMENTO}</p>
      <Aviso>{erro}</Aviso>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="flex-1 rounded-[13px] border border-line px-3 py-2.5 text-[13px] font-bold"
        >
          Manter
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              const r = await retirarConsentimentoSaude();
              if (r.ok) aoRetirar();
              else setErro(r.erro);
            })
          }
          className="flex-1 rounded-[13px] bg-bad px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {ocupado ? "Apagando…" : "Retirar e apagar"}
        </button>
      </div>
    </div>
  );
}
