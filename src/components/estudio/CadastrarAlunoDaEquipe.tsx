"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cadastrarAlunoPelaEquipe } from "@/data/aluno-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { Chip } from "../Chip";
import { Aviso, Campo, ESTILO_BOTAO_PRINCIPAL, ESTILO_CAIXA } from "../Formulario";

/**
 * Decisão 98: o professor (e a coordenação) cadastra um aluno com nome e WhatsApp, pode pôr nas
 * turmas dele e recebe o link do app para mandar. A coordenação é avisada.
 */
export function CadastrarAlunoDaEquipe({
  estudioId,
  estudioNome,
  turmas,
}: {
  estudioId: string;
  estudioNome: string;
  /** As turmas do professor, com as vagas livres. */
  turmas: { id: string; nome: string; livres: number }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [feito, setFeito] = useState<{ nome: string; whatsapp: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const limpar = () => {
    setNome("");
    setZap("");
    setEscolhidas(new Set());
    setFeito(null);
    setCopiado(false);
    setErro(null);
  };

  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="rounded-[16px] border border-estudio/40 bg-estudio-soft/50 px-4 py-3 text-left font-bold text-estudio">
        + Cadastrar aluno
      </button>
    );

  if (feito) {
    const mensagem = `Olá, ${feito.nome.split(" ")[0]}! O ${estudioNome} usa o P-Bell: veja a agenda com as vagas, avise suas faltas e marque reposições. Entre por este link: ${feito.link}`;
    return (
      <section className="flex flex-col gap-3 rounded-[20px] border border-estudio/40 bg-surface p-4" aria-label="Aluno cadastrado">
        <p className="font-bold">{feito.nome} está no estúdio.</p>
        <p className="text-[14px] text-ink-2">Mande o link do app (vale 14 dias). A coordenação foi avisada.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
          <a href={linkWhatsapp(feito.whatsapp, mensagem)} target="_blank" rel="noreferrer" className="text-brand">
            Enviar no WhatsApp
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(feito.link);
                setCopiado(true);
              } catch {
                setCopiado(false);
              }
            }}
            className="text-brand"
          >
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </div>
        <div className="flex gap-4 text-[14.5px] font-bold">
          <button type="button" onClick={limpar} className="text-estudio">
            Cadastrar outro
          </button>
          <button
            type="button"
            onClick={() => {
              limpar();
              setAberto(false);
            }}
            className="text-ink-3"
          >
            Fechar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-estudio/40 bg-surface p-4" aria-label="Cadastrar aluno">
      <h2 className="font-bold">Cadastrar aluno</h2>
      <Campo id="cad-nome" rotulo="Nome">
        <input id="cad-nome" value={nome} maxLength={80} autoComplete="off" onChange={(e) => setNome(e.target.value)} className={ESTILO_CAIXA} />
      </Campo>
      <Campo id="cad-zap" rotulo="WhatsApp" ajuda="Com DDD.">
        <input
          id="cad-zap"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(21) 99999-0000"
          value={zap}
          onChange={(e) => setZap(e.target.value)}
          className={ESTILO_CAIXA}
        />
      </Campo>
      {turmas.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Nas suas turmas (opcional)</legend>
          <div className="flex flex-wrap gap-2">
            {turmas.map((t) => (
              <Chip
                key={t.id}
                ativo={escolhidas.has(t.id)}
                onClick={() => {
                  if (t.livres <= 0 && !escolhidas.has(t.id)) return;
                  const n = new Set(escolhidas);
                  if (n.has(t.id)) n.delete(t.id);
                  else n.add(t.id);
                  setEscolhidas(n);
                }}
              >
                {t.nome}
                {t.livres <= 0 && " · cheia"}
              </Chip>
            ))}
          </div>
          <span className="text-[13px] text-ink-3">Sem turma, a coordenação escolhe depois.</span>
        </fieldset>
      )}
      <Aviso>{erro}</Aviso>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            iniciar(async () => {
              setErro(null);
              const r = await cadastrarAlunoPelaEquipe(estudioId, nome, zap, [...escolhidas]);
              if (!r.ok) return setErro(r.erro);
              setFeito({ nome: nome.trim(), whatsapp: zap, link: r.link });
              router.refresh();
            })
          }
          className={ESTILO_BOTAO_PRINCIPAL + " flex-1 sm:flex-none"}
        >
          {ocupado ? "Cadastrando…" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => {
            limpar();
            setAberto(false);
          }}
          className="font-bold text-ink-3"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
