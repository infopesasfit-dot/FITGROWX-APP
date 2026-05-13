"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { invalidateProfile, setImpersonatedGym } from "@/lib/gym-cache";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";

type PlatformStats = {
  vaultResources: number;
  platformAccounts: number;
  platformLeads: number;
};

type PlatformAccount = {
  id: string;
  auth_user_id: string | null;
  company_name: string;
  owner_name: string | null;
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

type VaultResourceRow = {
  id: string;
  title: string;
  status: string;
  format: string | null;
  updated_at: string;
};

type VaultCategoryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

type FeedbackRow = {
  id: string;
  gym_id: string;
  gym_name: string | null;
  email: string | null;
  message: string;
  created_at: string;
};

type AccountStatus = "trial_setup" | "trial_active" | "trial_risk" | "converted" | "churned";
type LeadStatus = "new" | "contacted" | "qualified" | "registered" | "lost";
type ResourceStatus = "draft" | "published" | "archived";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

export default function PlatformPage() {
  const router = useRouter();
  const [navigatingToGymId, setNavigatingToGymId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"crm" | "cms" | "feedback" | "whatsapp" | "onboarding">("crm");
  const [onboardingRows, setOnboardingRows] = useState<{ gym_id: string; gym_name: string | null; onboarding_completed: boolean | null }[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    vaultResources: 0,
    platformAccounts: 0,
    platformLeads: 0,
  });
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [leads, setLeads] = useState<PlatformLead[]>([]);
  const [vaultResources, setVaultResources] = useState<VaultResourceRow[]>([]);
  const [vaultCategories, setVaultCategories] = useState<VaultCategoryRow[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmFilter, setCrmFilter] = useState<"todos" | "leads" | "trial" | "riesgo" | "convertido" | "churn">("todos");
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    title: "",
    description: "",
  });
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    category_id: "",
    format: "Tutorial",
    status: "draft" as ResourceStatus,
  });

  // WhatsApp platform session states
  const PLAT_SESSION = "fitgrowx-platform";
  const [platWaStatus, setPlatWaStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [platWaPhone, setPlatWaPhone] = useState<string | null>(null);
  const [platQrOpen, setPlatQrOpen] = useState(false);
  const [platQrImage, setPlatQrImage] = useState<string | null>(null);
  const [platQrLoading, setPlatQrLoading] = useState(false);
  const [platQrError, setPlatQrError] = useState<"max" | null>(null);
  const platPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const platRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [platAutoEnabled, setPlatAutoEnabled] = useState<Record<string, boolean>>({});
  const [tplSaving, setTplSaving] = useState<Record<string, boolean>>({});
  const [tplTesting, setTplTesting] = useState<Record<string, "idle" | "sending" | "ok" | "error">>({});
  const tplSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const platWaProxy = async (action: string, extra?: Record<string, string>) => {
    return fetch("/api/wa/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, gymId: PLAT_SESSION, ...extra }),
    });
  };

  const platStopPolling = () => {
    if (platPollRef.current) { clearInterval(platPollRef.current); platPollRef.current = null; }
    if (platRetryRef.current) { clearTimeout(platRetryRef.current); platRetryRef.current = null; }
  };

  const platStartStatusPoll = () => {
    platStopPolling();
    platPollRef.current = setInterval(async () => {
      try {
        const res = await platWaProxy("session-status");
        const data = await res.json();
        if (data.status === "active") {
          platStopPolling();
          setPlatWaStatus("connected");
          if (data.phone) setPlatWaPhone(data.phone);
          setPlatQrOpen(false);
        }
      } catch { /* noop */ }
    }, 3000);
  };

  const platAttemptQr = async (attempt: number) => {
    setPlatQrLoading(true);
    setPlatQrImage(null);
    try {
      if (attempt === 0) await platWaProxy("session-delete").catch(() => {});
      const res = await platWaProxy("qr-data");
      const data = await res.json();
      if (data.status === "active") {
        setPlatWaStatus("connected");
        setPlatQrOpen(false);
        setPlatQrLoading(false);
        return;
      }
      if (data.qr) {
        setPlatQrImage(data.qr);
        setPlatQrLoading(false);
        platStartStatusPoll();
        return;
      }
      platRetryRef.current = setTimeout(() => platAttemptQr(attempt + 1), 2000);
    } catch {
      setPlatQrLoading(false);
      if (attempt < 4) platRetryRef.current = setTimeout(() => platAttemptQr(attempt + 1), 3000);
      else setPlatQrError("max");
    }
  };

  const platOpenQr = () => {
    platStopPolling();
    setPlatQrOpen(true);
    setPlatQrImage(null);
    setPlatQrError(null);
    void platAttemptQr(0);
  };

  const fetchPlatformData = async () => {
    const [
      { count: vaultResourcesCount, error: vaultCountError },
      { count: platformAccountsCount, error: accountsCountError },
      { count: platformLeadsCount, error: leadsCountError },
      { data: accountRows, error: accountRowsError },
      { data: leadRows, error: leadRowsError },
      { data: resourceRows, error: resourceRowsError },
      { data: categoryRows, error: categoryRowsError },
      { data: feedbackData },
      { data: onboardingData },
    ] = await Promise.all([
      supabase.from("vault_resources").select("*", { count: "exact", head: true }),
      supabase.from("platform_accounts").select("*", { count: "exact", head: true }),
      supabase.from("platform_leads").select("*", { count: "exact", head: true }),
      supabase
        .from("platform_accounts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("platform_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("vault_resources")
        .select("id, title, status, format, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("vault_categories")
        .select("id, slug, title, description, is_active")
        .order("sort_order", { ascending: true }),
      supabase
        .from("platform_feedback")
        .select("id, gym_id, gym_name, email, message, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("gym_settings")
        .select("gym_id, gym_name, onboarding_completed")
        .order("gym_name", { ascending: true }),
    ]);

    if (vaultCountError) throw vaultCountError;
    if (accountsCountError) throw accountsCountError;
    if (leadsCountError) throw leadsCountError;
    if (accountRowsError) throw accountRowsError;
    if (leadRowsError) throw leadRowsError;
    if (resourceRowsError) throw resourceRowsError;
    if (categoryRowsError) throw categoryRowsError;

    setStats({
      vaultResources: vaultResourcesCount ?? 0,
      platformAccounts: platformAccountsCount ?? 0,
      platformLeads: platformLeadsCount ?? 0,
    });
    setAccounts((accountRows ?? []) as PlatformAccount[]);
    setLeads((leadRows ?? []) as PlatformLead[]);
    setVaultResources((resourceRows ?? []) as VaultResourceRow[]);
    setFeedbackRows((feedbackData ?? []) as FeedbackRow[]);
    setVaultCategories((categoryRows ?? []) as VaultCategoryRow[]);
    setOnboardingRows((onboardingData ?? []) as { gym_id: string; gym_name: string | null; onboarding_completed: boolean | null }[]);
  };

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
    if (activeTab !== "whatsapp") return;
    (async () => {
      try {
        const res = await platWaProxy("session-status");
        const data = await res.json();
        setPlatWaStatus(data.status === "active" ? "connected" : "disconnected");
        if (data.phone) setPlatWaPhone(data.phone);
      } catch {
        setPlatWaStatus("disconnected");
      }
      // Cargar plantillas desde DB
      try {
        const res = await fetch("/api/platform/wa-templates");
        if (res.ok) {
          const dbTpl: Record<string, { body: string; enabled: boolean }> = await res.json();
          if (Object.keys(dbTpl).length > 0) {
            const bodies: Record<string, string> = {};
            const enableds: Record<string, boolean> = {};
            for (const [k, v] of Object.entries(dbTpl)) {
              bodies[k] = v.body;
              enableds[k] = v.enabled;
            }
            setPlatMsgTemplate(prev => ({ ...prev, ...bodies }));
            setPlatAutoEnabled(prev => ({ ...prev, ...enableds }));
          }
        }
      } catch { /* non-fatal */ }
    })();
    return () => platStopPolling();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autoguardado de plantillas con debounce 1.5s
  const handleTplChange = (key: string, value: string) => {
    setPlatMsgTemplate(prev => ({ ...prev, [key]: value }));
    if (tplSaveTimers.current[key]) clearTimeout(tplSaveTimers.current[key]);
    tplSaveTimers.current[key] = setTimeout(async () => {
      setTplSaving(prev => ({ ...prev, [key]: true }));
      try {
        await fetch("/api/platform/wa-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, body: value }),
        });
      } catch { /* non-fatal */ }
      setTplSaving(prev => ({ ...prev, [key]: false }));
    }, 1500);
  };

  const handleTplTest = async (key: string, body: string) => {
    const ownerPhone = process.env.NEXT_PUBLIC_OWNER_PHONE ?? "";
    const phone = prompt("Número para el test (ej: 5491165909374):", ownerPhone || "");
    if (!phone?.trim()) return;
    setTplTesting(prev => ({ ...prev, [key]: "sending" }));
    const r = await fetch("/api/platform/wa-templates/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, phone: phone.trim(), body }),
    });
    const state = r.ok ? "ok" : "error";
    setTplTesting(prev => ({ ...prev, [key]: state }));
    setTimeout(() => setTplTesting(prev => ({ ...prev, [key]: "idle" })), 3000);
  };

  const handleTplToggle = async (key: string, enabled: boolean) => {
    setPlatAutoEnabled(prev => ({ ...prev, [key]: enabled }));
    try {
      await fetch("/api/platform/wa-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
    } catch { /* non-fatal */ }
  };

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
    const term = crmSearch.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) =>
      [account.company_name, account.owner_name, account.subscription_plan, account.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [accounts, crmSearch]);

  const filteredLeads = useMemo(() => {
    const term = crmSearch.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) =>
      [lead.business_name, lead.full_name, lead.source, lead.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [leads, crmSearch]);

  const resetFeedbackSoon = () => {
    window.setTimeout(() => setFeedback(null), 2600);
  };


  const openGymDashboard = async (account: PlatformAccount) => {
    if (!account.auth_user_id) return;
    setNavigatingToGymId(account.id);
    try {
      const { data } = await supabase.from("profiles").select("gym_id").eq("id", account.auth_user_id).single();
      if (!data?.gym_id) { setNavigatingToGymId(null); return; }
      setImpersonatedGym({ gym_id: data.gym_id, gym_name: account.company_name });
      invalidateProfile();
      router.push("/dashboard");
    } catch {
      setNavigatingToGymId(null);
    }
  };

  const updateAccountStatus = async (id: string, status: AccountStatus) => {
    try {
      setUpdatingAccountId(id);
      const payload: {
        status: AccountStatus;
        converted_at?: string | null;
        trial_starts_at?: string;
        trial_ends_at?: string;
      } = { status };

      if (status === "converted") {
        payload.converted_at = new Date().toISOString();
      }

      if (status === "trial_setup" || status === "trial_active") {
        payload.trial_starts_at = new Date().toISOString();
        payload.trial_ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error: updateError } = await supabase
        .from("platform_accounts")
        .update(payload)
        .eq("id", id);
      if (updateError) throw updateError;
      await fetchPlatformData();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
      resetFeedbackSoon();
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    try {
      setUpdatingLeadId(id);
      const { error: updateError } = await supabase
        .from("platform_leads")
        .update({ status })
        .eq("id", id);
      if (updateError) throw updateError;
      await fetchPlatformData();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
      resetFeedbackSoon();
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryForm.title.trim()) return;

    try {
      setSavingCategory(true);
      setFeedback(null);
      const title = categoryForm.title.trim();
      const { error: insertError } = await supabase.from("vault_categories").insert({
        title,
        slug: slugify(title),
        description: categoryForm.description.trim() || null,
        sort_order: vaultCategories.length * 10 + 10,
        is_active: true,
      });
      if (insertError) throw insertError;
      setCategoryForm({ title: "", description: "" });
      await fetchPlatformData();
      setFeedback("Categoría creada en el CMS.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleResourceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceForm.title.trim() || !resourceForm.category_id) return;

    try {
      setSavingResource(true);
      setFeedback(null);
      const title = resourceForm.title.trim();
      const { error: insertError } = await supabase.from("vault_resources").insert({
        title,
        slug: slugify(title),
        description: resourceForm.description.trim() || null,
        category_id: resourceForm.category_id,
        format: resourceForm.format.trim() || null,
        status: resourceForm.status,
        content: [],
      });
      if (insertError) throw insertError;
      setResourceForm({
        title: "",
        description: "",
        category_id: vaultCategories[0]?.id ?? "",
        format: "Tutorial",
        status: "draft",
      });
      await fetchPlatformData();
      setFeedback("Recurso creado en la base del CMS.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingResource(false);
    }
  };

  useEffect(() => {
    if (!resourceForm.category_id && vaultCategories.length > 0) {
      setResourceForm((current) => ({
        ...current,
        category_id: vaultCategories[0].id,
      }));
    }
  }, [resourceForm.category_id, vaultCategories]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 48px" }}>
      <section style={{ ...shellCard, padding: "30px 30px 28px", marginBottom: 24 }}>
        <p
          style={{
            marginBottom: 8,
            font: `700 0.75rem/1 ${fd}`,
            color: "#F97316",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          Platform Admin
        </p>
        <h1
          style={{
            marginBottom: 14,
            font: `800 clamp(2rem, 4vw, 3.2rem)/1 ${fd}`,
            color: "#111827",
            letterSpacing: "-0.05em",
          }}
        >
          Panel interno para administrar FitGrowX.
        </h1>
        <p style={{ maxWidth: 860, font: `400 1rem/1.7 ${fb}`, color: "#475569" }}>
          Panel interno para gestionar clientes, comunicaciones y contenido de FitGrowX.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {[
            { key: "crm", label: "Clientes FitGrowX" },
            { key: "cms", label: "CMS Bóveda" },
            { key: "feedback", label: "Feedback" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "onboarding", label: "Onboarding" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "crm" | "cms" | "feedback" | "whatsapp" | "onboarding")}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.9)",
                background: activeTab === tab.key ? "#111827" : "rgba(255,255,255,0.68)",
                color: activeTab === tab.key ? "#FFFFFF" : "#475569",
                font: `700 0.82rem/1 ${fd}`,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

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
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
              marginBottom: 24,
            }}
          >
            {[
              ...(activeTab === "cms" ? [{
                label: "Recursos CMS",
                value: stats.vaultResources,
                icon: FolderOpen,
                tone: "rgba(249,115,22,0.1)",
                color: "#F97316",
              }] : []),
              {
                label: "Clientes FitGrowX",
                value: stats.platformAccounts,
                icon: Building2,
                tone: "rgba(37,99,235,0.10)",
                color: "#2563EB",
              },
              {
                label: "Leads de Plataforma",
                value: stats.platformLeads,
                icon: Users,
                tone: "rgba(15,118,110,0.10)",
                color: "#0F766E",
              },
            ].map(({ label, value, icon: Icon, tone, color }) => (
              <article key={label} style={{ ...shellCard, padding: 22 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    background: tone,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} color={color} />
                </div>
                <p style={{ marginBottom: 8, font: `600 0.8rem/1 ${fb}`, color: "#94A3B8" }}>
                  {label}
                </p>
                <p style={{ font: `800 2rem/1 ${fd}`, color: "#111827", letterSpacing: "-0.04em" }}>
                  {value}
                </p>
              </article>
            ))}
          </section>

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

                  const colAccount = "minmax(0,2fr) 150px 110px 100px 120px 36px";
                  const colLead    = "minmax(0,2fr) 130px minmax(0,1fr) 120px 36px";
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
                                {/* WA */}
                                <div style={{ ...cellStyle, gap: 6 }}>
                                  {a.phone ? (
                                    <a href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "rgba(37,211,102,0.12)", color: "#16A34A", textDecoration: "none" }}>
                                      <MessageCircle size={15} />
                                    </a>
                                  ) : (
                                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(148,163,184,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <MessageCircle size={15} color="#CBD5E1" />
                                    </div>
                                  )}
                                  {a.auth_user_id && (
                                    <button
                                      onClick={() => openGymDashboard(a)}
                                      disabled={navigatingToGymId === a.id}
                                      title="Ver dashboard del gym"
                                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "rgba(37,99,235,0.10)", color: "#2563EB", border: "none", cursor: "pointer" }}
                                    >
                                      {navigatingToGymId === a.id
                                        ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                                        : <ExternalLink size={14} />}
                                    </button>
                                  )}
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
                              {/* WA */}
                              <div style={cellStyle}>
                                {l.phone ? (
                                  <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "rgba(37,211,102,0.12)", color: "#16A34A", textDecoration: "none" }}>
                                    <MessageCircle size={15} />
                                  </a>
                                ) : (
                                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(148,163,184,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <MessageCircle size={15} color="#CBD5E1" />
                                  </div>
                                )}
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
          ) : activeTab === "cms" ? (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.9fr",
                gap: 18,
                marginBottom: 24,
              }}
            >
              <article style={{ ...shellCard, padding: 24 }}>
                <div style={{ marginBottom: 18 }}>
                  <p
                    style={{
                      marginBottom: 8,
                      font: `700 0.74rem/1 ${fd}`,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                    }}
                  >
                    CMS Bóveda
                  </p>
                  <h2
                    style={{
                      font: `780 1.45rem/1.1 ${fd}`,
                      color: "#111827",
                      letterSpacing: "-0.03em",
                      marginBottom: 10,
                    }}
                  >
                    Base editorial para subir recursos sin tocar código
                  </h2>
                  <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: "#475569" }}>
                    Ya puedes separar categorías y recursos como contenido administrable. El próximo
                    paso es conectar la bóveda pública a estas tablas y sumar alta/edición desde UI.
                  </p>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>
                    Categorías cargadas
                  </p>
                  {vaultCategories.length === 0
                    ? emptyState(
                        "Sin categorías en CMS",
                        "La migración crea la estructura. Si no aparecen categorías, revisa que las semillas se hayan aplicado correctamente.",
                      )
                    : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {vaultCategories.map((category) => (
                          <span
                            key={category.id}
                            style={{
                              padding: "9px 12px",
                              borderRadius: 999,
                              background: category.is_active ? "rgba(255,255,255,0.78)" : "rgba(148,163,184,0.16)",
                              border: "1px solid rgba(255,255,255,0.95)",
                              font: `600 0.78rem/1 ${fb}`,
                              color: category.is_active ? "#334155" : "#94A3B8",
                            }}
                          >
                            {category.title}
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                <div>
                  <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>
                    Recursos en base
                  </p>
                  {vaultResources.length === 0
                    ? emptyState(
                        "Todavía no hay recursos en DB",
                        "La siguiente etapa es migrar tus recursos actuales a `vault_resources` y luego crear el editor para la bóveda.",
                      )
                    : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {vaultResources.map((resource) => {
                          const tone = statusTone(resource.status);
                          return (
                            <article
                              key={resource.id}
                              style={{
                                borderRadius: 18,
                                background: "rgba(255,255,255,0.72)",
                                border: "1px solid rgba(255,255,255,0.95)",
                                padding: 16,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  alignItems: "flex-start",
                                  marginBottom: 10,
                                }}
                              >
                                <div>
                                  <p
                                    style={{
                                      marginBottom: 6,
                                      font: `700 0.96rem/1.2 ${fd}`,
                                      color: "#111827",
                                    }}
                                  >
                                    {resource.title}
                                  </p>
                                  <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: "#64748B" }}>
                                    {resource.format ?? "Sin formato"} · actualizado{" "}
                                    {new Date(resource.updated_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <span
                                  style={{
                                    padding: "7px 10px",
                                    borderRadius: 999,
                                    background: tone.bg,
                                    color: tone.color,
                                    font: `700 0.7rem/1 ${fd}`,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                  }}
                                >
                                  {resource.status}
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                </div>
              </article>

              <article style={{ ...shellCard, padding: 24 }}>
                <div style={{ marginBottom: 18 }}>
                  <p
                    style={{
                      marginBottom: 8,
                      font: `700 0.74rem/1 ${fd}`,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                    }}
                  >
                    Alta rápida CMS
                  </p>
                  <h2
                    style={{
                      font: `780 1.45rem/1.1 ${fd}`,
                      color: "#111827",
                      letterSpacing: "-0.03em",
                      marginBottom: 10,
                    }}
                  >
                    Crea categorías y recursos desde este panel
                  </h2>
                  <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: "#475569" }}>
                    Dejamos una primera capa simple para publicar la estructura editorial sin tocar
                    código. Después afinamos editor, portada y contenido enriquecido.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 18 }}>
                  <form
                    onSubmit={handleCategorySubmit}
                    style={{
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(255,255,255,0.95)",
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Plus size={16} color="#F97316" />
                      <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nueva categoría</p>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        value={categoryForm.title}
                        onChange={(event) =>
                          setCategoryForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Ej: Tutoriales de automatización"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "11px 12px",
                          color: "#111827",
                          outline: "none",
                          font: `500 0.84rem/1 ${fb}`,
                        }}
                      />
                      <textarea
                        value={categoryForm.description}
                        onChange={(event) =>
                          setCategoryForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Descripción breve para la categoría"
                        rows={3}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "11px 12px",
                          color: "#111827",
                          outline: "none",
                          font: `500 0.84rem/1.5 ${fb}`,
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingCategory}
                      style={{
                        marginTop: 14,
                        width: "100%",
                        border: "none",
                        borderRadius: 12,
                        background: "#111827",
                        color: "#FFFFFF",
                        padding: "11px 14px",
                        font: `700 0.84rem/1 ${fd}`,
                        cursor: "pointer",
                        opacity: savingCategory ? 0.7 : 1,
                      }}
                    >
                      {savingCategory ? "Guardando..." : "Crear categoría"}
                    </button>
                  </form>

                  <form
                    onSubmit={handleResourceSubmit}
                    style={{
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(255,255,255,0.95)",
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Plus size={16} color="#2563EB" />
                      <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nuevo recurso</p>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        value={resourceForm.title}
                        onChange={(event) =>
                          setResourceForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Título del recurso"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "11px 12px",
                          color: "#111827",
                          outline: "none",
                          font: `500 0.84rem/1 ${fb}`,
                        }}
                      />
                      <textarea
                        value={resourceForm.description}
                        onChange={(event) =>
                          setResourceForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Resumen corto para la card o listado"
                        rows={3}
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "11px 12px",
                          color: "#111827",
                          outline: "none",
                          font: `500 0.84rem/1.5 ${fb}`,
                          resize: "vertical",
                        }}
                      />
                      <select
                        value={resourceForm.category_id}
                        onChange={(event) =>
                          setResourceForm((current) => ({
                            ...current,
                            category_id: event.target.value,
                          }))
                        }
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.18)",
                          background: "rgba(255,255,255,0.88)",
                          padding: "11px 12px",
                          color: "#111827",
                          font: `600 0.82rem/1 ${fb}`,
                        }}
                      >
                        <option value="">Selecciona una categoría</option>
                        {vaultCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.title}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <input
                          value={resourceForm.format}
                          onChange={(event) =>
                            setResourceForm((current) => ({
                              ...current,
                              format: event.target.value,
                            }))
                          }
                          placeholder="Formato"
                          style={{
                            width: "100%",
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.18)",
                            background: "rgba(255,255,255,0.88)",
                            padding: "11px 12px",
                            color: "#111827",
                            outline: "none",
                            font: `500 0.84rem/1 ${fb}`,
                          }}
                        />
                        <select
                          value={resourceForm.status}
                          onChange={(event) =>
                            setResourceForm((current) => ({
                              ...current,
                              status: event.target.value as ResourceStatus,
                            }))
                          }
                          style={{
                            borderRadius: 12,
                            border: "1px solid rgba(148,163,184,0.18)",
                            background: "rgba(255,255,255,0.88)",
                            padding: "11px 12px",
                            color: "#111827",
                            font: `600 0.82rem/1 ${fb}`,
                          }}
                        >
                          {["draft", "published", "archived"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingResource || vaultCategories.length === 0}
                      style={{
                        marginTop: 14,
                        width: "100%",
                        border: "none",
                        borderRadius: 12,
                        background: "#111827",
                        color: "#FFFFFF",
                        padding: "11px 14px",
                        font: `700 0.84rem/1 ${fd}`,
                        cursor: "pointer",
                        opacity: savingResource || vaultCategories.length === 0 ? 0.7 : 1,
                      }}
                    >
                      {savingResource ? "Guardando..." : "Crear recurso"}
                    </button>
                  </form>

                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      "Migrar los recursos actuales desde data.ts a vault_resources.",
                      "Permitir alta/edición de objetivo, outcome y contenido enriquecido.",
                      "Conectar /dashboard/boveda a la base nueva.",
                    ].map((item) => (
                      <div
                        key={item}
                        style={{
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.72)",
                          border: "1px solid rgba(255,255,255,0.95)",
                          padding: 14,
                          font: `500 0.84rem/1.6 ${fb}`,
                          color: "#475569",
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            </section>
          ) : null}

          {activeTab === "cms" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/dashboard/boveda"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 14,
                background: "#111827",
                color: "#FFFFFF",
                textDecoration: "none",
                font: `700 0.88rem/1 ${fd}`,
                boxShadow: "0 14px 28px rgba(15,23,42,0.16)",
              }}
            >
              Ver bóveda actual
              <ArrowRight size={15} />
            </Link>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.72)",
                color: "#475569",
                font: `600 0.86rem/1 ${fb}`,
                border: "1px solid rgba(255,255,255,0.9)",
              }}
            >
              <FileText size={15} />
              Siguiente paso sugerido: conectar la bóveda al CMS nuevo
            </div>
          </div>
          )}

      {/* ── Feedback tab ── */}
      {!loading && !error && authorized && activeTab === "feedback" && (
        <>
          {/* Stats bar */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
            {[
              {
                label: "Total mensajes",
                value: feedbackRows.length,
                color: "#2563EB",
                bg: "rgba(37,99,235,0.08)",
              },
              {
                label: "Últimos 7 días",
                value: feedbackRows.filter(r => {
                  const d = new Date(r.created_at);
                  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
                }).length,
                color: "#F97316",
                bg: "rgba(249,115,22,0.08)",
              },
              {
                label: "Gyms distintos",
                value: new Set(feedbackRows.map(r => r.gym_id)).size,
                color: "#16A34A",
                bg: "rgba(22,163,74,0.08)",
              },
            ].map(stat => (
              <div key={stat.label} style={{ ...shellCard, padding: "20px 22px" }}>
                <p style={{ margin: "0 0 6px", font: `400 0.78rem/1 ${fb}`, color: "#6B7280", letterSpacing: "0.04em", textTransform: "uppercase" }}>{stat.label}</p>
                <p style={{ margin: 0, font: `700 1.7rem/1 ${fd}`, color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </section>

          {/* Count badge */}
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
            <span style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(37,99,235,0.08)", font: `600 0.78rem/1 ${fd}`, color: "#2563EB" }}>
              {feedbackRows.length} mensaje{feedbackRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {feedbackRows.length === 0 ? (
            emptyState("Sin feedback todavía", "Cuando algún usuario envíe un mensaje desde el dashboard, va a aparecer acá.")
          ) : (
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {feedbackRows.map(row => {
                const daysAgo = Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const relTime = daysAgo === 0 ? "Hoy" : daysAgo === 1 ? "Ayer" : `Hace ${daysAgo} días`;
                return (
                  <article key={row.id} style={{ ...shellCard, padding: "0", overflow: "hidden", display: "flex" }}>
                    {/* Left accent bar */}
                    <div style={{ width: 4, flexShrink: 0, background: "linear-gradient(180deg, #2563EB 0%, #7C3AED 100%)" }} />
                    <div style={{ flex: 1, padding: "18px 22px" }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          {/* Gym pill */}
                          <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(37,99,235,0.09)", font: `600 0.78rem/1 ${fd}`, color: "#2563EB", display: "flex", alignItems: "center", gap: 5 }}>
                            <Building2 size={11} />
                            {row.gym_name ?? row.gym_id}
                          </span>
                          {row.email && (
                            <span style={{ font: `400 0.78rem/1 ${fb}`, color: "#9CA3AF" }}>{row.email}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ font: `400 0.75rem/1 ${fb}`, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock3 size={11} /> {relTime}
                          </span>
                          {row.email && (
                            <a
                              href={`mailto:${row.email}?subject=Re: tu feedback en FitGrowX`}
                              style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", font: `600 0.75rem/1 ${fd}`, color: "#374151", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <Send size={10} /> Responder
                            </a>
                          )}
                        </div>
                      </div>
                      {/* Message body */}
                      <p style={{ margin: 0, font: `400 0.9rem/1.7 ${fb}`, color: "#374151", whiteSpace: "pre-wrap" }}>
                        {row.message}
                      </p>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* ── WhatsApp tab ── */}
      {!loading && !error && authorized && activeTab === "whatsapp" && (
        <>
          {/* Connection status banner */}
          <section style={{
            ...shellCard,
            padding: "22px 26px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            borderLeft: `4px solid ${platWaStatus === "connected" ? "#16A34A" : platWaStatus === "disconnected" ? "#DC2626" : "#94A3B8"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Status dot */}
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: platWaStatus === "connected" ? "rgba(22,163,74,0.12)" : platWaStatus === "disconnected" ? "rgba(220,38,38,0.10)" : "rgba(148,163,184,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {platWaStatus === "connected"
                  ? <CheckCircle size={20} color="#16A34A" />
                  : platWaStatus === "disconnected"
                  ? <WifiOff size={20} color="#DC2626" />
                  : <Loader2 size={20} color="#94A3B8" style={{ animation: "spin 1s linear infinite" }} />}
              </div>
              <div>
                <p style={{ margin: 0, font: `700 0.95rem/1 ${fd}`, color: "#111827" }}>
                  {platWaStatus === "connected"
                    ? `Conectado${platWaPhone ? ` · ${platWaPhone}` : ""}`
                    : platWaStatus === "disconnected" ? "Sin conexión" : "Verificando..."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={platOpenQr}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: platWaStatus === "connected" ? "rgba(15,23,42,0.08)" : "#111827",
                color: platWaStatus === "connected" ? "#374151" : "#fff",
                font: `600 0.85rem/1 ${fd}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                flexShrink: 0,
              }}
            >
              <Smartphone size={15} />
              {platWaStatus === "connected" ? "Reconectar QR" : "Conectar QR"}
            </button>
          </section>

          {/* QR Modal */}
          {platQrOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", borderRadius: 24, padding: "36px 40px", maxWidth: 420, width: "90%", textAlign: "center", position: "relative" }}>
                <button type="button" onClick={() => { platStopPolling(); setPlatQrOpen(false); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={18} color="#6B7280" />
                </button>
                <Smartphone size={28} color="#111827" style={{ marginBottom: 12 }} />
                <p style={{ margin: "0 0 6px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>Conectá tu WhatsApp</p>
                <p style={{ margin: "0 0 22px", font: `400 0.85rem/1.5 ${fb}`, color: "#6B7280" }}>
                  Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escaneá el QR
                </p>
                {platQrLoading && !platQrImage && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "30px 0" }}>
                    <Loader2 size={32} color="#2563EB" style={{ animation: "spin 1s linear infinite" }} />
                    <p style={{ margin: 0, font: `400 0.85rem/1 ${fb}`, color: "#64748B" }}>Generando QR...</p>
                  </div>
                )}
                {platQrImage && (
                  <img src={platQrImage} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)" }} />
                )}
                {platQrError === "max" && (
                  <div style={{ padding: "20px 0" }}>
                    <p style={{ margin: "0 0 14px", font: `500 0.88rem/1.5 ${fb}`, color: "#B91C1C" }}>No se pudo generar el QR. Intentá de nuevo.</p>
                    <button type="button" onClick={() => { setPlatQrError(null); void platAttemptQr(0); }} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", font: `600 0.85rem/1 ${fd}`, cursor: "pointer" }}>
                      Reintentar
                    </button>
                  </div>
                )}
                {platQrImage && (
                  <p style={{ margin: "14px 0 0", font: `400 0.8rem/1.5 ${fb}`, color: "#9CA3AF" }}>
                    El QR se actualiza automáticamente. Una vez escaneado, se cerrará esta ventana.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Automatizaciones ── */}
          <section style={{ ...shellCard, padding: "26px 28px" }}>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 4px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>Automatizaciones</p>
              <p style={{ margin: 0, font: `400 0.83rem/1.5 ${fb}`, color: "#6B7280" }}>
                Cada mensaje se dispara automáticamente. Activá o desactivá por separado y editá el texto cuando quieras — se guarda solo.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["bienvenida", "activacion_d3", "trial_vence", "trial_expirado", "primer_pago", "inactivo_7d", "reactivacion"] as const).map(key => {
                const meta: Record<string, { label: string; when: string; color: string; bg: string }> = {
                  bienvenida:     { label: "Bienvenida",             when: "Cuando se registra un gym nuevo",                   color: "#16A34A", bg: "rgba(22,163,74,0.07)"    },
                  activacion_d3:  { label: "Día 3 sin alumnos",      when: "3 días después del registro si no cargó alumnos",   color: "#0EA5E9", bg: "rgba(14,165,233,0.07)"   },
                  trial_vence:    { label: "Trial por vencer",       when: "2 días antes de que venza el trial",                color: "#D97706", bg: "rgba(217,119,6,0.07)"    },
                  trial_expirado: { label: "Trial vencido",          when: "El día que vence el trial sin convertir",           color: "#DC2626", bg: "rgba(220,38,38,0.07)"    },
                  primer_pago:    { label: "Primer pago 🎉",         when: "Cuando el gym recibe su primer pago",               color: "#7C3AED", bg: "rgba(124,58,237,0.07)"   },
                  inactivo_7d:    { label: "Sin actividad 7 días",   when: "7 días sin actividad en el sistema",                color: "#6366F1", bg: "rgba(99,102,241,0.07)"   },
                  reactivacion:   { label: "Reactivación manual",    when: "Disparo manual desde el CRM",                      color: "#6B7280", bg: "rgba(107,114,128,0.07)"  },
                };
                const m = meta[key];
                const enabled = platAutoEnabled[key] !== false;
                const saving  = tplSaving[key];
                return (
                  <div key={key} style={{ borderRadius: 16, border: `1px solid ${enabled ? "rgba(15,23,42,0.08)" : "rgba(15,23,42,0.04)"}`, overflow: "hidden", opacity: enabled ? 1 : 0.55, transition: "opacity 0.2s" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: enabled ? m.bg : "rgba(0,0,0,0.02)" }}>
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => handleTplToggle(key, !enabled)}
                        style={{
                          flexShrink: 0,
                          width: 40, height: 22, borderRadius: 11,
                          background: enabled ? m.color : "#D1D5DB",
                          border: "none", cursor: "pointer", position: "relative",
                          transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3,
                          left: enabled ? 21 : 3,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "white",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          transition: "left 0.2s",
                          display: "block",
                        }} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, font: `600 0.85rem/1 ${fd}`, color: enabled ? "#111827" : "#9CA3AF" }}>{m.label}</p>
                        <p style={{ margin: "3px 0 0", font: `400 0.72rem/1 ${fb}`, color: "#94A3B8" }}>{m.when}</p>
                      </div>
                      {saving && <span style={{ font: `400 0.72rem/1 ${fb}`, color: "#94A3B8", flexShrink: 0 }}>guardando…</span>}
                      {enabled && !saving && <span style={{ padding: "2px 8px", borderRadius: 4, background: m.color + "20", font: `600 0.65rem/1 ${fd}`, color: m.color, flexShrink: 0 }}>AUTO</span>}
                      <button
                        type="button"
                        onClick={() => handleTplTest(key, platMsgTemplate[key])}
                        disabled={tplTesting[key] === "sending"}
                        style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.10)", background: tplTesting[key] === "ok" ? "rgba(22,163,74,0.08)" : tplTesting[key] === "error" ? "rgba(220,38,38,0.08)" : "rgba(15,23,42,0.04)", font: `500 0.68rem/1 ${fd}`, color: tplTesting[key] === "ok" ? "#16A34A" : tplTesting[key] === "error" ? "#DC2626" : "#6B7280", cursor: "pointer", flexShrink: 0 }}
                      >
                        {tplTesting[key] === "sending" ? "Enviando…" : tplTesting[key] === "ok" ? "✓ Enviado" : tplTesting[key] === "error" ? "Error" : "Probar"}
                      </button>
                    </div>
                    {/* Editable body */}
                    <div style={{ padding: "12px 16px", background: "#FAFAFA", borderTop: "1px solid rgba(15,23,42,0.05)" }}>
                      <textarea
                        rows={3}
                        value={platMsgTemplate[key]}
                        onChange={e => handleTplChange(key, e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", background: "white", font: `400 0.85rem/1.6 ${fb}`, color: "#374151", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                      />
                      <p style={{ margin: "6px 0 0", font: `400 0.68rem/1 ${fb}`, color: "#CBD5E1" }}>
                        Variables disponibles: {"{nombre}"} · {"{dias}"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ── Onboarding tab ── */}
      {!loading && !error && authorized && activeTab === "onboarding" && (() => {
        const done  = onboardingRows.filter(r => r.onboarding_completed).length;
        const total = onboardingRows.length;
        return (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total gyms", value: total, color: "#6366F1", bg: "rgba(99,102,241,0.08)" },
                { label: "Completaron onboarding", value: done, color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
                { label: "Pendientes", value: total - done, color: "#F97316", bg: "rgba(249,115,22,0.08)" },
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
                {onboardingRows.map(r => (
                  <div key={r.gym_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: r.onboarding_completed ? "rgba(34,197,94,0.05)" : "rgba(249,115,22,0.05)", border: `1px solid ${r.onboarding_completed ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)"}` }}>
                    <div>
                      <p style={{ font: `600 0.88rem/1 ${fd}`, color: "#111827", marginBottom: 3 }}>{r.gym_name ?? "Sin nombre"}</p>
                      <p style={{ font: `400 0.72rem/1 ${fb}`, color: "#94A3B8" }}>{r.gym_id}</p>
                    </div>
                    <span style={{ padding: "4px 10px", borderRadius: 999, font: `600 0.72rem/1 ${fd}`, background: r.onboarding_completed ? "rgba(34,197,94,0.12)" : "rgba(249,115,22,0.12)", color: r.onboarding_completed ? "#15803D" : "#C2410C" }}>
                      {r.onboarding_completed ? "✓ Completado" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        );
      })()}

        </>
      )}
    </div>
  );
}
