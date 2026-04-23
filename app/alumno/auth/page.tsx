"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getPlanNombre } from "@/lib/supabase-relations";

const fd = "'Inter', sans-serif";

function AuthInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "error">(token ? "verifying" : "error");
  const [error,  setError]  = useState<string | null>(token ? null : "Token no encontrado.");

  useEffect(() => {
    if (!token) return;

    fetch("/api/alumno/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) { setError(data.error ?? "Error al verificar."); setStatus("error"); return; }
        localStorage.setItem("fitgrowx_alumno", JSON.stringify({
          alumno_id:   data.alumno.id,
          gym_id:      data.gym_id,
          full_name:   data.alumno.full_name,
          status:      data.alumno.status,
          plan:        getPlanNombre(data.alumno.planes),
          expiration:  data.alumno.next_expiration_date ?? null,
          dni:         data.alumno.dni ?? null,
        }));
        router.replace("/alumno/panel");
      })
      .catch(() => { setError("Error de conexión."); setStatus("error"); });
  }, [token, router]);

  return (
    <div style={{ minHeight: "100svh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fd }}>
      <div style={{ textAlign: "center", padding: 20 }}>
        {status === "verifying" ? (
          <>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #F97316", borderTopColor: "transparent", margin: "0 auto 20px", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ font: `500 1rem/1.4 ${fd}`, color: "#9CA3AF" }}>Verificando enlace...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h2 style={{ font: `700 1.2rem/1.3 ${fd}`, color: "#FFFFFF", marginBottom: 8 }}>Enlace inválido</h2>
            <p style={{ font: `400 0.875rem/1.5 ${fd}`, color: "#6B7280", marginBottom: 24 }}>{error}</p>
            <a href="/alumno/login" style={{ display: "inline-block", padding: "11px 24px", background: "#F97316", color: "white", borderRadius: 10, font: `600 0.875rem/1 ${fd}`, textDecoration: "none" }}>
              Solicitar nuevo enlace
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function AlumnoAuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  );
}
