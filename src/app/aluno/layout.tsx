// Área do aluno: as telas daqui usam o azul-marinho no lugar do verde da marca (decisão 111).
export default function LayoutDoAluno({ children }: LayoutProps<"/aluno">) {
  return <div className="area-aluno">{children}</div>;
}
