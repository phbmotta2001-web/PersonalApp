import { TrilhoDoPersonal } from "@/components/agenda/TrilhoDoPersonal";

// Área do personal: no computador, o trilho de abas à esquerda e o conteúdo ao lado.
export default function LayoutDaAgenda({ children }: LayoutProps<"/agenda">) {
  return (
    <div className="flex flex-1 flex-col lg:pl-[88px]">
      <TrilhoDoPersonal />
      {children}
    </div>
  );
}
