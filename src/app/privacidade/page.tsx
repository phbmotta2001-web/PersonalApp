import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentoLegal } from "@/components/DocumentoLegal";
import { TERMOS_PUBLICADOS } from "@/lib/recursos";
import { POLITICA } from "@/lib/textos-legais";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

// Antes da revisão jurídica, só abre em desenvolvimento (ver src/lib/recursos.ts).
export default function PaginaPrivacidade() {
  if (!TERMOS_PUBLICADOS && process.env.NODE_ENV !== "development") notFound();
  return <DocumentoLegal titulo="Política de Privacidade" secoes={POLITICA} />;
}
