import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoLegal } from "@/components/DocumentoLegal";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";
import { TERMOS } from "@/lib/textos-legais";

export const metadata: Metadata = {
  title: "Termos de Uso",
};

// Antes da revisão jurídica, só abre em desenvolvimento (ver src/lib/recursos.ts).
export default function PaginaTermos() {
  if (!TERMOS_PUBLICADOS && process.env.NODE_ENV !== "development") notFound();
  return <DocumentoLegal titulo="Termos de Uso" secoes={TERMOS} />;
}
