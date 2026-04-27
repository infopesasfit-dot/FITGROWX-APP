"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogOut, Shield } from "lucide-react";

export default function PlatformHeader() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/start");
  }

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(238,242,246,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(0,0,0,0.07)",
      padding: "0 28px",
      height: 52,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={15} color="#6366f1" />
        <span style={{ font: "700 0.82rem/1 'Inter', sans-serif", color: "#111827", letterSpacing: "-0.01em" }}>
          FitGrowX Platform
        </span>
        <span style={{ padding: "2px 8px", borderRadius: 9999, background: "rgba(99,102,241,0.1)", font: "600 0.65rem/1 'Inter', sans-serif", color: "#6366f1" }}>
          interno
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {email && (
          <span style={{ font: "400 0.78rem/1 'Inter', sans-serif", color: "#9CA3AF" }}>
            {email}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8,
            background: "rgba(0,0,0,0.05)", border: "none",
            font: "600 0.78rem/1 'Inter', sans-serif", color: "#374151",
            cursor: "pointer",
          }}
        >
          <LogOut size={13} />
          Salir
        </button>
      </div>
    </header>
  );
}
