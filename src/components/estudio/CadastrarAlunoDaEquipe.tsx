"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cadastrarAlunoPelaEquipe } from "@/data/aluno-estudio";
import { linkWhatsapp } from "@/lib/convite";
import { DIAS, minParaHora } from "@/lib/expediente";
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
  turmas: { id: string; dia: number; inicioMin: number; modalidade: string; livres: number }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  // Decisão 120: marca os dias e escolhe o horário de cada um (dia → turma).
  const [porDia, setPorDia] = useState<Record<number, string>>({});
  const escolhidas = Object.values(porDia).filter(Boolean);
  const doDia = (d: number) => turmas.filter((t) => t.dia === d).sort((a, b) => a.inicioMin - b.inicioMin);
  const diasComTurma = DIAS.filter((d) => turmas.some((t) => t.dia === d.valor));
  const alternarDia = (d: number) => {
    if (d in porDia) {
      const resto = { ...porDia };
      delete resto[d];
      return setPorDia(resto);
    }
    const opcoes = doDia(d);
    // O mesmo horário do primeiro dia marcado, se houver turma nele com vaga; se não, a primeira com vaga.
    const primeiro = turmas.find((t) => t.id === Object.values(porDia)[0]);
    const igual = primeiro && opcoes.find((t) => t.inicioMin === primeiro.inicioMin && t.livres > 0);
    setPorDia({ ...porDia, [d]: (igual ?? opcoes.find((t) => t.livres > 0) ?? opcoes[0])?.id ?? "" });
  };
  const [feito, setFeito] = useState<{ nome: string; whatsapp: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const limpar = () => {
    setNome("");
    setZap("");
    setPorDia({});
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
      <>
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
      </section>
      <button type="button" onClick={limpar} className="rounded-[16px] border border-estudio/40 bg-estudio-soft/50 px-4 py-3 text-left font-bold text-estudio">
        + Cadastrar aluno
      </button>
      </>
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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[14px] font-bold text-ink-2">Nas suas turmas (opcional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {diasComTurma.map((d) => {
              const marcado = d.valor in porDia;
              return (
                <button
                  key={d.valor}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternarDia(d.valor)}
                  className={`min-h-[40px] min-w-[48px] rounded-full border px-3 text-[14.5px] font-semibold ${
                    marcado ? "border-estudio bg-estudio text-white" : "border-line bg-surface text-ink-2"
                  }`}
                >
                  {d.curto}
                </button>
              );
            })}
          </div>
          {Object.keys(porDia)
            .map(Number)
            .sort((a, b) => a - b)
            .map((d) => {
              const opcoes = doDia(d);
              const t = opcoes.find((x) => x.id === porDia[d]);
              return (
                <label key={d} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 font-bold">{DIAS.find((x) => x.valor === d)?.curto}</span>
                  <select
                    value={porDia[d]}
                    onChange={(e) => setPorDia({ ...porDia, [d]: e.target.value })}
                    aria-label={`Horário de ${DIAS.find((x) => x.valor === d)?.nome}`}
                    className={ESTILO_CAIXA + " min-w-0 flex-1"}
                  >
                    {opcoes.map((x) => (
                      <option key={x.id} value={x.id} disabled={x.livres <= 0}>
                        {minParaHora(x.inicioMin)} · {x.modalidade}
                        {x.livres <= 0 ? " (cheia)" : ` (${x.livres} ${x.livres === 1 ? "vaga" : "vagas"})`}
                      </option>
                    ))}
                  </select>
                  {t && t.livres <= 0 && <span className="shrink-0 text-[13px] font-bold text-bad">cheia</span>}
                </label>
              );
            })}
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
              const r = await cadastrarAlunoPelaEquipe(estudioId, nome, zap, escolhidas.filter((id) => (turmas.find((t) => t.id === id)?.livres ?? 0) > 0));
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
