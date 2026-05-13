"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const fd = "'Inter', system-ui, sans-serif";

function fmt(n: number) { return n.toLocaleString("es-AR", { maximumFractionDigits: 0 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" }); }

interface Gym { id: string; gym_name: string; owner_name: string | null; is_subscription_active: boolean; gym_status: string; subscription_expires_at: string | null; created_at: string; }
interface Commission { id: string; gym_id: string; commission_amount: number; payment_type: string; period_month: string; status: string; created_at: string; }
interface Withdrawal { id: string; amount: number; status: string; requested_at: string; paid_at: string | null; }

interface PortalData {
  reseller: { name: string; slug: string; commission_pct: number; tier: string; payout_info: string | null; cuit: string | null; fiscal_condition: string };
  gyms: Gym[];
  commissions: Commission[];
  withdrawals: Withdrawal[];
  stats: {
    totalGyms: number; activeGyms: number; thisMonthAmt: number; lastMonthAmt: number;
    pctChange: number | null; pendingAmt: number; paidAmt: number; annualProjection: number;
    nextRenewal: { name: string; date: string } | null;
  };
  tier: { current: { key: string; label: string; pct: number }; next: { key: string; label: string; minGyms: number; pct: number } | null; gymsToNext: number; progress: number };
  hasPendingWithdrawal: boolean;
  minWithdrawal: number;
}

export default function ResellerPortal() {
  const [data,        setData]        = useState<PortalData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab,   setActiveTab]   = useState<"resumen" | "gyms" | "historial">("resumen");
  const [editFiscal,  setEditFiscal]  = useState(false);
  const [cuitInput,   setCuitInput]   = useState("");
  const [fcInput,     setFcInput]     = useState("monotributo");
  const [payoutInput, setPayoutInput] = useState("");
  const [savingFiscal,setSavingFiscal]= useState(false);
  const [fiscalMsg,   setFiscalMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Iniciá sesión para acceder."); setLoading(false); return; }
      const r = await fetch("/api/reseller/me").catch(() => null);
      if (!r?.ok) { setError("No tenés acceso como revendedor."); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    })();
  }, []);

  const handleWithdrawal = async () => {
    if (!data || withdrawing) return;
    setWithdrawing(true);
    const r = await fetch("/api/reseller/withdrawal", { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (r?.ok) {
      setWithdrawMsg({ ok: true, text: `Solicitud enviada por $${fmt(d.amount)} ARS. Procesamos el 1 de cada mes.` });
      setData(prev => prev ? { ...prev, hasPendingWithdrawal: true } : prev);
    } else {
      setWithdrawMsg({ ok: false, text: d?.error ?? "Error al solicitar" });
    }
    setWithdrawing(false);
    setTimeout(() => setWithdrawMsg(null), 6000);
  };

  const handleSaveFiscal = async () => {
    setSavingFiscal(true); setFiscalMsg(null);
    const r = await fetch("/api/reseller/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuit: cuitInput, fiscal_condition: fcInput, payout_info: payoutInput || undefined }),
    });
    const d = await r.json();
    setSavingFiscal(false);
    if (!r.ok) { setFiscalMsg({ ok: false, text: d.error ?? "Error al guardar" }); return; }
    setFiscalMsg({ ok: true, text: "Datos guardados correctamente" });
    setData(prev => prev ? { ...prev, reseller: { ...prev.reseller, cuit: cuitInput, fiscal_condition: fcInput, payout_info: payoutInput || prev.reseller.payout_info } } : prev);
    setEditFiscal(false);
    setTimeout(() => setFiscalMsg(null), 4000);
  };

  const appUrl   = typeof window !== "undefined" ? window.location.origin : "https://fitgrowx.com";

  if (loading) return (
    <div style={{ minHeight: "100svh", background: "#080810", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#F97316", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100svh", background: "#080810", fontFamily: fd, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🔒</p>
        <p style={{ font: `600 1rem/1.4 ${fd}`, color: "rgba(255,255,255,0.7)" }}>{error ?? "Acceso denegado"}</p>
      </div>
    </div>
  );

  const { reseller, gyms, commissions, withdrawals, stats, tier, hasPendingWithdrawal, minWithdrawal } = data;
  const refLink = `${appUrl}/start?reseller=${reseller.slug}`;
  const hasFiscalData = !!reseller.cuit && reseller.fiscal_condition !== "pendiente";
  const canWithdraw = stats.pendingAmt >= minWithdrawal && !hasPendingWithdrawal && hasFiscalData;

  const nextPaymentDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  })();

  return (
    <div style={{ minHeight: "100svh", background: "#080810", fontFamily: fd, color: "#FFFFFF", paddingBottom: 48 }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: -300, left: "30%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 860, margin: "0 auto" }}>
        <div>
          <p style={{ font: `500 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>Portal Revendedor</p>
          <p style={{ font: `700 1.1rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.02em" }}>{reseller.name}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ font: `500 0.72rem/1 ${fd}`, color: "#22C55E" }}>Activo</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 0" }}>

        {/* ── HERO: comisión del mes ── */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: "28px 28px 24px", marginBottom: 16, animation: "fadeUp 0.3s ease", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", bottom: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)" }} />
          <p style={{ font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
            Comisión este mes
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 8 }}>
            <p style={{ font: `900 3.2rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em" }}>
              ${fmt(stats.thisMonthAmt)}
            </p>
            {stats.pctChange !== null && (
              <span style={{ font: `600 0.85rem/1 ${fd}`, color: stats.pctChange >= 0 ? "#34D399" : "#F87171", background: stats.pctChange >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", padding: "4px 10px", borderRadius: 9999, marginBottom: 8 }}>
                {stats.pctChange >= 0 ? "+" : ""}{stats.pctChange}% vs mes ant.
              </span>
            )}
          </div>
          <p style={{ font: `400 0.75rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>
            {stats.activeGyms} gyms activos · {reseller.commission_pct}% comisión
          </p>
        </div>

        {/* ── 4 stats cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            {
              label: "Pendiente de cobro",
              value: `$${fmt(stats.pendingAmt)}`,
              sub:   `Pago el ${nextPaymentDate}`,
              color: "#F59E0B",
            },
            {
              label: "Proyección anual",
              value: `$${fmt(stats.annualProjection)}`,
              sub:   "a este ritmo",
              color: "#34D399",
            },
            {
              label: "Gyms activos",
              value: `${stats.activeGyms}/${stats.totalGyms}`,
              sub:   `${stats.totalGyms - stats.activeGyms} en trial o inactivos`,
              color: "#60A5FA",
            },
            {
              label: "Total cobrado",
              value: `$${fmt(stats.paidAmt)}`,
              sub:   "histórico",
              color: "rgba(255,255,255,0.5)",
            },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px" }}>
              <p style={{ font: `500 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</p>
              <p style={{ font: `800 1.5rem/1 ${fd}`, color: s.color, letterSpacing: "-0.03em", marginBottom: 4 }}>{s.value}</p>
              <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.22)" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tier progress ── */}
        {tier.next && (
          <div style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <p style={{ font: `600 0.78rem/1 ${fd}`, color: "#F97316" }}>
                  Tier actual: <strong>{tier.current.label}</strong> ({tier.current.pct}%)
                </p>
                <p style={{ font: `400 0.68rem/1.4 ${fd}`, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                  {tier.gymsToNext} gym{tier.gymsToNext !== 1 ? "s" : ""} más para pasar a <strong style={{ color: "rgba(255,255,255,0.6)" }}>{tier.next.label} ({tier.next.pct}%)</strong>
                </p>
              </div>
              <p style={{ font: `700 1.1rem/1 ${fd}`, color: "#F97316", flexShrink: 0 }}>{tier.progress}%</p>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${tier.progress}%`, borderRadius: 99, background: "linear-gradient(90deg, #F97316, #EA580C)", transition: "width 0.6s ease" }} />
            </div>
            <p style={{ font: `400 0.62rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
              Con {tier.next.minGyms} gyms activos, tu comisión sube de {tier.current.pct}% a {tier.next.pct}% — +${fmt(Math.round((tier.next.pct - tier.current.pct) / 100 * tier.next.minGyms * 65000))}/mes extra
            </p>
          </div>
        )}
        {!tier.next && (
          <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 18, padding: "14px 20px", marginBottom: 16 }}>
            <p style={{ font: `600 0.78rem/1 ${fd}`, color: "#34D399" }}>👑 Tier Franquicia — comisión máxima del 30%</p>
          </div>
        )}

        {/* ── Link de revendedor ── */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}>
          <p style={{ font: `600 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>🔗 Tu link de revendedor</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <code style={{ flex: 1, font: `500 0.75rem/1.4 ${fd}`, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", wordBreak: "break-all", display: "block" }}>
              {refLink}
            </code>
            <button
              onClick={() => {
                if (navigator.share) { navigator.share({ url: refLink }).catch(() => {}); }
                else { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }
              }}
              style={{ flexShrink: 0, padding: "10px 16px", background: copied ? "rgba(52,211,153,0.2)" : "rgba(249,115,22,0.15)", border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "rgba(249,115,22,0.3)"}`, color: copied ? "#34D399" : "#F97316", borderRadius: 10, font: `600 0.78rem/1 ${fd}`, cursor: "pointer", transition: "all 0.2s" }}
            >
              {copied ? "✓ Copiado" : "Compartir"}
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(255,255,255,0.04)", borderRadius: 14, marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
          {(["resumen", "gyms", "historial"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "none", background: activeTab === t ? "rgba(255,255,255,0.08)" : "transparent", color: activeTab === t ? "#FFFFFF" : "rgba(255,255,255,0.35)", font: `${activeTab === t ? 600 : 400} 0.78rem/1 ${fd}`, cursor: "pointer", textTransform: "capitalize" }}>
              {t === "resumen" ? "Resumen" : t === "gyms" ? `Gyms (${stats.totalGyms})` : "Historial"}
            </button>
          ))}
        </div>

        {/* ── Tab: Resumen ── */}
        {activeTab === "resumen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.2s ease" }}>

            {/* Next renewal */}
            {stats.nextRenewal && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>📅</span>
                <div>
                  <p style={{ font: `600 0.82rem/1.2 ${fd}`, color: "#FFFFFF" }}>Próxima comisión: {fmtDate(stats.nextRenewal.date)}</p>
                  <p style={{ font: `400 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{stats.nextRenewal.name} renueva su plan</p>
                </div>
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#F97316", marginLeft: "auto", flexShrink: 0 }}>
                  +${fmt(Math.round(65000 * reseller.commission_pct / 100))}
                </p>
              </div>
            )}

            {/* Fiscal data section */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${hasFiscalData ? "rgba(255,255,255,0.06)" : "rgba(245,158,11,0.3)"}`, borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasFiscalData && !editFiscal ? 0 : 14 }}>
                <div>
                  <p style={{ font: `600 0.82rem/1.2 ${fd}`, color: "#FFFFFF" }}>
                    {hasFiscalData ? "🧾 Datos fiscales" : "⚠️ Datos fiscales incompletos"}
                  </p>
                  {!hasFiscalData && !editFiscal && (
                    <p style={{ font: `400 0.72rem/1.5 ${fd}`, color: "rgba(245,158,11,0.8)", marginTop: 3 }}>
                      Necesitás cargar tu CUIT y condición fiscal para solicitar retiros.
                    </p>
                  )}
                  {hasFiscalData && !editFiscal && (
                    <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
                      {reseller.cuit} · {reseller.fiscal_condition === "monotributo" ? "Monotributista" : "Resp. Inscripto"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setEditFiscal(!editFiscal); setCuitInput(reseller.cuit ?? ""); setFcInput(reseller.fiscal_condition !== "pendiente" ? reseller.fiscal_condition : "monotributo"); setPayoutInput(reseller.payout_info ?? ""); }}
                  style={{ flexShrink: 0, padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, font: `500 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
                >
                  {editFiscal ? "Cancelar" : hasFiscalData ? "Editar" : "Cargar"}
                </button>
              </div>

              {editFiscal && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>CUIT</label>
                    <input
                      value={cuitInput}
                      onChange={e => setCuitInput(e.target.value)}
                      placeholder="20-12345678-9"
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: "#FFFFFF", boxSizing: "border-box", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Condición fiscal</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[["monotributo", "Monotributista"], ["responsable_inscripto", "Resp. Inscripto"]].map(([val, lbl]) => (
                        <button key={val} onClick={() => setFcInput(val)}
                          style={{ flex: 1, padding: "10px 0", background: fcInput === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${fcInput === val ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, font: `${fcInput === val ? 700 : 400} 0.8rem/1 ${fd}`, color: fcInput === val ? "#F97316" : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>CBU / Alias para cobros</label>
                    <input
                      value={payoutInput}
                      onChange={e => setPayoutInput(e.target.value)}
                      placeholder="CBU o alias de Mercado Pago / banco"
                      style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: "#FFFFFF", boxSizing: "border-box", outline: "none" }}
                    />
                  </div>
                  {fiscalMsg && (
                    <p style={{ font: `500 0.78rem/1 ${fd}`, color: fiscalMsg.ok ? "#34D399" : "#F87171" }}>{fiscalMsg.text}</p>
                  )}
                  <button
                    onClick={handleSaveFiscal}
                    disabled={savingFiscal || !cuitInput.trim()}
                    style={{ padding: "11px 0", background: savingFiscal ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", border: "none", borderRadius: 10, font: `700 0.82rem/1 ${fd}`, color: savingFiscal ? "rgba(255,255,255,0.3)" : "#FFFFFF", cursor: savingFiscal ? "not-allowed" : "pointer" }}
                  >
                    {savingFiscal ? "Guardando..." : "Guardar datos fiscales"}
                  </button>
                </div>
              )}
            </div>

            {/* Withdrawal section */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${canWithdraw ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ font: `600 0.82rem/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 4 }}>Retiro de comisiones</p>
                  <p style={{ font: `400 0.72rem/1.5 ${fd}`, color: "rgba(255,255,255,0.3)" }}>
                    {hasPendingWithdrawal
                      ? "Solicitud enviada — procesamos el 1 del mes próximo."
                      : !hasFiscalData
                      ? "Completá tus datos fiscales (CUIT) para habilitar los retiros."
                      : stats.pendingAmt < minWithdrawal
                      ? `Mínimo $${fmt(minWithdrawal)} ARS para solicitar. Te faltan $${fmt(minWithdrawal - stats.pendingAmt)}.`
                      : `Tenés $${fmt(stats.pendingAmt)} disponibles para retirar.`}
                  </p>
                  {reseller.payout_info && (
                    <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Destino: {reseller.payout_info}</p>
                  )}
                </div>
                <button
                  onClick={handleWithdrawal}
                  disabled={!canWithdraw || withdrawing}
                  style={{ flexShrink: 0, padding: "11px 18px", background: canWithdraw && !withdrawing ? "linear-gradient(135deg, #34D399 0%, #059669 100%)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 12, font: `700 0.8rem/1 ${fd}`, color: canWithdraw && !withdrawing ? "#FFFFFF" : "rgba(255,255,255,0.25)", cursor: canWithdraw && !withdrawing ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                >
                  {withdrawing ? "Enviando..." : hasPendingWithdrawal ? "✓ Solicitado" : "Solicitar retiro"}
                </button>
              </div>
              {withdrawMsg && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: withdrawMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${withdrawMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 10 }}>
                  <p style={{ font: `500 0.78rem/1.4 ${fd}`, color: withdrawMsg.ok ? "#34D399" : "#F87171" }}>{withdrawMsg.text}</p>
                </div>
              )}
              {withdrawals.length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {withdrawals.map(w => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)" }}>{fmtDate(w.requested_at)}</p>
                      <p style={{ font: `600 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.6)" }}>${fmt(w.amount)}</p>
                      <span style={{ font: `500 0.62rem/1 ${fd}`, color: w.status === "paid" ? "#34D399" : w.status === "processing" ? "#60A5FA" : "#F59E0B", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {w.status === "paid" ? "Pagado" : w.status === "processing" ? "En proceso" : "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Gyms ── */}
        {activeTab === "gyms" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden", animation: "fadeUp 0.2s ease" }}>
            {gyms.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>🏋️</p>
                <p style={{ font: `500 0.85rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)" }}>
                  Todavía no registraste ningún gym. Compartí tu link para empezar a ganar.
                </p>
              </div>
            ) : gyms.map((g, i) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: i < gyms.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: g.is_subscription_active ? "#22C55E" : g.gym_status === "trial" ? "#F59E0B" : "#6B7280" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: `600 0.85rem/1.2 ${fd}`, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.gym_name}</p>
                  <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                    {g.owner_name ?? "—"}
                    {g.subscription_expires_at && g.is_subscription_active && (
                      <> · renueva {fmtDate(g.subscription_expires_at)}</>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ font: `600 0.78rem/1 ${fd}`, color: g.is_subscription_active ? "#34D399" : "rgba(255,255,255,0.2)" }}>
                    {g.is_subscription_active ? `+$${fmt(Math.round(65000 * reseller.commission_pct / 100))}/mes` : "—"}
                  </p>
                  <p style={{ font: `500 0.6rem/1 ${fd}`, color: g.is_subscription_active ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.15)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {g.is_subscription_active ? "Activo" : g.gym_status === "trial" ? "Trial" : "Inactivo"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Historial ── */}
        {activeTab === "historial" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, overflow: "hidden", animation: "fadeUp 0.2s ease" }}>
            {commissions.length === 0 ? (
              <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "rgba(255,255,255,0.3)", padding: "24px 20px", textAlign: "center" }}>Todavía no se generaron comisiones.</p>
            ) : commissions.slice(0, 30).map((c, i) => {
              const gym = gyms.find(g => g.id === c.gym_id);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < Math.min(commissions.length, 30) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ font: `500 0.82rem/1.2 ${fd}`, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {gym?.gym_name ?? "—"}
                    </p>
                    <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                      {c.period_month} · {c.payment_type === "annual" ? "Pago anual" : "Mensual"}
                    </p>
                  </div>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#34D399", flexShrink: 0 }}>+${fmt(c.commission_amount)}</p>
                  <span style={{ font: `500 0.6rem/1 ${fd}`, color: c.status === "paid" ? "#34D399" : "#F59E0B", background: c.status === "paid" ? "rgba(52,211,153,0.08)" : "rgba(245,158,11,0.08)", padding: "2px 8px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                    {c.status === "paid" ? "Pagada" : "Pendiente"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
