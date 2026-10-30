import type { MetadataRoute } from "next";

// O que o celular usa para instalar o Pienel como app (etapa 4).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pienel",
    short_name: "Pienel",
    description: "Agenda, alunos e cobranças do personal trainer num só lugar.",
    lang: "pt-BR",
    // Abre direto na área de quem está logado (agenda do personal ou área do aluno).
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#123b2c",
    theme_color: "#1c5a42",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
