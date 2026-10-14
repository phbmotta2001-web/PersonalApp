import type { Metadata } from "next";
import { TelaBusca } from "@/components/busca/TelaBusca";
import { listarPersonais } from "@/data/personais";

export const metadata: Metadata = {
  title: "Buscar personais",
};

export default async function PaginaBusca() {
  const personais = await listarPersonais();
  return <TelaBusca personais={personais} />;
}
