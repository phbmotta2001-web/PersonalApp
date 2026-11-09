import { Suspense } from "react";
import { soNoEstudio } from "@/data/so-estudio";
import { TrilhoCliente } from "./TrilhoDoPersonalCliente";

/** Trilho de abas à esquerda (no computador). Quem só trabalha no estúdio vê menos abas. */
export function TrilhoDoPersonal() {
  return (
    <Suspense fallback={null}>
      <Abas />
    </Suspense>
  );
}

async function Abas() {
  return <TrilhoCliente soEstudio={await soNoEstudio()} />;
}
