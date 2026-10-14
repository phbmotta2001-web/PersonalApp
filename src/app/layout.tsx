import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
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
  description: "Marketplace que conecta alunos a personal trainers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
