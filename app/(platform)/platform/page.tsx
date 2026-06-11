"use client";

import { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock3,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { invalidateProfile } from "@/lib/gym-cache";
import { useBrandConfirm } from "@/components/brand-confirm";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";

type PlatformStats = {
  platformAccounts: number;
  platformLeads: number;
};

type PlatformAccount = {
  id: string;
  auth_user_id: string | null;
  company_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  subscription_plan: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  converted_at: string | null;
  activation_score: number | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type PlatformLead = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  gym_id: string;
  gym_name: string | null;
  email: string | null;
  message: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type AccountStatus = "trial_setup" | "trial_active" | "trial_risk" | "converted" | "churned";
type LeadStatus = "new" | "contacted" | "qualified" | "registered" | "lost";

const shellCard: React.CSSProperties = {
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 28,
  boxShadow:
    "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
};

function getErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  ) {
    return (value as { message: string }).message;
  }
  return "No se pudo cargar el panel de plataforma.";
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (["converted", "registered", "published"].includes(key)) {
    return { bg: "rgba(22,163,74,0.10)", color: "#15803D" };
  }
  if (["trial_active", "contacted", "qualified", "draft"].includes(key)) {
    return { bg: "rgba(37,99,235,0.10)", color: "#2563EB" };
  }
  if (["trial_setup", "new", "open"].includes(key)) {
    return { bg: "rgba(249,115,22,0.10)", color: "#C2410C" };
  }
  if (["trial_risk", "archived"].includes(key)) {
    return { bg: "rgba(234,179,8,0.14)", color: "#A16207" };
  }
  if (["churned"].includes(key)) {
    return { bg: "rgba(100,116,139,0.12)", color: "#475569" };
  }
  return { bg: "rgba(220,38,38,0.10)", color: "#B91C1C" };
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "sin fecha";
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function activationTone(score: number) {
  if (score >= 70) {
    return { bg: "rgba(22,163,74,0.10)", color: "#15803D", label: "Buen uso" };
  }
  if (score >= 40) {
    return { bg: "rgba(37,99,235,0.10)", color: "#2563EB", label: "Activando" };
  }
  if (score >= 20) {
    return { bg: "rgba(249,115,22,0.10)", color: "#C2410C", label: "Temprano" };
  }
  return { bg: "rgba(220,38,38,0.10)", color: "#B91C1C", label: "Bajo uso" };
}

function activationHint(account: PlatformAccount) {
  const score = account.activation_score ?? 0;
  const daysLeft = daysUntil(account.trial_ends_at);

  if (account.status === "converted") {
    return "Ya convirtió a pago. Enfócate en expansión y retención.";
  }
  if (account.status === "trial_risk") {
    return "Necesita seguimiento manual: el trial está cerca de vencer y todavía no vio suficiente valor.";
  }
  if (score >= 70) {
    return "Ya activó varias piezas clave del producto. Es buen momento para empujar conversión.";
  }
  if (score >= 40) {
    return "Va bien encaminado. Conviene reforzar membresías, clases o carga de alumnos para cerrar valor.";
  }
  if (daysLeft !== null && daysLeft <= 5) {
    return "Está con poco uso y el trial se está acabando. Priorízalo en seguimiento.";
  }
  return "Todavía está en setup inicial. Hay que llevarlo rápido a su primer resultado visible.";
}

function emptyState(title: string, body: string) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: "1px dashed rgba(148,163,184,0.28)",
        padding: 22,
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <p style={{ marginBottom: 8, font: `700 0.92rem/1 ${fd}`, color: "#111827" }}>{title}</p>
      <p style={{ font: `400 0.88rem/1.65 ${fb}`, color: "#64748B" }}>{body}</p>
    </div>
  );
}

function PlatformPage() {
  const router = useRouter();
  const confirm = useBrandConfirm();
  const [navigatingToGymId, setNavigatingToGymId] = useState<string | null>(null);
  const [tplDropdownId,  setTplDropdownId]  = useState<string | null>(null);
  const [crmSendingId,   setCrmSendingId]   = useState<string | null>(null);
  const [crmSentId,      setCrmSentId]      = useState<string | null>(null);
  const [followupId,     setFollowupId]     = useState<string | null>(null);
  const [followupDays,   setFollowupDays]   = useState("3");
  const [contactingId,   setContactingId]   = useState<string | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [deleteModal,    setDeleteModal]    = useState<{ id: string; company_name: string; auth_user_id: string | null } | null>(null);
  const [confirmText,    setConfirmText]    = useState("");
  const PERMANENT_DELETE_PHRASE = "CONFIRMAR_BORRADO_PERMANENTE";
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"crm" | "feedback" | "onboarding">("crm");
  const [onboardingRows, setOnboardingRows] = useState<{ gym_id: string; gym_name: string | null; onboarding_completed: boolean | null; setup_alumnos: boolean | null; setup_planes: boolean | null; setup_landing: boolean | null; setup_whatsapp: boolean | null; setup_pagos: boolean | null }[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    platformAccounts: 0,
    platformLeads: 0,
  });
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [leads, setLeads] = useState<PlatformLead[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<"pendientes" | "todos">("pendientes");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSearchDebounced, setCrmSearchDebounced] = useState("");
  const crmSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [crmFilter, setCrmFilter] = useState<"todos" | "leads" | "trial" | "riesgo" | "convertido" | "churn">("todos");
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Templates for CRM send dropdown (loaded from DB on mount)
  const DEFAULT_TEMPLATES = {
    bienvenida:    "¡Hola {nombre}! 🎉 Bienvenido a FitGrowX. Tu gym ya está listo para escalar. Si tenés alguna duda, respondé este mensaje.",
    activacion_d3: "Ey {nombre}! Eli de FitGrowX 👋 ¿Pudiste arrancar a cargar tus alumnos? Si querés te muestro cómo hacerlo en 5 minutos, es más fácil de lo que parece.",
    trial_vence:   "¡Hola {nombre}! ⏰ Tu período de prueba de FitGrowX vence en {dias} días. ¿Querés seguir creciendo? Hablemos para activar tu plan.",
    trial_expirado:"Hola {nombre}! Tu prueba de FitGrowX venció hoy. Tus datos siguen guardados. Si querés seguir usándolo, hablemos ahora y lo resolvemos 🙌",
    primer_pago:   "🎉 {nombre}, tu gym acaba de recibir su primer pago en FitGrowX. Así se empieza a escalar. Cualquier cosa estamos acá.",
    inactivo_7d:   "Ey {nombre}! Eli de FitGrowX. ¿Cómo va el gym? ¿Pudieron arrancar a usar el sistema o todavía están poniéndolo a punto? Cualquier cosa me avisás 🙌",
    reactivacion:  "¡Hola {nombre}! 👋 Hace un tiempo que no te vemos por FitGrowX. ¿Todo bien con el gym? Estamos acá para ayudarte.",
  };
  const [platMsgTemplate, setPlatMsgTemplate] = useState(DEFAULT_TEMPLATES);

  type OverviewData = {
    sistema: { erroresH1: number; waDesconectados: number };
    negocio: { mrrMes: number; gymsActivos: number; conversionesMes: number; churnCount: number; churnRatePct: number; trialToPaidRate: number };
    atencion: { trialsRisk: number; trialsRiskList: { id: string; company_name: string; trial_ends_at: string }[]; inactivos7d: number; prospectosSinSeg: number; feedbackReciente7d: number };
  };
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const lastFetchRef = useRef<number>(0);
  const CACHE_TTL = 60_000;

  const fetchPlatformData = useCallback(async () => {
    const [
      { count: platformAccountsCount, error: accountsCountError },
      { count: platformLeadsCount, error: leadsCountError },
      { data: accountRows, error: accountRowsError },
      { data: leadRows, error: leadRowsError },
    ] = await Promise.all([
      supabase.from("platform_accounts").select("*", { count: "exact", head: true }),
      supabase.from("platform_leads").select("*", { count: "exact", head: true }),
      supabase.from("platform_accounts").select("id,auth_user_id,company_name,owner_name,email,phone,status,subscription_plan,trial_ends_at,activation_score,next_follow_up_at,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("platform_leads").select("id,full_name,business_name,phone,status,source,next_follow_up_at,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    if (accountsCountError) throw accountsCountError;
    if (leadsCountError) throw leadsCountError;
    if (accountRowsError) throw accountRowsError;
    if (leadRowsError) throw leadRowsError;

    setStats({
      platformAccounts: platformAccountsCount ?? 0,
      platformLeads: platformLeadsCount ?? 0,
    });
    setAccounts((accountRows ?? []) as PlatformAccount[]);
    setLeads((leadRows ?? []) as PlatformLead[]);

    fetchNonCriticalData();
  }, []);

  const fetchNonCriticalData = async () => {
    const [
      { data: feedbackData },
      { data: onboardingData },
    ] = await Promise.all([
      supabase.from("platform_feedback").select("id, gym_id, gym_name, email, message, created_at, resolved_at, resolved_by").order("created_at", { ascending: false }).limit(100),
      supabase.from("gym_settings").select("gym_id, gym_name, onboarding_completed, setup_alumnos, setup_planes, setup_landing, setup_whatsapp, setup_pagos").order("gym_name", { ascending: true }),
    ]);

    setFeedbackRows((feedbackData ?? []) as FeedbackRow[]);
    setOnboardingRows((onboardingData ?? []) as { gym_id: string; gym_name: string | null; onboarding_completed: boolean | null; setup_alumnos: boolean | null; setup_planes: boolean | null; setup_landing: boolean | null; setup_whatsapp: boolean | null; setup_pagos: boolean | null }[]);
  };

  // Close template dropdown on outside click
  useEffect(() => {
    if (!tplDropdownId) return;
    const handler = () => setTplDropdownId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [tplDropdownId]);

  // Debounce CRM search
  useEffect(() => {
    if (crmSearchTimerRef.current) clearTimeout(crmSearchTimerRef.current);
    crmSearchTimerRef.current = setTimeout(() => {
      setCrmSearchDebounced(crmSearch);
    }, 500);
    return () => {
      if (crmSearchTimerRef.current) clearTimeout(crmSearchTimerRef.current);
    };
  }, [crmSearch]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          if (active) {
            setError("Necesitas iniciar sesión para entrar al panel de plataforma.");
            setLoading(false);
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .limit(1)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new Error("No se encontró tu perfil en la tabla profiles.");
        if (profile.role !== "platform_owner") {
          if (active) {
            setError("Tu usuario no tiene acceso al panel de plataforma. Asignale el rol platform_owner.");
            setLoading(false);
          }
          return;
        }

        if (active) setAuthorized(true);
        await fetchPlatformData();

        if (active) {
          setLoading(false);
        }
      } catch (caughtError) {
        if (active) {
          setError(getErrorMessage(caughtError));
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchOverview = async () => {
      const r = await fetch("/api/platform/overview").catch(() => null);
      if (r?.ok && mounted) setOverview(await r.json());
    };
    fetchOverview();
    const t = setInterval(fetchOverview, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Load saved templates for the CRM send dropdown
  useEffect(() => {
    fetch("/api/platform/wa-templates")
      .then(r => r.ok ? r.json() : null)
      .then((dbTpl: Record<string, { body: string; enabled: boolean }> | null) => {
        if (!dbTpl || !Object.keys(dbTpl).length) return;
        const bodies: Record<string, string> = {};
        for (const [k, v] of Object.entries(dbTpl)) bodies[k] = v.body;
        setPlatMsgTemplate(prev => ({ ...prev, ...bodies }));
      })
      .catch(() => {});
  }, []);

  const crmHealth = useMemo(() => {
    const convertedClients = accounts.filter((account) => account.status === "converted").length;
    const trialClients = accounts.filter((account) =>
      ["trial_setup", "trial_active", "trial_risk"].includes(account.status),
    ).length;
    const expiringTrials = accounts.filter((account) => {
      if (!["trial_setup", "trial_active", "trial_risk"].includes(account.status)) return false;
      const remaining = daysUntil(account.trial_ends_at);
      return remaining !== null && remaining >= 0 && remaining <= 5;
    }).length;
    const newLeads = leads.filter((lead) => lead.status === "new").length;
    return { convertedClients, trialClients, expiringTrials, newLeads };
  }, [accounts, leads]);

  const filteredAccounts = useMemo(() => {
    const term = crmSearchDebounced.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) =>
      [account.company_name, account.owner_name, account.subscription_plan, account.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [accounts, crmSearchDebounced]);

  const filteredLeads = useMemo(() => {
    const term = crmSearchDebounced.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) =>
      [lead.business_name, lead.full_name, lead.source, lead.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [leads, crmSearchDebounced]);

  const resetFeedbackSoon = useCallback(() => {
    window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  const openGymDashboard = useCallback(async (account: PlatformAccount) => {
    if (!account.auth_user_id) {
      setFeedback("Esta cuenta no tiene usuario registrado todavía.");
      resetFeedbackSoon();
      return;
    }
    setNavigatingToGymId(account.id);
    try {
      const { data } = await supabase.from("profiles").select("id,gym_id").eq("id", account.auth_user_id).single();
      if (!data?.gym_id) {
        setNavigatingToGymId(null);
        setFeedback("No se encontró un gym asociado a esta cuenta.");
        resetFeedbackSoon();
        return;
      }
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: data.gym_id }),
      });
      const payload = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!res.ok || !payload?.token) {
        throw new Error(payload?.error ?? "No se pudo iniciar impersonation.");
      }
      invalidateProfile();
      window.location.href = `/api/platform/impersonate/enter?token=${encodeURIComponent(payload.token)}`;
    } catch {
      setNavigatingToGymId(null);
      setFeedback("Error al abrir el dashboard.");
      resetFeedbackSoon();
    }
  }, [resetFeedbackSoon, supabase]);

  const updateAccountStatus = useCallback(async (id: string, status: AccountStatus) => {
    try {
      setUpdatingAccountId(id);
      const res = await fetch("/api/platform/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al actualizar."); }
      await fetchPlatformData();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
      resetFeedbackSoon();
    } finally {
      setUpdatingAccountId(null);
    }
  }, [fetchPlatformData, resetFeedbackSoon]);

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus) => {
    try {
      setUpdatingLeadId(id);
      const res = await fetch("/api/platform/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al actualizar."); }
      await fetchPlatformData();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
      resetFeedbackSoon();
    } finally {
      setUpdatingLeadId(null);
    }
  }, [fetchPlatformData, resetFeedbackSoon]);

  const sendCrmWa = useCallback(async (account: PlatformAccount, templateKey: string, templateBody: string) => {
    if (!account.phone) return;
    const sendId = `${account.id}:${templateKey}`;
    setCrmSendingId(sendId);
    setCrmSentId(null);
    try {
      const res = await fetch("/api/platform/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send-wa",
          account_id: account.id,
          phone: account.phone,
          template_key: templateKey,
          template_body: templateBody,
          nombre: account.owner_name?.split(" ")[0] ?? account.company_name,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al enviar."); }
      setCrmSentId(account.id);
      setTplDropdownId(null);
      setTimeout(() => setCrmSentId(null), 3000);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "No se pudo enviar.");
      resetFeedbackSoon();
    } finally {
      setCrmSendingId(null);
    }
  }, [resetFeedbackSoon]);

  const markContacted = useCallback(async (accountId?: string, leadId?: string) => {
    setContactingId(accountId ?? leadId ?? null);
    try {
      const res = await fetch("/api/platform/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-contacted", account_id: accountId, lead_id: leadId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error."); }
      await fetchPlatformData();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Error al marcar contactado.");
      resetFeedbackSoon();
    } finally {
      setContactingId(null);
    }
  }, [fetchPlatformData, resetFeedbackSoon]);

  const saveFollowup = useCallback(async (accountId: string) => {
    const days = parseInt(followupDays, 10);
    if (!days || days < 1) return;
    try {
      const res = await fetch("/api/platform/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-followup", account_id: accountId, days }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error."); }
      setFollowupId(null);
      await fetchPlatformData();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Error al guardar seguimiento.");
      resetFeedbackSoon();
    }
  }, [fetchPlatformData, resetFeedbackSoon, followupDays]);

  const deleteAccount = useCallback(async (id: string, name: string, permanent: boolean) => {
    setDeleteModal(null);
    setConfirmText("");
    setDeletingId(id);
    try {
      const url = `/api/platform/accounts?id=${id}${permanent ? "&permanent=true" : ""}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(permanent ? {} : { "Content-Length": "2" }) },
        body: permanent ? JSON.stringify({ confirm_delete: PERMANENT_DELETE_PHRASE }) : "{}",
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error."); }
      setAccounts(prev => prev.filter(a => a.id !== id));
      setStats(prev => ({ ...prev, platformAccounts: Math.max(0, prev.platformAccounts - 1) }));
      await fetchPlatformData();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Error al eliminar.");
      resetFeedbackSoon();
    } finally {
      setDeletingId(null);
    }
  }, [fetchPlatformData, resetFeedbackSoon]);

  const deleteLead = useCallback(async (id: string, name: string) => {
    if (!await confirm({
      eyebrow: "Eliminar lead",
      title: `¿Eliminar el lead "${name}"?`,
      message: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      variant: "danger",
    })) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/platform/leads?id=${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error."); }
      setLeads(prev => prev.filter(l => l.id !== id));
      setStats(prev => ({ ...prev, platformLeads: Math.max(0, prev.platformLeads - 1) }));
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Error al eliminar.");
      resetFeedbackSoon();
    } finally {
      setDeletingId(null);
    }
  }, [confirm, resetFeedbackSoon]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { key: "crm", label: "Clientes" },
          { key: "feedback", label: "Feedback" },
          { key: "onboarding", label: "Onboarding" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as "crm" | "feedback" | "onboarding")}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: activeTab === tab.key ? "1.5px solid #111827" : "1px solid rgba(15,23,42,0.10)",
              background: activeTab === tab.key ? "#111827" : "rgba(255,255,255,0.68)",
              color: activeTab === tab.key ? "#FFFFFF" : "#475569",
              font: `600 0.75rem/1 ${fd}`,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview strip — solo en el tab CRM (dash principal) ── */}
      {activeTab === "crm" && overview && (() => {
        const { sistema, negocio, atencion } = overview;
        const sysAlert = sistema.erroresH1 > 0 || sistema.waDesconectados > 0;
        const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;
        const alertItems = [
          atencion.trialsRisk > 0     && { label: `${atencion.trialsRisk} trial${atencion.trialsRisk > 1 ? "s" : ""} en riesgo`, color: "#DC2626", bg: "rgba(220,38,38,0.08)", href: "/platform/pulso" },
          atencion.inactivos7d > 0    && { label: `${atencion.inactivos7d} inactivo${atencion.inactivos7d > 1 ? "s" : ""} 7d+`, color: "#D97706", bg: "rgba(217,119,6,0.08)", href: "/platform/pulso" },
          atencion.prospectosSinSeg > 0 && { label: `${atencion.prospectosSinSeg} prosp. sin seguimiento`, color: "#7C3AED", bg: "rgba(124,58,237,0.08)", href: "/platform" },
          atencion.feedbackReciente7d > 0 && { label: `${atencion.feedbackReciente7d} feedback esta semana`, color: "#0284C7", bg: "rgba(2,132,199,0.08)", href: "/platform" },
        ].filter(Boolean) as { label: string; color: string; bg: string; href: string }[];

        return (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", marginBottom: 20, padding: "14px 20px", borderRadius: 18, background: sysAlert ? "rgba(220,38,38,0.04)" : "rgba(248,250,252,0.9)", border: `1px solid ${sysAlert ? "rgba(220,38,38,0.14)" : "rgba(15,23,42,0.07)"}` }}>
            {/* Sistema */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sysAlert ? "#DC2626" : "#16A34A", flexShrink: 0, boxShadow: sysAlert ? "0 0 6px rgba(220,38,38,0.5)" : "none" }} />
              <span style={{ font: `600 0.72rem/1 ${fd}`, color: sysAlert ? "#DC2626" : "#15803D", whiteSpace: "nowrap" }}>
                {sysAlert
                  ? [sistema.erroresH1 > 0 && `${sistema.erroresH1} err/h`, sistema.waDesconectados > 0 && `${sistema.waDesconectados} WA off`].filter(Boolean).join(" · ")
                  : "Sistema OK"}
              </span>
              {sysAlert && (
                <a href="/platform/radar" style={{ font: `500 0.68rem/1 ${fd}`, color: "#6B7280", textDecoration: "none", padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.04)" }}>ver →</a>
              )}
            </div>

            {/* Negocio */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              {[
                { label: "MRR mes", value: fmt(negocio.mrrMes), sub: null, tooltip: "Valor contractual mensual de gyms activos (plan × cantidad)" as string | undefined },
                { label: "Activos", value: String(negocio.gymsActivos), sub: null, tooltip: undefined },
                { label: "Conv. mes", value: String(negocio.conversionesMes), sub: null, tooltip: undefined },
                { label: "Churn mes", value: String(negocio.churnCount ?? 0), sub: negocio.churnRatePct != null ? `${negocio.churnRatePct}%` : null, tooltip: undefined },
                { label: "Trial→Pago", value: negocio.trialToPaidRate != null ? `${negocio.trialToPaidRate}%` : "—", sub: null, tooltip: undefined },
              ].map((item) => (
                <div key={item.label} title={item.tooltip} style={{ textAlign: "center" }}>
                  <p style={{ font: `700 1.1rem/1 ${fd}`, color: "#111827", letterSpacing: "-0.03em" }}>{item.value}</p>
                  {item.sub && <p style={{ font: `500 0.58rem/1 ${fd}`, color: "#6b7280", marginTop: 1 }}>{item.sub}</p>}
                  <p style={{ font: `500 0.6rem/1 ${fd}`, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Atención */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {alertItems.length === 0
                ? <span style={{ font: `500 0.7rem/1 ${fd}`, color: "#9CA3AF" }}>Sin alertas</span>
                : alertItems.map((a, i) => (
                    <a key={i} href={a.href} style={{ textDecoration: "none", font: `600 0.68rem/1 ${fd}`, color: a.color, background: a.bg, padding: "4px 10px", borderRadius: 9999, whiteSpace: "nowrap" }}>
                      {a.label}
                    </a>
                  ))
              }
            </div>
          </div>
        );
      })()}

      {loading && (
        <div style={{ ...shellCard, padding: 28 }}>
          <p style={{ font: `500 0.95rem/1.6 ${fb}`, color: "#64748B" }}>
            Cargando panel de plataforma...
          </p>
        </div>
      )}

      {!loading && error && (
        <div style={{ ...shellCard, padding: 28 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ShieldAlert size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ marginBottom: 8, font: `700 0.95rem/1 ${fd}`, color: "#111827" }}>
                Acceso no disponible
              </p>
              <p style={{ marginBottom: 10, font: `400 0.92rem/1.6 ${fb}`, color: "#64748B" }}>
                {error}
              </p>
              <p style={{ font: `500 0.85rem/1.6 ${fb}`, color: "#475569" }}>
                Revisa la sesión activa, las tablas nuevas y que tu usuario siga marcado como
                `platform_owner`.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && authorized && !error && (
        <>
          {activeTab === "crm" ? (
            <section style={{ marginBottom: 24 }}>
              <article style={{ ...shellCard, padding: 24 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                  <div>
                    <p style={{ marginBottom: 6, font: `700 0.74rem/1 ${fd}`, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.14em" }}>Clientes FitGrowX</p>
                    <h2 style={{ font: `780 1.35rem/1.1 ${fd}`, color: "#111827", letterSpacing: "-0.03em" }}>Leads, trials y clientes pagos</h2>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "Trials", value: crmHealth.trialClients },
                      { label: "Por vencer", value: crmHealth.expiringTrials },
                      { label: "Convertidos", value: crmHealth.convertedClients },
                      { label: "Leads", value: crmHealth.newLeads },
                    ].map((item) => (
                      <div key={item.label} style={{ borderRadius: 14, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", padding: "8px 12px", minWidth: 80 }}>
                        <p style={{ marginBottom: 3, font: `600 0.7rem/1 ${fb}`, color: "#94A3B8" }}>{item.label}</p>
                        <p style={{ font: `800 1.1rem/1 ${fd}`, color: "#111827" }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(255,255,255,0.95)",
                    padding: "12px 14px",
                    marginBottom: 18,
                  }}
                >
                  <Search size={16} color="#94A3B8" />
                  <input
                    value={crmSearch}
                    onChange={(event) => setCrmSearch(event.target.value)}
                    placeholder="Buscar por empresa, owner, plan, fuente o estado..."
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "#111827",
                      font: `500 0.88rem/1 ${fb}`,
                    }}
                  />
                </div>

                {feedback && (
                  <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.06)", color: "#334155", border: "1px solid rgba(148,163,184,0.18)", padding: "12px 14px", font: `600 0.82rem/1.5 ${fb}`, marginBottom: 18 }}>
                    {feedback}
                  </div>
                )}

                {/* Filter pills */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {([
                    { key: "todos", label: "Todos los clientes" },
                    { key: "leads", label: "Leads" },
                    { key: "trial", label: "En trial" },
                    { key: "riesgo", label: "En riesgo" },
                    { key: "convertido", label: "Convertidos" },
                    { key: "churn", label: "Churn" },
                  ] as const).map(({ key, label }) => (
                    <button key={key} type="button" onClick={() => setCrmFilter(key)} style={{ padding: "7px 14px", borderRadius: 999, border: crmFilter === key ? "1.5px solid #111827" : "1px solid rgba(148,163,184,0.28)", background: crmFilter === key ? "#111827" : "rgba(255,255,255,0.72)", color: crmFilter === key ? "#fff" : "#475569", font: `600 0.78rem/1 ${fd}`, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* CRM table */}
                {(() => {
                  const isLeadView = crmFilter === "leads";

                  const items: Array<{ kind: "account"; data: PlatformAccount } | { kind: "lead"; data: PlatformLead }> = isLeadView
                    ? filteredLeads.map(l => ({ kind: "lead", data: l }))
                    : filteredAccounts
                        .filter(a => {
                          if (crmFilter === "todos") return true;
                          if (crmFilter === "trial") return ["trial_setup", "trial_active"].includes(a.status);
                          if (crmFilter === "riesgo") return a.status === "trial_risk";
                          if (crmFilter === "convertido") return a.status === "converted";
                          if (crmFilter === "churn") return a.status === "churned";
                          return false;
                        })
                        .map(a => ({ kind: "account", data: a }));

                  const statusLabel: Record<string, string> = {
                    trial_setup: "Setup inicial", trial_active: "Trial activo", trial_risk: "En riesgo",
                    converted: "Convertido", churned: "Churn",
                    new: "Nuevo", contacted: "Contactado", qualified: "Calificado", registered: "Registrado", lost: "Perdido",
                  };

                  const colAccount = "minmax(0,2fr) 150px 110px 100px 120px 130px";
                  const colLead    = "minmax(0,2fr) 130px minmax(0,1fr) 120px 130px";
                  const cols = isLeadView ? colLead : colAccount;

                  const headerStyle: React.CSSProperties = { font: `600 0.72rem/1 ${fb}`, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em" };
                  const cellStyle: React.CSSProperties = { display: "flex", alignItems: "center" };

                  if (items.length === 0) {
                    return emptyState(
                      crmSearch ? "Sin coincidencias" : "Sin registros en esta etapa",
                      crmSearch ? "Probá con otro término." : "Cuando se registren desde la landing van a aparecer acá.",
                    );
                  }

                  return (
                    <div>
                      {/* Header row */}
                      <div style={{ display: "grid", gridTemplateColumns: cols, gap: "0 16px", padding: "0 14px 10px", alignItems: "center" }}>
                        <p style={headerStyle}>Gym / Contacto</p>
                        <p style={headerStyle}>Estado</p>
                        {isLeadView ? (
                          <p style={headerStyle}>Fuente</p>
                        ) : (
                          <>
                            <p style={headerStyle}>Vencimiento</p>
                            <p style={headerStyle}>Score</p>
                          </>
                        )}
                        <p style={headerStyle}>Seguimiento</p>
                        <p style={headerStyle}></p>
                      </div>

                      {/* Rows */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.map(item => {
                          if (item.kind === "account") {
                            const a = item.data;
                            const tone = statusTone(a.status);
                            const activation = activationTone(a.activation_score ?? 0);
                            const daysLeft = daysUntil(a.trial_ends_at);
                            const urgent = daysLeft !== null && daysLeft <= 3 && !["converted", "churned"].includes(a.status);
                            const hint = activationHint(a);
                            return (
                              <div key={a.id} style={{ display: "grid", gridTemplateColumns: cols, gap: "0 16px", padding: "14px 14px", borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", alignItems: "center" }}>
                                {/* Gym / owner */}
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ font: `700 0.95rem/1.2 ${fd}`, color: "#111827", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company_name}</p>
                                  <p style={{ font: `400 0.78rem/1 ${fb}`, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.owner_name ?? "—"}{a.phone ? ` · ${a.phone}` : ""}</p>
                                  {a.email && (
                                    <a href={`mailto:${a.email}`} style={{ fontSize: "0.75rem", color: "#6B7280" }}>
                                      {a.email}
                                    </a>
                                  )}
                                  <p style={{ marginTop: 6, font: `500 0.73rem/1.4 ${fb}`, color: "#94A3B8", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{hint}</p>
                                </div>
                                {/* Estado */}
                                <div style={cellStyle}>
                                  <select
                                    value={a.status}
                                    disabled={updatingAccountId === a.id}
                                    onChange={e => updateAccountStatus(a.id, e.target.value as AccountStatus)}
                                    style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${tone.color}22`, background: tone.bg, color: tone.color, padding: "7px 8px", font: `700 0.76rem/1 ${fd}`, cursor: "pointer", appearance: "none", textAlign: "center" }}
                                  >
                                    {["trial_setup", "trial_active", "trial_risk", "converted", "churned"].map(s => (
                                      <option key={s} value={s}>{statusLabel[s] ?? s}</option>
                                    ))}
                                  </select>
                                </div>
                                {/* Vencimiento */}
                                <div style={{ ...cellStyle, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  {["converted", "churned"].includes(a.status) ? (
                                    <span style={{ font: `500 0.78rem/1 ${fb}`, color: "#94A3B8" }}>—</span>
                                  ) : daysLeft === null ? (
                                    <span style={{ font: `500 0.78rem/1 ${fb}`, color: "#94A3B8" }}>Sin fecha</span>
                                  ) : daysLeft < 0 ? (
                                    <span style={{ font: `700 0.78rem/1 ${fd}`, color: "#B91C1C" }}>Expirado</span>
                                  ) : (
                                    <>
                                      <span style={{ font: `700 0.82rem/1 ${fd}`, color: urgent ? "#B91C1C" : "#334155" }}>{daysLeft}d restantes</span>
                                      <span style={{ font: `400 0.72rem/1 ${fb}`, color: "#94A3B8" }}>{formatDate(a.trial_ends_at)}</span>
                                    </>
                                  )}
                                </div>
                                {/* Score */}
                                <div style={{ ...cellStyle, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                                  <span style={{ font: `700 0.82rem/1 ${fd}`, color: activation.color }}>{a.activation_score ?? 0}</span>
                                  <div style={{ width: "100%", height: 4, borderRadius: 999, background: "rgba(148,163,184,0.18)" }}>
                                    <div style={{ width: `${Math.min(a.activation_score ?? 0, 100)}%`, height: "100%", borderRadius: 999, background: activation.color }} />
                                  </div>
                                  <span style={{ font: `500 0.68rem/1 ${fb}`, color: "#94A3B8" }}>{activation.label}</span>
                                </div>
                                {/* Seguimiento */}
                                <div style={{ ...cellStyle, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <Clock3 size={12} color="#94A3B8" />
                                  <span style={{ font: `500 0.76rem/1.3 ${fb}`, color: "#475569" }}>{formatDate(a.next_follow_up_at)}</span>
                                </div>
                                {/* Acciones CRM */}
                                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
                                  {/* Enviar template WA */}
                                  {a.phone ? (
                                    <div style={{ position: "relative" }}>
                                      <button
                                        onClick={() => setTplDropdownId(tplDropdownId === a.id ? null : a.id)}
                                        title="Enviar mensaje"
                                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, background: crmSentId === a.id ? "rgba(34,197,94,0.15)" : "rgba(37,211,102,0.12)", color: crmSentId === a.id ? "#16A34A" : "#16A34A", border: "none", cursor: "pointer", font: `600 0.7rem/1 ${fd}`, whiteSpace: "nowrap" }}
                                      >
                                        {crmSentId === a.id ? <CheckCircle size={13} /> : <Send size={13} />}
                                        {crmSentId === a.id ? "Enviado" : "Enviar"}
                                      </button>
                                      {tplDropdownId === a.id && (
                                        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, marginTop: 4, background: "white", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: "1px solid rgba(0,0,0,0.08)", padding: "6px 0", minWidth: 200 }}>
                                          {Object.entries(platMsgTemplate).map(([key, body]) => {
                                            const sendId = `${a.id}:${key}`;
                                            const isSending = crmSendingId === sendId;
                                            const labels: Record<string, string> = {
                                              bienvenida: "👋 Bienvenida", activacion_d3: "⚡ Activación d3",
                                              trial_vence: "⏰ Trial vence", trial_expirado: "🔴 Trial expirado",
                                              primer_pago: "🎉 Primer pago", inactivo_7d: "😴 Inactivo 7d", reactivacion: "🔄 Reactivación",
                                            };
                                            return (
                                              <button
                                                key={key}
                                                disabled={isSending}
                                                onClick={() => sendCrmWa(a, key, body)}
                                                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: isSending ? "not-allowed" : "pointer", font: `500 0.78rem/1 ${fb}`, color: "#374151", textAlign: "left", opacity: isSending ? 0.6 : 1 }}
                                              >
                                                {isSending ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }} /> : null}
                                                {labels[key] ?? key}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, background: "rgba(148,163,184,0.08)", font: `500 0.7rem/1 ${fd}`, color: "#CBD5E1" }}>
                                      <Phone size={12} /> Sin tel.
                                    </div>
                                  )}
                                  {/* Marcar contactado */}
                                  {!["converted", "churned"].includes(a.status) && (
                                    <button
                                      onClick={() => markContacted(a.id)}
                                      disabled={contactingId === a.id}
                                      title="Marcar como contactado"
                                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(99,102,241,0.10)", color: "#6366f1", border: "none", cursor: "pointer" }}
                                    >
                                      {contactingId === a.id ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <UserCheck size={13} />}
                                    </button>
                                  )}
                                  {/* Ver dashboard */}
                                  <button
                                    onClick={() => openGymDashboard(a)}
                                    disabled={navigatingToGymId === a.id}
                                    title={a.auth_user_id ? "Ver dashboard del gym" : "Sin cuenta registrada"}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: a.auth_user_id ? "rgba(37,99,235,0.10)" : "rgba(148,163,184,0.10)", color: a.auth_user_id ? "#2563EB" : "#94A3B8", border: "none", cursor: a.auth_user_id ? "pointer" : "default", opacity: a.auth_user_id ? 1 : 0.5 }}
                                  >
                                    {navigatingToGymId === a.id ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <ExternalLink size={13} />}
                                  </button>
                                  {/* Eliminar cuenta */}
                                  <button
                                    onClick={() => { setConfirmText(""); setDeleteModal({ id: a.id, company_name: a.company_name, auth_user_id: a.auth_user_id }); }}
                                    disabled={deletingId === a.id}
                                    title="Eliminar cuenta"
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.10)", color: "#EF4444", border: "none", cursor: "pointer" }}
                                  >
                                    {deletingId === a.id ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Trash2 size={13} />}
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          const l = item.data;
                          const tone = statusTone(l.status);
                          return (
                            <div key={l.id} style={{ display: "grid", gridTemplateColumns: cols, gap: "0 16px", padding: "14px 14px", borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", alignItems: "center" }}>
                              {/* Contacto */}
                              <div style={{ minWidth: 0 }}>
                                <p style={{ font: `700 0.95rem/1.2 ${fd}`, color: "#111827", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.business_name ?? l.full_name ?? "Sin nombre"}</p>
                                <p style={{ font: `400 0.78rem/1 ${fb}`, color: "#64748B" }}>{l.full_name ?? "—"}{l.phone ? ` · ${l.phone}` : ""}</p>
                              </div>
                              {/* Estado */}
                              <div style={cellStyle}>
                                <select
                                  value={l.status}
                                  disabled={updatingLeadId === l.id}
                                  onChange={e => updateLeadStatus(l.id, e.target.value as LeadStatus)}
                                  style={{ width: "100%", borderRadius: 10, border: `1.5px solid ${tone.color}22`, background: tone.bg, color: tone.color, padding: "7px 8px", font: `700 0.76rem/1 ${fd}`, cursor: "pointer", appearance: "none", textAlign: "center" }}
                                >
                                  {["new", "contacted", "qualified", "registered", "lost"].map(s => (
                                    <option key={s} value={s}>{statusLabel[s] ?? s}</option>
                                  ))}
                                </select>
                              </div>
                              {/* Fuente */}
                              <div style={{ ...cellStyle, minWidth: 0 }}>
                                <span style={{ font: `500 0.8rem/1 ${fb}`, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.source ?? "—"}</span>
                              </div>
                              {/* Seguimiento */}
                              <div style={{ ...cellStyle, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                <Clock3 size={12} color="#94A3B8" />
                                <span style={{ font: `500 0.76rem/1.3 ${fb}`, color: "#475569" }}>{formatDate(l.next_follow_up_at)}</span>
                              </div>
                              {/* Acciones lead */}
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {l.phone ? (
                                  <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, background: "rgba(37,211,102,0.12)", color: "#16A34A", textDecoration: "none", font: `600 0.7rem/1 ${fd}`, whiteSpace: "nowrap" }}>
                                    <MessageCircle size={13} /> WA
                                  </a>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", borderRadius: 8, background: "rgba(148,163,184,0.08)", font: `500 0.7rem/1 ${fd}`, color: "#CBD5E1" }}>
                                    <Phone size={12} /> Sin tel.
                                  </div>
                                )}
                                {l.status === "new" && (
                                  <button
                                    onClick={() => markContacted(undefined, l.id)}
                                    disabled={contactingId === l.id}
                                    title="Marcar contactado"
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(99,102,241,0.10)", color: "#6366f1", border: "none", cursor: "pointer" }}
                                  >
                                    {contactingId === l.id ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <UserCheck size={13} />}
                                  </button>
                                )}
                                {/* Eliminar lead */}
                                <button
                                  onClick={() => deleteLead(l.id, l.business_name ?? l.full_name ?? "lead")}
                                  disabled={deletingId === l.id}
                                  title="Eliminar lead"
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.10)", color: "#EF4444", border: "none", cursor: "pointer" }}
                                >
                                  {deletingId === l.id ? <Loader2 size={12} style={{ animation: "spin 0.7s linear infinite" }} /> : <Trash2 size={13} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </article>
            </section>
          ) : null}

      {/* ── Feedback tab ── */}
      {!loading && !error && authorized && activeTab === "feedback" && (() => {
        const pending  = feedbackRows.filter(r => !r.resolved_at);
        const resolved = feedbackRows.filter(r => !!r.resolved_at);
        const visible  = feedbackFilter === "pendientes" ? pending : feedbackRows;

        const handleResolve = async (id: string, currentlyResolved: boolean) => {
          setResolvingId(id);
          const r = await fetch("/api/platform/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, resolved: !currentlyResolved }) }).catch(() => null);
          if (r?.ok) {
            setFeedbackRows(prev => prev.map(row => row.id === id ? { ...row, resolved_at: !currentlyResolved ? new Date().toISOString() : null, resolved_by: null } : row));
          }
          setResolvingId(null);
        };

        return (
          <>
            {/* Stats bar */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Sin responder", value: pending.length, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
                { label: "Respondidos",   value: resolved.length, color: "#16A34A", bg: "rgba(22,163,74,0.08)" },
                { label: "Gyms distintos",value: new Set(feedbackRows.map(r => r.gym_id)).size, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
              ].map(stat => (
                <div key={stat.label} style={{ ...shellCard, padding: "20px 22px" }}>
                  <p style={{ margin: "0 0 6px", font: `400 0.78rem/1 ${fb}`, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>{stat.label}</p>
                  <p style={{ margin: 0, font: `700 1.7rem/1 ${fd}`, color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </section>

            {/* Filter + count */}
            <div style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["pendientes", "todos"] as const).map(f => (
                  <button key={f} onClick={() => setFeedbackFilter(f)} style={{ padding: "6px 14px", borderRadius: 9999, border: "1px solid rgba(15,23,42,0.1)", background: feedbackFilter === f ? "#111827" : "#fff", color: feedbackFilter === f ? "#fff" : "#6B7280", font: `600 0.75rem/1 ${fd}`, cursor: "pointer", textTransform: "capitalize" }}>
                    {f === "pendientes" ? `Sin responder (${pending.length})` : `Todos (${feedbackRows.length})`}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              emptyState("Todo respondido", "No hay mensajes pendientes. ¡Bien hecho!")
            ) : (
              <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visible.map(row => {
                  const daysAgo = Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  const relTime = daysAgo === 0 ? "Hoy" : daysAgo === 1 ? "Ayer" : `Hace ${daysAgo} días`;
                  const isResolved = !!row.resolved_at;
                  return (
                    <article key={row.id} style={{ ...shellCard, padding: "0", overflow: "hidden", display: "flex", opacity: isResolved ? 0.55 : 1, transition: "opacity 0.2s" }}>
                      <div style={{ width: 4, flexShrink: 0, background: isResolved ? "#D1D5DB" : "linear-gradient(180deg, #2563EB 0%, #7C3AED 100%)" }} />
                      <div style={{ flex: 1, padding: "18px 22px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(37,99,235,0.09)", font: `600 0.78rem/1 ${fd}`, color: "#2563EB", display: "flex", alignItems: "center", gap: 5 }}>
                              <Building2 size={11} />{row.gym_name ?? row.gym_id}
                            </span>
                            {row.email && <span style={{ font: `400 0.78rem/1 ${fb}`, color: "#9CA3AF" }}>{row.email}</span>}
                            {isResolved && <span style={{ font: `500 0.7rem/1 ${fd}`, color: "#16A34A", background: "rgba(22,163,74,0.08)", padding: "2px 8px", borderRadius: 9999 }}>✓ Respondido</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ font: `400 0.75rem/1 ${fb}`, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}><Clock3 size={11} /> {relTime}</span>
                            {row.email && (
                              <a href={`mailto:${row.email}?subject=Re: tu feedback en FitGrowX`} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", font: `600 0.75rem/1 ${fd}`, color: "#374151", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                                <Send size={10} /> Responder
                              </a>
                            )}
                            <button
                              disabled={resolvingId === row.id}
                              onClick={() => handleResolve(row.id, isResolved)}
                              style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${isResolved ? "rgba(220,38,38,0.2)" : "rgba(22,163,74,0.2)"}`, background: isResolved ? "rgba(220,38,38,0.06)" : "rgba(22,163,74,0.06)", font: `600 0.75rem/1 ${fd}`, color: isResolved ? "#DC2626" : "#16A34A", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <CheckCircle size={10} />{isResolved ? "Desmarcar" : "Marcar respondido"}
                            </button>
                          </div>
                        </div>
                        <p style={{ margin: 0, font: `400 0.9rem/1.7 ${fb}`, color: "#374151", whiteSpace: "pre-wrap" }}>{row.message}</p>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        );
      })()}

      {/* ── Onboarding tab ── */}
      {!loading && !error && authorized && activeTab === "onboarding" && (() => {
        const STEPS = [
          { key: "setup_alumnos",   label: "Alumnos" },
          { key: "setup_planes",    label: "Planes" },
          { key: "setup_landing",   label: "Landing" },
          { key: "setup_whatsapp",  label: "WhatsApp" },
          { key: "setup_pagos",     label: "Pagos" },
        ] as const;

        type ORow = typeof onboardingRows[number];
        const stepsCompleted = (r: ORow) => STEPS.filter(s => r[s.key]).length;

        // Sort: least steps done first (most stuck), then alphabetically
        const sorted = [...onboardingRows].sort((a, b) => {
          const diff = stepsCompleted(a) - stepsCompleted(b);
          return diff !== 0 ? diff : (a.gym_name ?? "").localeCompare(b.gym_name ?? "");
        });

        const done  = onboardingRows.filter(r => r.onboarding_completed).length;
        const total = onboardingRows.length;
        const allStepsDone = onboardingRows.filter(r => stepsCompleted(r) === 5).length;

        return (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total gyms", value: total, color: "#6366F1", bg: "rgba(99,102,241,0.08)" },
                { label: "Todos los pasos listos", value: allStepsDone, color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
                { label: "Con pasos pendientes", value: total - allStepsDone, color: "#F97316", bg: "rgba(249,115,22,0.08)" },
              ].map(s => (
                <div key={s.label} style={{ ...shellCard, padding: "18px 20px", background: s.bg, border: `1px solid ${s.color}20` }}>
                  <p style={{ font: `700 1.6rem/1 ${fd}`, color: s.color, marginBottom: 4 }}>{s.value}</p>
                  <p style={{ font: `500 0.78rem/1 ${fb}`, color: "#64748B" }}>{s.label}</p>
                </div>
              ))}
            </section>
            <section style={{ ...shellCard, padding: "20px 24px" }}>
              <p style={{ font: `700 0.8rem/1 ${fd}`, color: "#111827", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Estado por gym</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map(r => {
                  const n = stepsCompleted(r);
                  const pct = Math.round(n / STEPS.length * 100);
                  const allDone = n === STEPS.length;
                  return (
                    <div key={r.gym_id} style={{ padding: "12px 16px", borderRadius: 12, background: allDone ? "rgba(34,197,94,0.04)" : "rgba(249,115,22,0.04)", border: `1px solid ${allDone ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.12)"}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <p style={{ font: `600 0.88rem/1 ${fd}`, color: "#111827", marginBottom: 2 }}>{r.gym_name ?? "Sin nombre"}</p>
                          <p style={{ font: `400 0.7rem/1 ${fb}`, color: "#94A3B8" }}>{r.gym_id}</p>
                        </div>
                        <span style={{ padding: "3px 10px", borderRadius: 999, font: `600 0.72rem/1 ${fd}`, background: allDone ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)", color: allDone ? "#15803D" : "#C2410C" }}>
                          {n}/{STEPS.length} pasos
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 4, borderRadius: 99, background: "rgba(0,0,0,0.06)", marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: allDone ? "#22C55E" : "#F97316", transition: "width 0.3s" }} />
                      </div>
                      {/* Step pills */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {STEPS.map(s => {
                          const ok = !!r[s.key];
                          return (
                            <span key={s.key} style={{ padding: "2px 8px", borderRadius: 999, font: `500 0.68rem/1.4 ${fd}`, background: ok ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.1)", color: ok ? "#15803D" : "#64748B" }}>
                              {ok ? "✓" : "○"} {s.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        );
      })()}

        </>
      )}

      {/* ── Modal: elegir tipo de borrado ── */}
      {deleteModal && (
        <div
          onClick={() => { setDeleteModal(null); setConfirmText(""); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <AlertTriangle size={18} color="#EF4444" />
              <p style={{ font: `700 1rem/1.2 ${fd}`, color: "#111827", margin: 0 }}>Eliminar cuenta</p>
            </div>
            <p style={{ font: `400 0.84rem/1.55 ${fb}`, color: "#64748B", marginBottom: 22 }}>
              <strong style={{ color: "#111827" }}>{deleteModal.company_name}</strong>
              <br />¿Cómo querés eliminarla?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => deleteAccount(deleteModal.id, deleteModal.company_name, false)}
                style={{ padding: "11px 16px", borderRadius: 10, border: "1.5px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.06)", color: "#4F46E5", font: `600 0.88rem/1 ${fd}`, cursor: "pointer", textAlign: "left" }}
              >
                Borrar del CRM
                <span style={{ display: "block", font: `400 0.76rem/1.4 ${fb}`, color: "#6366F1", marginTop: 3, opacity: 0.8 }}>
                  Solo elimina el registro de la plataforma.
                </span>
              </button>

              {deleteModal.auth_user_id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px", borderRadius: 10, border: "1.5px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
                  <p style={{ font: `600 0.88rem/1.2 ${fd}`, color: "#DC2626", margin: 0 }}>
                    Borrado permanente
                    <span style={{ display: "block", font: `400 0.76rem/1.4 ${fb}`, color: "#EF4444", marginTop: 3, opacity: 0.85 }}>
                      Elimina el gym y todo su contenido (alumnos, pagos, membresías, usuarios). No se puede deshacer.
                    </span>
                  </p>
                  <label style={{ font: `500 0.74rem/1.3 ${fb}`, color: "#991B1B" }}>
                    Escribí <strong>{PERMANENT_DELETE_PHRASE}</strong> para confirmar:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder={PERMANENT_DELETE_PHRASE}
                    autoComplete="off"
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "#fff", color: "#111827", font: `500 0.82rem/1 ${fb}`, outline: "none" }}
                  />
                  <button
                    disabled={confirmText !== PERMANENT_DELETE_PHRASE}
                    onClick={() => deleteAccount(deleteModal.id, deleteModal.company_name, true)}
                    style={{ padding: "11px 16px", borderRadius: 10, border: "none", background: confirmText === PERMANENT_DELETE_PHRASE ? "#DC2626" : "rgba(239,68,68,0.35)", color: "#fff", font: `600 0.88rem/1 ${fd}`, cursor: confirmText === PERMANENT_DELETE_PHRASE ? "pointer" : "not-allowed" }}
                  >
                    Eliminar todo permanentemente
                  </button>
                </div>
              )}

              <button
                onClick={() => { setDeleteModal(null); setConfirmText(""); }}
                style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.3)", background: "transparent", color: "#64748B", font: `500 0.84rem/1 ${fd}`, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PlatformPage);
