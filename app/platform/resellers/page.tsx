"use client";

import { useState, useEffect, useCallback } from "react";

const fd = "'Inter', system-ui, sans-serif";
const t1 = "#111827"; const t2 = "#6B7280"; const t3 = "#9CA3AF";

function fmt(n: number) { return n.toLocaleString("es-AR", { maximumFractionDigits: 0 }); }

const EMPTY_FORM = { name: "", slug: "", email: "", commission_pct: "20", tier: "standard", payout_info: "" };

interface Application {
  id: string; name: string; email: string; whatsapp: string;
  colleague_count: string | null; social_links: string | null;
  motivation: string | null; status: string; created_at: string;
}

interface Reseller {
  id: string; name: string; slug: string; commission_pct: number; tier: string;
  status: string; payout_info: string | null; user_id: string | null;
  cuit: string | null; fiscal_condition: string;
  totalGyms: number; activeGyms: number; pendingAmt: number; created_at: string;
}
interface Withdrawal {
  id: string; reseller_id: string; amount: number; status: string; requested_at: string;
  resellers: { name: string } | null;
}

export default function PlatformResellers() {
  const [tab,          setTab]         = useState<"resellers" | "postulaciones">("resellers");
  const [resellers,    setResellers]   = useState<Reseller[]>([]);
  const [withdrawals,  setWithdrawals] = useState<Withdrawal[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoaded,   setAppsLoaded]  = useState(false);
  const [loading,      setLoading]     = useState(true);
  const [showForm,     setShowForm]    = useState(false);
  const [form,         setForm]        = useState(EMPTY_FORM);
  const [saving,       setSaving]      = useState(false);
  const [formError,    setFormError]   = useState<string | null>(null);
  const [toast,        setToast]       = useState<string | null>(null);
  const [editId,       setEditId]      = useState<string | null>(null);
  const [editComm,     setEditComm]    = useState("");
  const [editTier,     setEditTier]    = useState("");
  const [editStatus,   setEditStatus]  = useState("");
  const [expandedApp,  setExpandedApp] = useState<string | null>(null);
  const [onboarding,   setOnboarding]  = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://fitgrowx.com";

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/platform/resellers").catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setResellers(d.resellers ?? []);
      setWithdrawals(d.pendingWithdrawals ?? []);
    }
    setLoading(false);
  }, []);

  const loadApps = useCallback(async () => {
    const r = await fetch("/api/platform/resellers/applications").catch(() => null);
    if (r?.ok) { const d = await r.json(); setApplications(d.applications ?? []); }
    setAppsLoaded(true);
  }, []);

  const handleAppStatus = async (id: string, status: "approved" | "rejected") => {
    await fetch("/api/platform/resellers/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    showToast(status === "approved" ? "✅ Aprobado — WA enviado al postulante" : "❌ Rechazado — WA enviado al postulante");
  };

  const onboardReseller = async (app: Application) => {
    if (onboarding) return;
    setOnboarding(app.id);
    const r = await fetch("/api/platform/resellers/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: app.id,
        name:          app.name,
        email:         app.email,
        whatsapp:      app.whatsapp,
      }),
    });
    const d = await r.json();
    setOnboarding(null);
    if (!r.ok) { showToast(`❌ ${d.error ?? "Error"}`); return; }
    setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: "approved" } : a));
    const waMsg = d.waSent
      ? `✅ Reseller creado — WA enviado a ${app.name.split(" ")[0]} con su link y acceso`
      : d.waBlocked
      ? `⚠️ Reseller creado — WA número bloqueado (no se pudo enviar notificación)`
      : `⚠️ Reseller creado — WSP de FitGrowX desconectado (notificación no enviada, pero cuenta lista)`;
    showToast(waMsg);
    void load();
  };

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (tab === "postulaciones" && !appsLoaded) void loadApps(); }, [tab, appsLoaded, loadApps]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.slug.trim()) { setFormError("Nombre y slug requeridos"); return; }
    setSaving(true); setFormError(null);
    const r = await fetch("/api/platform/resellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, commission_pct: Number(form.commission_pct) }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setFormError(d.error ?? "Error al crear"); return; }
    setForm(EMPTY_FORM); setShowForm(false);
    showToast(`✅ Reseller "${d.reseller.name}" creado`);
    void load();
  };

  const handleSaveEdit = async (id: string) => {
    await fetch("/api/platform/resellers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resellerId: id, commission_pct: Number(editComm), tier: editTier, status: editStatus }),
    });
    setEditId(null);
    showToast("✅ Actualizado");
    void load();
  };

  const handlePayWithdrawal = async (withdrawalId: string, resellerName: string, amount: number) => {
    if (!confirm(`¿Marcar el retiro de $${fmt(amount)} de ${resellerName} como pagado?`)) return;
    await fetch("/api/platform/resellers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "pay_withdrawal", withdrawalId }),
    });
    showToast("✅ Retiro marcado como pagado — WA enviado al reseller");
    void load();
  };

  const tierColor = (tier: string) => tier === "franchise" ? "#F59E0B" : tier === "premium" ? "#818CF8" : t3;
  const statusColor = (s: string) => s === "active" ? "#22C55E" : "#EF4444";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14, fontFamily: fd }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ font: `700 1rem/1 ${fd}`, color: t1, letterSpacing: "-0.02em" }}>Resellers</h1>
        {tab === "resellers" && (
          <button
            onClick={() => { setShowForm(true); setFormError(null); }}
            style={{ padding: "10px 20px", background: "#6366f1", color: "white", border: "none", borderRadius: 12, font: `700 0.82rem/1 ${fd}`, cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}
          >
            + Nuevo reseller
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {([
          { key: "resellers",     label: "Resellers" },
          { key: "postulaciones", label: "Postulaciones", badge: applications.filter(a => a.status === "pending").length || undefined },
        ] as { key: "resellers" | "postulaciones"; label: string; badge?: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", border: "none", borderRadius: 9,
              background: tab === t.key ? "white" : "transparent",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              font: `${tab === t.key ? 700 : 500} 0.8rem/1 ${fd}`,
              color: tab === t.key ? t1 : t2, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.label}
            {t.badge ? (
              <span style={{ background: "#EF4444", color: "white", borderRadius: 9999, font: `700 0.62rem/1 ${fd}`, padding: "2px 6px" }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── POSTULACIONES TAB ── */}
      {tab === "postulaciones" && (
        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 18, overflow: "hidden" }}>
          {!appsLoaded ? (
            <p style={{ font: `400 0.82rem/1 ${fd}`, color: t3, padding: 24, textAlign: "center" }}>Cargando...</p>
          ) : applications.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>📬</p>
              <p style={{ font: `600 0.95rem/1.4 ${fd}`, color: t1, marginBottom: 6 }}>Sin postulaciones todavía</p>
              <p style={{ font: `400 0.8rem/1.5 ${fd}`, color: t2 }}>Las postulaciones del formulario en /reseller aparecerán acá.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {applications.map((app, i) => {
                const isPending  = app.status === "pending";
                const isApproved = app.status === "approved";
                const isExpanded = expandedApp === app.id;
                const statusBg   = isPending ? "rgba(245,158,11,0.08)" : isApproved ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
                const statusClr  = isPending ? "#B45309" : isApproved ? "#15803D" : "#B91C1C";
                const statusLbl  = isPending ? "Pendiente" : isApproved ? "Aprobado" : "Rechazado";
                return (
                  <div key={app.id} style={{ borderBottom: i < applications.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer" }}
                      onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                    >
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E0E7FF", display: "flex", alignItems: "center", justifyContent: "center", font: `700 0.85rem/1 ${fd}`, color: "#6366f1", flexShrink: 0 }}>
                        {app.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.88rem/1.2 ${fd}`, color: t1 }}>{app.name}</p>
                        <p style={{ font: `400 0.72rem/1 ${fd}`, color: t3, marginTop: 2 }}>{app.email} · {app.whatsapp}</p>
                      </div>
                      {app.colleague_count && (
                        <span style={{ font: `500 0.72rem/1 ${fd}`, color: t2, background: "#F3F4F6", padding: "3px 8px", borderRadius: 6, flexShrink: 0 }}>
                          👥 {app.colleague_count} colegas
                        </span>
                      )}
                      <span style={{ font: `600 0.68rem/1 ${fd}`, color: statusClr, background: statusBg, padding: "4px 10px", borderRadius: 9999, flexShrink: 0 }}>{statusLbl}</span>
                      <span style={{ color: t3, font: `400 0.8rem/1 ${fd}`, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 20px 16px 68px", display: "flex", flexDirection: "column", gap: 12 }}>
                        {app.social_links && (
                          <div>
                            <p style={{ font: `500 0.65rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Redes sociales</p>
                            <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: t2 }}>{app.social_links}</p>
                          </div>
                        )}
                        {app.motivation && (
                          <div>
                            <p style={{ font: `500 0.65rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Motivación</p>
                            <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: t2 }}>{app.motivation}</p>
                          </div>
                        )}
                        <p style={{ font: `400 0.68rem/1 ${fd}`, color: t3 }}>
                          Recibida el {new Date(app.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        {isPending && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <button
                              onClick={() => onboardReseller(app)}
                              disabled={onboarding === app.id}
                              style={{ padding: "9px 20px", background: onboarding === app.id ? "#E5E7EB" : "#6366f1", color: onboarding === app.id ? t3 : "white", border: "none", borderRadius: 9, font: `700 0.78rem/1 ${fd}`, cursor: onboarding === app.id ? "not-allowed" : "pointer" }}
                            >
                              {onboarding === app.id ? "Creando..." : "🚀 Aprobar y dar acceso"}
                            </button>
                            <button
                              onClick={() => handleAppStatus(app.id, "rejected")}
                              style={{ padding: "9px 20px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 9, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                        {isApproved && (
                          <button
                            onClick={() => onboardReseller(app)}
                            disabled={onboarding === app.id}
                            style={{ width: "fit-content", padding: "9px 20px", background: "#6366f1", color: "white", border: "none", borderRadius: 9, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                          >
                            {onboarding === app.id ? "Creando..." : "➕ Crear reseller"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── RESELLERS TAB ── */}
      {tab === "resellers" && <>

      {/* Pending withdrawals */}
      {withdrawals.length > 0 && (
        <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 16, padding: "16px 20px" }}>
          <p style={{ font: `700 0.82rem/1 ${fd}`, color: "#B45309", marginBottom: 12 }}>⏳ Retiros pendientes de pago</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {withdrawals.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "white", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1 }}>{w.resellers?.name ?? "—"}</p>
                  <p style={{ font: `400 0.7rem/1 ${fd}`, color: t3, marginTop: 2 }}>{new Date(w.requested_at).toLocaleDateString("es-AR")}</p>
                </div>
                <p style={{ font: `700 1rem/1 ${fd}`, color: "#B45309" }}>${fmt(w.amount)}</p>
                <button
                  onClick={() => handlePayWithdrawal(w.id, w.resellers?.name ?? "", w.amount)}
                  style={{ padding: "8px 16px", background: "#16A34A", color: "white", border: "none", borderRadius: 9, font: `700 0.75rem/1 ${fd}`, cursor: "pointer" }}
                >
                  Marcar pagado
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liquidación de comisiones */}
      {!loading && (() => {
        const payouts = resellers.filter(r => r.pendingAmt > 0 && r.status === "active");
        if (!payouts.length) return null;
        const total = payouts.reduce((s, r) => s + r.pendingAmt, 0);
        return (
          <div style={{ background: "white", border: "2px solid #E0E7FF", borderRadius: 18, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E0E7FF", background: "rgba(99,102,241,0.03)" }}>
              <div>
                <p style={{ font: `700 0.82rem/1 ${fd}`, color: "#4338CA" }}>💸 Liquidación pendiente</p>
                <p style={{ font: `400 0.72rem/1 ${fd}`, color: t3, marginTop: 3 }}>{payouts.length} reseller{payouts.length > 1 ? "s" : ""} con comisiones a transferir</p>
              </div>
              <p style={{ font: `800 1.25rem/1 ${fd}`, color: "#4338CA" }}>${fmt(total)}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {payouts.map((r, i) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "13px 20px",
                  borderBottom: i < payouts.length - 1 ? "1px solid #F3F4F6" : "none",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ font: `600 0.88rem/1.2 ${fd}`, color: t1 }}>{r.name}</p>
                    {r.payout_info ? (
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: t3, marginTop: 2 }}>
                        CBU/Alias: <span style={{ color: t2, fontWeight: 600 }}>{r.payout_info}</span>
                      </p>
                    ) : (
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: "#EF4444", marginTop: 2 }}>⚠ Sin CBU/alias cargado</p>
                    )}
                    {r.cuit ? (
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: t3, marginTop: 1 }}>
                        CUIT: <span style={{ color: t2, fontWeight: 600 }}>{r.cuit}</span>
                        {r.fiscal_condition && r.fiscal_condition !== "pendiente" && (
                          <span style={{ marginLeft: 6, font: `500 0.62rem/1 ${fd}`, color: "#6366f1", background: "rgba(99,102,241,0.07)", padding: "2px 6px", borderRadius: 6 }}>
                            {r.fiscal_condition === "monotributo" ? "Monotrib." : "R. Inscripto"}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p style={{ font: `400 0.72rem/1 ${fd}`, color: "#F59E0B", marginTop: 1 }}>⚠ Sin CUIT — no puede solicitar retiro</p>
                    )}
                  </div>
                  <p style={{ font: `800 1rem/1 ${fd}`, color: "#4338CA", flexShrink: 0 }}>${fmt(r.pendingAmt)}</p>
                  <button
                    onClick={() => {
                      const text = r.payout_info
                        ? `${r.name}: $${fmt(r.pendingAmt)} → ${r.payout_info}`
                        : `${r.name}: $${fmt(r.pendingAmt)} (sin CBU)`;
                      navigator.clipboard.writeText(text);
                      showToast("Copiado");
                    }}
                    style={{ padding: "6px 12px", background: "#EEF2FF", color: "#4338CA", border: "none", borderRadius: 8, font: `600 0.7rem/1 ${fd}`, cursor: "pointer", flexShrink: 0 }}
                  >
                    Copiar
                  </button>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
              <button
                onClick={() => {
                  const lines = payouts.map(r =>
                    `${r.name}: $${fmt(r.pendingAmt)}${r.payout_info ? ` → ${r.payout_info}` : " (sin CBU)"}`
                  ).join("\n");
                  navigator.clipboard.writeText(`LIQUIDACIÓN RESELLERS\n${"─".repeat(30)}\n${lines}\n${"─".repeat(30)}\nTOTAL: $${fmt(total)}`);
                  showToast("Lista completa copiada");
                }}
                style={{ width: "100%", padding: "10px 0", background: "#4338CA", color: "white", border: "none", borderRadius: 10, font: `700 0.8rem/1 ${fd}`, cursor: "pointer" }}
              >
                Copiar lista completa
              </button>
            </div>
          </div>
        );
      })()}

      {/* Stats summary */}
      {!loading && resellers.length > 0 && (() => {
        const totalActive = resellers.filter(r => r.status === "active").length;
        const totalGyms   = resellers.reduce((s, r) => s + r.activeGyms, 0);
        const totalPending= resellers.reduce((s, r) => s + r.pendingAmt, 0);
        const mrr         = totalGyms * 65000;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Resellers activos", value: totalActive },
              { label: "Gyms en la red",    value: totalGyms,  prefix: "" },
              { label: "MRR generado",       value: `$${fmt(mrr)}` },
              { label: "Comisiones pendientes", value: `$${fmt(totalPending)}` },
            ].map(s => (
              <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 14, padding: "14px 16px" }}>
                <p style={{ font: `500 0.62rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{s.label}</p>
                <p style={{ font: `700 1.4rem/1 ${fd}`, color: t1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Reseller list */}
      <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 18, overflow: "hidden" }}>
        {loading ? (
          <p style={{ font: `400 0.82rem/1 ${fd}`, color: t3, padding: "24px", textAlign: "center" }}>Cargando...</p>
        ) : resellers.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🤝</p>
            <p style={{ font: `600 0.95rem/1.4 ${fd}`, color: t1, marginBottom: 6 }}>Todavía no hay resellers</p>
            <p style={{ font: `400 0.8rem/1.5 ${fd}`, color: t2 }}>Creá el primer revendedor con el botón de arriba.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Reseller", "Slug / Link", "Comisión", "Tier", "Gyms", "Pendiente", "Estado", ""].map(h => (
                  <th key={h} style={{ font: `600 0.68rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", padding: "12px 16px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resellers.map((r, i) => (
                <>
                  <tr key={r.id} style={{ borderBottom: i < resellers.length - 1 ? "1px solid #F9FAFB" : "none", background: editId === r.id ? "#F9FAFB" : "white" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ font: `600 0.85rem/1.2 ${fd}`, color: t1 }}>{r.name}</p>
                      {r.payout_info && <p style={{ font: `400 0.68rem/1 ${fd}`, color: t3, marginTop: 2 }}>{r.payout_info}</p>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <code style={{ font: `500 0.72rem/1 ${fd}`, color: "#6366f1", background: "rgba(99,102,241,0.06)", padding: "3px 7px", borderRadius: 6 }}>{r.slug}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${appUrl}/start?reseller=${r.slug}`); showToast("Link copiado"); }}
                        style={{ marginLeft: 8, font: `500 0.62rem/1 ${fd}`, color: t3, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        copiar link
                      </button>
                    </td>
                    <td style={{ padding: "13px 16px", font: `700 0.85rem/1 ${fd}`, color: "#F97316" }}>{r.commission_pct}%</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ font: `600 0.68rem/1 ${fd}`, color: tierColor(r.tier), background: "rgba(0,0,0,0.04)", padding: "3px 8px", borderRadius: 9999, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.tier}</span>
                    </td>
                    <td style={{ padding: "13px 16px", font: `600 0.82rem/1 ${fd}`, color: t1 }}>
                      <span style={{ color: "#22C55E" }}>{r.activeGyms}</span>
                      <span style={{ color: t3 }}>/{r.totalGyms}</span>
                    </td>
                    <td style={{ padding: "13px 16px", font: `600 0.82rem/1 ${fd}`, color: r.pendingAmt > 0 ? "#D97706" : t3 }}>
                      {r.pendingAmt > 0 ? `$${fmt(r.pendingAmt)}` : "—"}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(r.status), display: "inline-block", marginRight: 5 }} />
                      <span style={{ font: `500 0.72rem/1 ${fd}`, color: t2 }}>{r.status === "active" ? "Activo" : "Pausado"}</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <button
                        onClick={() => { setEditId(editId === r.id ? null : r.id); setEditComm(String(r.commission_pct)); setEditTier(r.tier); setEditStatus(r.status); }}
                        style={{ font: `500 0.72rem/1 ${fd}`, color: "#6366f1", background: "rgba(99,102,241,0.07)", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
                      >
                        {editId === r.id ? "Cancelar" : "Editar"}
                      </button>
                    </td>
                  </tr>
                  {editId === r.id && (
                    <tr key={`edit-${r.id}`} style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                      <td colSpan={8} style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <div>
                            <label style={{ font: `500 0.65rem/1 ${fd}`, color: t3, display: "block", marginBottom: 4 }}>COMISIÓN %</label>
                            <input type="number" value={editComm} onChange={e => setEditComm(e.target.value)} min={1} max={50}
                              style={{ width: 70, padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, font: `600 0.82rem/1 ${fd}`, color: t1 }} />
                          </div>
                          <div>
                            <label style={{ font: `500 0.65rem/1 ${fd}`, color: t3, display: "block", marginBottom: 4 }}>TIER</label>
                            <select value={editTier} onChange={e => setEditTier(e.target.value)}
                              style={{ padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, font: `500 0.82rem/1 ${fd}`, color: t1 }}>
                              <option value="standard">Standard</option>
                              <option value="premium">Premium</option>
                              <option value="franchise">Franchise</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ font: `500 0.65rem/1 ${fd}`, color: t3, display: "block", marginBottom: 4 }}>ESTADO</label>
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                              style={{ padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, font: `500 0.82rem/1 ${fd}`, color: t1 }}>
                              <option value="active">Activo</option>
                              <option value="paused">Pausado</option>
                            </select>
                          </div>
                          <button
                            onClick={() => handleSaveEdit(r.id)}
                            style={{ marginTop: 16, padding: "9px 18px", background: "#111827", color: "white", border: "none", borderRadius: 9, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                          >
                            Guardar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </> /* end resellers tab */}

      {/* Create modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", width: "100%", maxWidth: 460, boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}>
            <p style={{ font: `800 1.1rem/1 ${fd}`, color: t1, marginBottom: 20 }}>Nuevo reseller</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nombre completo",       key: "name",           placeholder: "Ej: Juan García" },
                { label: "Slug (ID en el link)",   key: "slug",           placeholder: "Ej: juangarcia" },
                { label: "Email de su cuenta (opcional)", key: "email",  placeholder: "Ej: juan@gmail.com" },
                { label: "CBU / Alias para pagos", key: "payout_info",    placeholder: "Ej: 0000000 / juan.fit" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ font: `500 0.68rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: t1, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ font: `500 0.68rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Comisión %</label>
                  <input type="number" value={form.commission_pct} onChange={e => setForm(p => ({ ...p, commission_pct: e.target.value }))} min={1} max={50}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: t1, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ font: `500 0.68rem/1 ${fd}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Tier</label>
                  <select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, font: `400 0.88rem/1 ${fd}`, color: t1, boxSizing: "border-box" }}>
                    <option value="standard">Standard (20%)</option>
                    <option value="premium">Premium (25%)</option>
                    <option value="franchise">Franchise (30%)</option>
                  </select>
                </div>
              </div>

              {form.slug && (
                <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                  <p style={{ font: `400 0.72rem/1.4 ${fd}`, color: t2 }}>
                    Link que vas a compartir:<br />
                    <strong style={{ color: "#6366f1" }}>{typeof window !== "undefined" ? window.location.origin : "https://fitgrowx.com"}/start?reseller={form.slug.toLowerCase()}</strong>
                  </p>
                </div>
              )}

              {formError && <p style={{ font: `500 0.78rem/1 ${fd}`, color: "#DC2626" }}>{formError}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "11px 0", background: "#F3F4F6", border: "none", borderRadius: 10, font: `600 0.82rem/1 ${fd}`, color: t2, cursor: "pointer" }}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} style={{ flex: 2, padding: "11px 0", background: saving ? "#E5E7EB" : "#6366f1", border: "none", borderRadius: 10, font: `700 0.82rem/1 ${fd}`, color: saving ? t3 : "white", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Creando..." : "Crear reseller"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "10px 20px", borderRadius: 12, font: `500 0.82rem/1 ${fd}`, zIndex: 600, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}

    </div>
  );
}
