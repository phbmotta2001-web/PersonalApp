import { Suspense } from "react";
import { soNoEstudio } from "@/data/so-estudio";
import { BarraCliente } from "./BarraDoPersonalCliente";

/** Barra fixa embaixo com as abas do personal (no celular). Quem só trabalha no estúdio vê menos abas. */
export function BarraDoPersonal() {
  return (
    <Suspense fallback={null}>
      <Abas />
    </Suspense>
  );
}

async function Abas() {
  return <BarraCliente soEstudio={await soNoEstudio()} />;
}
