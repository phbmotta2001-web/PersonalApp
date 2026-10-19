import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { RegistrarApp } from "@/components/RegistrarApp";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pienel", template: "%s · Pienel" },
  description: "Agenda, alunos e cobranças do personal trainer num só lugar.",
  applicationName: "Pienel",
  // iPhone: abre em tela cheia quando adicionado à tela de início.
  appleWebApp: { capable: true, title: "Pienel", statusBarStyle: "default" },
  icons: { apple: "/icones/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1c5a42" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1512" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarApp />
      </body>
    </html>
  );
}
