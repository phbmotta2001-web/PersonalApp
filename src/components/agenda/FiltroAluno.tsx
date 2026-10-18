"use client";

import { useRouter } from "next/navigation";

/** Escolher um aluno (ou todos) no histórico. */
export function FiltroAluno({
  alunos,
  atual,
  mes,
}: {
  alunos: { vinculoId: string; nome: string }[];
  atual: string;
  mes: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Filtrar por aluno"
      value={atual}
      onChange={(e) => router.replace(`/agenda/historico?mes=${mes}${e.target.value ? `&aluno=${e.target.value}` : ""}`)}
      className="min-h-11 w-full rounded-[13px] border border-line bg-surface px-3 text-sm"
    >
      <option value="">Todos os alunos</option>
      {alunos.map((a) => (
        <option key={a.vinculoId} value={a.vinculoId}>
          {a.nome}
        </option>
      ))}
    </select>
  );
}
