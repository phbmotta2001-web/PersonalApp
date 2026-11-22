"use client";

// Erro no layout principal: a página não tem os estilos do app, então vai tudo aqui.
export default function ErroGeral({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f3f6f4",
          color: "#1d2318",
        }}
      >
        <title>P-Bell</title>
        <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Algo não deu certo</p>
        <p style={{ fontSize: 15, margin: 0, maxWidth: 340 }}>Confira sua internet e tente de novo.</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{ minHeight: 48, padding: "0 28px", borderRadius: 14, border: 0, background: "#1c5a42", color: "#fff", fontSize: 15, fontWeight: 700 }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
