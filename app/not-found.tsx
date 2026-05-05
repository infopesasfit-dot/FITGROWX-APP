import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "#040508", color: "#fff", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 400 }}>
        <p style={{ fontSize: "5rem", fontWeight: 800, letterSpacing: "-0.06em", color: "rgba(255,255,255,0.06)", lineHeight: 1, marginBottom: 8 }}>
          404
        </p>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 8 }}>
          Página no encontrada
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 28 }}>
          El link que usaste no existe o fue movido.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block", padding: "11px 28px", borderRadius: 9999, textDecoration: "none",
            background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)",
            color: "#fff", fontWeight: 600, fontSize: "0.875rem",
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
