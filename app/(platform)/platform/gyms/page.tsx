"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { invalidateProfile } from "@/lib/gym-cache";
import { useBrandAlert, useBrandConfirm } from "@/components/brand-confirm";

const fd = "var(--font-inter, 'Inter', sans-serif)";

const shellCard: React.CSSProperties = {
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 28,
  boxShadow:
    "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
};

type GymRow = {
  id: string;
  company_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  crm_status: string;
  subscription_plan: string | null;
  monthly_value: number | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  converted_at: string | null;
  activation_score: number | null;
  last_contact_at: string | null;
  last_seen_at: string | null;
  tc_accepted_at: string | null;
  auth_user_id: string | null;
  gym_id: string | null;
  plan_type: string | null;
  gym_status: string | null;
  is_subscription_active: boolean | null;
  trial_expires_at: string | null;
  subscription_type: string | null;
  subscription_expires_at: string | null;
  gym_name: string | null;
  whatsapp: string | null;
  wa_status: string | null;
  slug: string | null;
  active_members: number;
  last_payment: string | null;
};

type SortKey = "trial_expires_at" | "last_payment" | "active_members" | "company_name";
type StatusFilter = "all" | "trial" | "active" | "trial_risk" | "trial_expired" | "cancelled" | "churned";

function statusTone(status: string) {
  const k = (status ?? "").toLowerCase();
  if (["active", "converted"].includes(k))        return { bg: "rgba(22,163,74,0.10)",   color: "#15803D" };
  if (["trial_active", "trial"].includes(k))      return { bg: "rgba(37,99,235,0.10)",   color: "#2563EB" };
  if (["trial_risk"].includes(k))                 return { bg: "rgba(234,179,8,0.14)",   color: "#A16207" };
  if (["trial_expired"].includes(k))              return { bg: "rgba(220,38,38,0.10)",   color: "#B91C1C" };
  if (["cancelled", "churned"].includes(k))       return { bg: "rgba(100,116,139,0.12)", color: "#475569" };
  return { bg: "rgba(249,115,22,0.10)", color: "#C2410C" };
}

function displayStatus(row: GymRow): string {
  if (row.gym_status) return row.gym_status;
  return row.crm_status ?? "—";
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("es-AR") : "—";
}

function fmtMoney(v: number | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 20,
      font: `600 0.72rem/1 ${fd}`,
      background: tone.bg, color: tone.color,
      textTransform: "uppercase", letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

function WaBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: "#9CA3AF", font: `400 0.78rem/1 ${fd}` }}>—</span>;
  const color = status === "active" ? "#15803D" : status === "qr" ? "#A16207" : "#9CA3AF";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color, font: `500 0.78rem/1 ${fd}` }}>
      <MessageCircle size={12} />
      {status}
    </span>
  );
}

export default function PlatformGyms() {
  const router = useRouter();
  const confirm = useBrandConfirm();
  const brandAlert = useBrandAlert();

  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("trial_expires_at");

  const [drawerGym, setDrawerGym] = useState<GymRow | null>(null);

  // Drawer action states
  const [trialDays, setTrialDays] = useState("30");
  const [planSelect, setPlanSelect] = useState<string>("starter");
  const [trialExtDate, setTrialExtDate] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/platform/gyms").catch(() => null);
    if (!res?.ok) {
      setError("No se pudo cargar la lista de gyms.");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setGyms(d.gyms ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/start"); return; }
      setAuthorized(true);
      load();
    });
  }, [load, router]);

  const filtered = useMemo(() => {
    let list = [...gyms];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) =>
        (g.gym_name ?? g.company_name).toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.owner_name ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((g) => {
        const st = displayStatus(g).toLowerCase();
        return st === statusFilter;
      });
    }
    list.sort((a, b) => {
      if (sortKey === "active_members") return b.active_members - a.active_members;
      if (sortKey === "last_payment") {
        const da = a.last_payment ? new Date(a.last_payment).getTime() : 0;
        const db = b.last_payment ? new Date(b.last_payment).getTime() : 0;
        return db - da;
      }
      if (sortKey === "company_name") return (a.gym_name ?? a.company_name).localeCompare(b.gym_name ?? b.company_name);
      // trial_expires_at default
      const da = a.trial_expires_at ? new Date(a.trial_expires_at).getTime() : Infinity;
      const db = b.trial_expires_at ? new Date(b.trial_expires_at).getTime() : Infinity;
      return da - db;
    });
    return list;
  }, [gyms, search, statusFilter, sortKey]);

  const openDrawer = (g: GymRow) => {
    setDrawerGym(g);
    setPlanSelect(g.plan_type ?? "starter");
    setTrialExtDate("");
    setWaMsg("");
    setTrialDays("30");
  };

  const closeDrawer = () => setDrawerGym(null);

  const impersonate = async (g: GymRow) => {
    if (!g.auth_user_id) { brandAlert("Esta cuenta no tiene usuario registrado."); return; }
    if (!g.gym_id) { brandAlert("No se encontró un gym asociado."); return; }
    setNavigating(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: g.gym_id }),
      });
      const payload = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!res.ok || !payload?.token) {
        brandAlert(payload?.error ?? "No se pudo iniciar impersonation.");
        return;
      }
      invalidateProfile();
      window.location.href = `/api/platform/impersonate/enter?token=${encodeURIComponent(payload.token)}`;
    } finally {
      setNavigating(false);
    }
  };

  const extendTrial = async () => {
    if (!drawerGym) return;
    const days = Number(trialDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      brandAlert("Ingresá un número de días entre 1 y 365.");
      return;
    }
    setSaving("trial");
    const newEnd = new Date(Date.now() + days * 86_400_000).toISOString();
    const res = await fetch("/api/platform/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drawerGym.id, status: "trial_active", trial_ends_at: newEnd }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) { brandAlert("No se pudo extender el trial."); return; }
    brandAlert(`Trial extendido ${days} días.`);
    setGyms((prev) => prev.map((g) => g.id === drawerGym.id ? { ...g, trial_ends_at: newEnd, crm_status: "trial_active" } : g));
    setDrawerGym((prev) => prev ? { ...prev, trial_ends_at: newEnd, crm_status: "trial_active" } : prev);
  };

  const toggleSubscription = async () => {
    if (!drawerGym?.gym_id) { brandAlert("Este gym no tiene gimnasio creado todavía."); return; }
    const next = !drawerGym.is_subscription_active;
    const ok = await confirm({
      title: next ? "¿Activar suscripción?" : "¿Desactivar suscripción?",
      message: next
        ? `Se activará el acceso de ${drawerGym.gym_name ?? drawerGym.company_name}.`
        : `Se cancelará el acceso de ${drawerGym.gym_name ?? drawerGym.company_name}. El gym quedará bloqueado.`,
      confirmLabel: next ? "Activar" : "Desactivar",
      variant: next ? "default" : "danger",
    });
    if (!ok) return;
    setSaving("subscription");
    const res = await fetch(`/api/platform/gyms/${drawerGym.gym_id}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) { brandAlert("No se pudo cambiar la suscripción."); return; }
    const newStatus = next ? "active" : "cancelled";
    setGyms((prev) => prev.map((g) => g.id === drawerGym.id ? { ...g, is_subscription_active: next, gym_status: newStatus } : g));
    setDrawerGym((prev) => prev ? { ...prev, is_subscription_active: next, gym_status: newStatus } : prev);
    brandAlert(`Suscripción ${next ? "activada" : "desactivada"}.`);
  };

  const changePlan = async () => {
    if (!drawerGym?.gym_id) { brandAlert("Este gym no tiene gimnasio creado todavía."); return; }
    const ok = await confirm({
      title: "¿Cambiar plan?",
      message: `Se cambiará el plan de ${drawerGym.gym_name ?? drawerGym.company_name} a "${planSelect}".`,
      confirmLabel: "Cambiar",
      variant: "default",
    });
    if (!ok) return;
    setSaving("plan");
    const body: Record<string, string> = { plan_type: planSelect };
    if (trialExtDate) body.trial_expires_at = new Date(trialExtDate).toISOString();
    const res = await fetch(`/api/platform/gyms/${drawerGym.gym_id}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) { brandAlert("No se pudo cambiar el plan."); return; }
    setGyms((prev) => prev.map((g) => g.id === drawerGym.id ? { ...g, plan_type: planSelect, subscription_plan: planSelect, trial_expires_at: trialExtDate ? new Date(trialExtDate).toISOString() : g.trial_expires_at } : g));
    setDrawerGym((prev) => prev ? { ...prev, plan_type: planSelect, subscription_plan: planSelect } : prev);
    brandAlert("Plan actualizado.");
  };

  const sendWa = async () => {
    if (!drawerGym) return;
    const phone = drawerGym.whatsapp ?? drawerGym.phone;
    if (!phone) { brandAlert("Este gym no tiene número de WhatsApp configurado."); return; }
    if (!waMsg.trim()) { brandAlert("Escribí un mensaje antes de enviar."); return; }
    setSaving("wa");
    const res = await fetch("/api/platform/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-wa",
        account_id: drawerGym.id,
        phone,
        template_key: "manual-gyms",
        template_body: waMsg,
        nombre: drawerGym.owner_name ?? drawerGym.company_name,
      }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      brandAlert(d?.error ?? "No se pudo enviar el mensaje.");
      return;
    }
    setWaMsg("");
    brandAlert("Mensaje enviado.");
  };

  if (!authorized && !loading) return null;

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.10)",
    font: `400 0.82rem/1 ${fd}`,
    background: "rgba(255,255,255,0.8)",
    color: "#111827",
    outline: "none",
  };

  const btnStyle = (variant: "primary" | "ghost" | "danger" = "primary"): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
    font: `600 0.78rem/1 ${fd}`,
    ...(variant === "primary"  ? { background: "#6366f1", color: "#fff" } : {}),
    ...(variant === "ghost"    ? { background: "rgba(0,0,0,0.05)", color: "#374151" } : {}),
    ...(variant === "danger"   ? { background: "rgba(220,38,38,0.10)", color: "#B91C1C" } : {}),
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5", fontFamily: fd }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ font: `700 1.3rem/1 ${fd}`, color: "#111827", margin: 0 }}>Gyms</h1>
            <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: "#6B7280", margin: "4px 0 0" }}>
              {loading ? "Cargando…" : `${filtered.length} de ${gyms.length} gyms`}
            </p>
          </div>
          <button onClick={load} style={btnStyle("ghost")} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Actualizar
          </button>
        </div>

        <div style={{ ...shellCard, overflow: "hidden" }}>
          {/* Filters */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email, dueño…"
                style={{ ...inputStyle, width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={inputStyle}>
              <option value="all">Todos los estados</option>
              <option value="trial">Trial</option>
              <option value="active">Activo</option>
              <option value="trial_risk">Trial Risk</option>
              <option value="trial_expired">Trial Expirado</option>
              <option value="cancelled">Cancelado</option>
              <option value="churned">Churned</option>
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={inputStyle}>
              <option value="trial_expires_at">Ordenar: Vencimiento</option>
              <option value="last_payment">Ordenar: Último pago</option>
              <option value="active_members">Ordenar: Alumnos</option>
              <option value="company_name">Ordenar: Nombre</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", font: `400 0.88rem/1 ${fd}` }}>
              Cargando gyms…
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#B91C1C", font: `400 0.88rem/1 ${fd}` }}>
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", font: `400 0.88rem/1 ${fd}` }}>
              No se encontraron gyms.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {["Gym", "Estado", "Plan", "Vencimiento", "Alumnos", "Último pago", "WA", ""].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left",
                        font: `600 0.72rem/1 ${fd}`, color: "#6B7280",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g, i) => {
                    const status = displayStatus(g);
                    const days = daysUntil(g.trial_expires_at);
                    const daysColor = days === null ? "#9CA3AF" : days <= 3 ? "#B91C1C" : days <= 7 ? "#A16207" : "#374151";
                    return (
                      <tr
                        key={g.id}
                        onClick={() => openDrawer(g)}
                        style={{
                          borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ font: `600 0.85rem/1 ${fd}`, color: "#111827" }}>
                            {g.gym_name ?? g.company_name}
                          </div>
                          {g.owner_name && (
                            <div style={{ font: `400 0.76rem/1 ${fd}`, color: "#9CA3AF", marginTop: 2 }}>
                              {g.owner_name}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <StatusBadge status={status} />
                        </td>
                        <td style={{ padding: "12px 16px", font: `500 0.82rem/1 ${fd}`, color: "#374151" }}>
                          {g.plan_type ?? g.subscription_plan ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {days === null ? (
                            <span style={{ font: `400 0.82rem/1 ${fd}`, color: "#9CA3AF" }}>—</span>
                          ) : (
                            <span style={{ font: `500 0.82rem/1 ${fd}`, color: daysColor }}>
                              {days > 0 ? `${days}d` : "Vencido"}
                            </span>
                          )}
                          {g.trial_expires_at && (
                            <div style={{ font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF", marginTop: 2 }}>
                              {fmtDate(g.trial_expires_at)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", font: `600 0.85rem/1 ${fd}`, color: "#111827" }}>
                          {g.active_members}
                        </td>
                        <td style={{ padding: "12px 16px", font: `400 0.82rem/1 ${fd}`, color: "#6B7280" }}>
                          {fmtDate(g.last_payment)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <WaBadge status={g.wa_status} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <ChevronRight size={15} style={{ color: "#9CA3AF" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drawer */}
      {drawerGym && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(15,23,42,0.35)",
              backdropFilter: "blur(2px)",
            }}
          />
          {/* Panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
            width: "min(480px, 100vw)",
            background: "#fff",
            boxShadow: "-8px 0 40px rgba(15,23,42,0.14)",
            overflowY: "auto",
            display: "flex", flexDirection: "column",
          }}>
            {/* Drawer header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Building2 size={16} color="#6366f1" />
                  <span style={{ font: `700 1rem/1 ${fd}`, color: "#111827" }}>
                    {drawerGym.gym_name ?? drawerGym.company_name}
                  </span>
                  <StatusBadge status={displayStatus(drawerGym)} />
                </div>
                {drawerGym.slug && (
                  <div style={{ font: `400 0.76rem/1 ${fd}`, color: "#9CA3AF", marginTop: 4 }}>
                    fitgrowx.com/{drawerGym.slug}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => impersonate(drawerGym)}
                  disabled={navigating}
                  style={btnStyle("ghost")}
                  title="Ver como gym"
                >
                  <ExternalLink size={13} />
                  {navigating ? "…" : "Ver gym"}
                </button>
                <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Info */}
              <Section title="Información">
                <Row label="Dueño"    value={drawerGym.owner_name ?? "—"} />
                <Row label="Email"    value={drawerGym.email ?? "—"} />
                <Row label="Teléfono" value={drawerGym.phone ?? "—"} />
                <Row label="WhatsApp" value={drawerGym.whatsapp ?? "—"} />
                <Row label="Score"    value={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Activity size={12} style={{ color: "#6366f1" }} />
                    {drawerGym.activation_score ?? 0}/100
                  </span>
                } />
                <Row label="T&C"      value={drawerGym.tc_accepted_at ? `Aceptado ${fmtDate(drawerGym.tc_accepted_at)}` : "No aceptado"} />
              </Section>

              {/* Billing */}
              <Section title="Billing">
                <Row label="Plan"          value={drawerGym.plan_type ?? drawerGym.subscription_plan ?? "—"} />
                <Row label="Estado gym"    value={<StatusBadge status={drawerGym.gym_status ?? "—"} />} />
                <Row label="Suscripción"   value={drawerGym.is_subscription_active ? "Activa" : "Inactiva"} />
                <Row label="Vence trial"   value={drawerGym.trial_expires_at ? `${fmtDate(drawerGym.trial_expires_at)} (${daysUntil(drawerGym.trial_expires_at)}d)` : "—"} />
                <Row label="Último pago"   value={fmtDate(drawerGym.last_payment)} />
                <Row label="MRR"           value={fmtMoney(drawerGym.monthly_value)} />
                <Row label="Sub. expira"   value={fmtDate(drawerGym.subscription_expires_at)} />
              </Section>

              {/* Stats */}
              <Section title="Stats">
                <Row label="Alumnos activos" value={String(drawerGym.active_members)} />
                <Row label="Último contacto" value={fmtDate(drawerGym.last_contact_at)} />
                <Row label="Último acceso"   value={fmtDate(drawerGym.last_seen_at)} />
              </Section>

              {/* Actions */}
              <Section title="Acciones">

                {/* Extend trial */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ font: `500 0.78rem/1 ${fd}`, color: "#374151" }}>Extender trial</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={trialDays}
                      onChange={(e) => setTrialDays(e.target.value)}
                      style={{ ...inputStyle, width: 80 }}
                      placeholder="días"
                    />
                    <button onClick={extendTrial} disabled={saving === "trial"} style={btnStyle("primary")}>
                      {saving === "trial" ? "…" : "Extender"}
                    </button>
                  </div>
                </div>

                {/* Toggle subscription */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ font: `500 0.82rem/1 ${fd}`, color: "#374151" }}>
                    Suscripción {drawerGym.is_subscription_active ? "activa" : "inactiva"}
                  </span>
                  <button
                    onClick={toggleSubscription}
                    disabled={saving === "subscription" || !drawerGym.gym_id}
                    style={{ background: "none", border: "none", cursor: "pointer", color: drawerGym.is_subscription_active ? "#15803D" : "#9CA3AF", padding: 4 }}
                  >
                    {drawerGym.is_subscription_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                {/* Change plan */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12 }}>
                  <label style={{ font: `500 0.78rem/1 ${fd}`, color: "#374151" }}>Cambiar plan</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={planSelect} onChange={(e) => setPlanSelect(e.target.value)} style={inputStyle}>
                      <option value="trial">Trial</option>
                      <option value="starter">Starter</option>
                      <option value="crecimiento">Crecimiento</option>
                    </select>
                    <input
                      type="date"
                      value={trialExtDate}
                      onChange={(e) => setTrialExtDate(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Vencimiento (opcional)"
                    />
                    <button onClick={changePlan} disabled={saving === "plan" || !drawerGym.gym_id} style={btnStyle("primary")}>
                      {saving === "plan" ? "…" : "Aplicar"}
                    </button>
                  </div>
                </div>

                {/* Send WhatsApp */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12 }}>
                  <label style={{ font: `500 0.78rem/1 ${fd}`, color: "#374151" }}>Enviar WhatsApp manual</label>
                  <textarea
                    value={waMsg}
                    onChange={(e) => setWaMsg(e.target.value)}
                    rows={3}
                    maxLength={1500}
                    placeholder="Escribí el mensaje…"
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ font: `400 0.72rem/1 ${fd}`, color: "#9CA3AF" }}>{waMsg.length}/1500</span>
                    <button onClick={sendWa} disabled={saving === "wa"} style={btnStyle("primary")}>
                      <Send size={13} />
                      {saving === "wa" ? "Enviando…" : "Enviar WA"}
                    </button>
                  </div>
                </div>

              </Section>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ font: `700 0.72rem/1 'Inter', sans-serif`, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ font: `400 0.80rem/1 'Inter', sans-serif`, color: "#6B7280", flexShrink: 0 }}>{label}</span>
      <span style={{ font: `500 0.82rem/1 'Inter', sans-serif`, color: "#111827", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
