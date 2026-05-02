"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase embeds tokens in the URL hash after the redirect
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push("/start?login=1"), 2500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#040508] text-white px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ background: "rgba(16,16,20,0.97)", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6A00]/15">
            <Lock className="h-5 w-5 text-[#FF6A00]" />
          </div>
          <div>
            <h1 className="text-[1.1rem] font-bold tracking-tight">Nueva contraseña</h1>
            <p className="text-[12px] text-white/40">FitGrowX</p>
          </div>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">✅</div>
            <p className="font-semibold text-white/80">¡Contraseña actualizada!</p>
            <p className="text-[12px] text-white/40 mt-2">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/40">Verificando link...</p>
            <p className="text-[11px] text-white/25 mt-3">Si llegaste aquí por error, volvé a <a href="/start?login=1" className="text-[#FF6A00] hover:underline">iniciar sesión</a>.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nueva contraseña"
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-12 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF6A00] transition"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repetir contraseña"
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#FF6A00] transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="mt-1 flex h-12 items-center justify-center rounded-full text-sm font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(180deg, #ff7a1a 0%, #ff6000 55%, #e05000 100%)", boxShadow: "0 8px 32px rgba(255,96,0,0.28)" }}
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
