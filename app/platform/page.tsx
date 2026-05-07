"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Clock3,
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
import { supabase } from "@/lib/supabase";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";

type PlatformStats = {
  vaultResources: number;
  platformAccounts: number;
  platformLeads: number;
};

type PlatformAccount = {
  id: string;
  company_name: string;
  owner_name: string | null;
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
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"crm" | "cms" | "feedback" | "whatsapp">("crm");
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
  const [savingLead, setSavingLead] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [leadForm, setLeadForm] = useState({
    full_name: "",
    business_name: "",
    email: "",
    phone: "",
    source: "landing",
  });
  const [accountForm, setAccountForm] = useState({
    company_name: "",
    owner_name: "",
    email: "",
    phone: "",
    subscription_plan: "starter",
    status: "trial_setup" as AccountStatus,
  });
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
  const [platMsgTemplate, setPlatMsgTemplate] = useState({
    bienvenida: "¡Hola {nombre}! 🎉 Bienvenido a FitGrowX. Tu gym ya está listo para escalar. Si tenés alguna duda, respondé este mensaje.",
    onboarding: "¡Hola {nombre}! 🚀 Antes de arrancar, te recomendamos cargar tus alumnos y configurar los turnos para sacarle el máximo al sistema desde el día uno.\n\nSi necesitás ayuda con algún paso, respondé este mensaje y lo resolvemos juntos. ¡Estamos para acompañarte! 💪",
    trial_vence: "¡Hola {nombre}! ⏰ Tu período de prueba de FitGrowX vence en {dias} días. ¿Querés seguir creciendo? Hablemos para activar tu plan.",
    reactivacion: "¡Hola {nombre}! 👋 Hace un tiempo que no te vemos por FitGrowX. ¿Todo bien? Estamos acá para ayudarte a recuperar el control de tu gym.",
  });
  const [platSendPhone, setPlatSendPhone] = useState("");
  const [platSendMsg, setPlatSendMsg] = useState("");
  const [platSending, setPlatSending] = useState(false);
  const [platSendResult, setPlatSendResult] = useState<"ok" | "error" | null>(null);

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

  const platSendMessage = async () => {
    const phone = platSendPhone.trim().replace(/[^0-9]/g, "");
    const msg = platSendMsg.trim();
    if (!phone || !msg) return;
    setPlatSending(true);
    setPlatSendResult(null);
    try {
      const res = await platWaProxy("send-message", { phone, message: msg });
      const data = await res.json();
      setPlatSendResult(data.ok ? "ok" : "error");
    } catch {
      setPlatSendResult("error");
    }
    setPlatSending(false);
    setTimeout(() => setPlatSendResult(null), 3500);
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
    })();
    return () => platStopPolling();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleLeadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leadForm.full_name.trim() && !leadForm.business_name.trim()) return;

    try {
      setSavingLead(true);
      setFeedback(null);
      const { error: insertError } = await supabase.from("platform_leads").insert({
        full_name: leadForm.full_name.trim() || null,
        business_name: leadForm.business_name.trim() || null,
        email: leadForm.email.trim() || null,
        phone: leadForm.phone.trim() || null,
        source: leadForm.source.trim() || "manual",
        status: "new",
      });
      if (insertError) throw insertError;
      setLeadForm({ full_name: "", business_name: "", email: "", phone: "", source: "landing" });
      await fetchPlatformData();
      setFeedback("Lead creado correctamente.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingLead(false);
    }
  };

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountForm.company_name.trim()) return;

    try {
      setSavingAccount(true);
      setFeedback(null);
      const { error: insertError } = await supabase.from("platform_accounts").insert({
        company_name: accountForm.company_name.trim(),
        owner_name: accountForm.owner_name.trim() || null,
        email: accountForm.email.trim() || null,
        phone: accountForm.phone.trim() || null,
        subscription_plan: accountForm.subscription_plan.trim() || null,
        status: accountForm.status,
        trial_starts_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (insertError) throw insertError;
      setAccountForm({
        company_name: "",
        owner_name: "",
        email: "",
        phone: "",
        subscription_plan: "starter",
        status: "trial_setup",
      });
      await fetchPlatformData();
      setFeedback("Cuenta creada con trial de 15 días.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingAccount(false);
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
        payload.trial_ends_at = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
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
          Desde acá vas a gestionar tus clientes FitGrowX y también la bóveda como CMS. La idea es
          que tengas una sola base de operación para escalar el producto sin mezclarlo con el
          dashboard de un gym.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          {[
            { key: "crm", label: "Clientes FitGrowX" },
            { key: "cms", label: "CMS Bóveda" },
            { key: "feedback", label: "Feedback" },
            { key: "whatsapp", label: "WhatsApp" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "crm" | "cms" | "feedback" | "whatsapp")}
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
              {
                label: "Recursos CMS",
                value: stats.vaultResources,
                icon: FolderOpen,
                tone: "rgba(249,115,22,0.1)",
                color: "#F97316",
              },
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
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "1.18fr 0.82fr",
                gap: 18,
                marginBottom: 24,
              }}
            >
              <article style={{ ...shellCard, padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 18,
                  }}
                >
                  <div>
                    <p
                      style={{
                        marginBottom: 8,
                        font: `700 0.74rem/1 ${fd}`,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                      }}
                    >
                      Clientes FitGrowX
                    </p>
                    <h2
                      style={{
                        font: `780 1.45rem/1.1 ${fd}`,
                        color: "#111827",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      Leads, trials y clientes pagos
                    </h2>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { label: "Trials activos", value: crmHealth.trialClients },
                      { label: "Por vencer", value: crmHealth.expiringTrials },
                      { label: "Convertidos", value: crmHealth.convertedClients },
                      { label: "Leads nuevos", value: crmHealth.newLeads },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.72)",
                          border: "1px solid rgba(255,255,255,0.95)",
                          padding: "10px 12px",
                          minWidth: 96,
                        }}
                      >
                        <p style={{ marginBottom: 4, font: `600 0.72rem/1 ${fb}`, color: "#94A3B8" }}>
                          {item.label}
                        </p>
                        <p style={{ font: `800 1.15rem/1 ${fd}`, color: "#111827" }}>{item.value}</p>
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
                  <div
                    style={{
                      borderRadius: 16,
                      background: "rgba(15,23,42,0.06)",
                      color: "#334155",
                      border: "1px solid rgba(148,163,184,0.18)",
                      padding: "12px 14px",
                      font: `600 0.82rem/1.5 ${fb}`,
                      marginBottom: 18,
                    }}
                  >
                    {feedback}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 18,
                  }}
                >
                  <div>
                    <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>
                      Trials y clientes recientes
                    </p>
                    {filteredAccounts.length === 0
                      ? emptyState(
                          "Sin clientes para mostrar",
                          crmSearch
                            ? "No hay coincidencias con tu búsqueda actual."
                            : "Acá vas a seguir el lifecycle real del producto: trial, riesgo de no activar, conversión y churn.",
                        )
                      : (
                        <div style={{ display: "grid", gap: 12 }}>
                          {filteredAccounts.map((account) => {
                            const tone = statusTone(account.status);
                            const activation = activationTone(account.activation_score ?? 0);
                            return (
                              <article
                                key={account.id}
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
                                      {account.company_name}
                                    </p>
                                    <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: "#64748B" }}>
                                      {account.owner_name ?? "Sin owner"} · {account.subscription_plan ?? "Sin plan"}
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                        marginTop: 8,
                                      }}
                                    >
                                      <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: "#94A3B8" }}>
                                        Trial vence: {formatDate(account.trial_ends_at)}
                                      </p>
                                      <span
                                        style={{
                                          padding: "6px 9px",
                                          borderRadius: 999,
                                          background: activation.bg,
                                          color: activation.color,
                                          font: `700 0.68rem/1 ${fd}`,
                                          letterSpacing: "0.04em",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        Score {account.activation_score ?? 0} · {activation.label}
                                      </span>
                                    </div>
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
                                    {account.status}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 8,
                                        font: `500 0.78rem/1 ${fb}`,
                                        color: "#64748B",
                                      }}
                                    >
                                      <Clock3 size={14} />
                                      Próximo seguimiento: {formatDate(account.next_follow_up_at)}
                                    </div>
                                    <select
                                      value={account.status}
                                      disabled={updatingAccountId === account.id}
                                      onChange={(event) => updateAccountStatus(account.id, event.target.value as AccountStatus)}
                                      style={{
                                        borderRadius: 12,
                                        border: "1px solid rgba(148,163,184,0.22)",
                                        background: "rgba(255,255,255,0.8)",
                                        padding: "8px 10px",
                                        color: "#334155",
                                        font: `600 0.76rem/1 ${fb}`,
                                      }}
                                    >
                                      {["trial_setup", "trial_active", "trial_risk", "converted", "churned"].map((status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div
                                    style={{
                                      borderRadius: 14,
                                      border: "1px solid rgba(148,163,184,0.14)",
                                      background: "rgba(15,23,42,0.03)",
                                      padding: "11px 12px",
                                    }}
                                  >
                                    <p style={{ font: `600 0.76rem/1.5 ${fb}`, color: "#475569" }}>
                                      {activationHint(account)}
                                    </p>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                  </div>

                  <div>
                    <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>
                      Leads recientes
                    </p>
                    {filteredLeads.length === 0
                      ? emptyState(
                          "Sin leads para mostrar",
                          crmSearch
                            ? "No hay coincidencias con tu búsqueda actual."
                            : "Aquí manejas el tramo previo al registro. Cuando el lead crea cuenta en la landing, pasa a tu embudo de trial."
                        )
                      : (
                        <div style={{ display: "grid", gap: 12 }}>
                          {filteredLeads.map((lead) => {
                            const tone = statusTone(lead.status);
                            return (
                              <article
                                key={lead.id}
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
                                      {lead.business_name ?? lead.full_name ?? "Lead sin nombre"}
                                    </p>
                                    <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: "#64748B" }}>
                                      {lead.full_name ?? "Sin contacto"} · {lead.source ?? "Sin fuente"}
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
                                    {lead.status}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                      font: `500 0.78rem/1 ${fb}`,
                                      color: "#64748B",
                                    }}
                                  >
                                    <Clock3 size={14} />
                                    Próximo seguimiento: {formatDate(lead.next_follow_up_at)}
                                  </div>
                                  <select
                                    value={lead.status}
                                    disabled={updatingLeadId === lead.id}
                                    onChange={(event) => updateLeadStatus(lead.id, event.target.value as LeadStatus)}
                                    style={{
                                      borderRadius: 12,
                                      border: "1px solid rgba(148,163,184,0.22)",
                                      background: "rgba(255,255,255,0.8)",
                                      padding: "8px 10px",
                                      color: "#334155",
                                      font: `600 0.76rem/1 ${fb}`,
                                    }}
                                  >
                                    {["new", "contacted", "qualified", "registered", "lost"].map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                  </div>
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
                      Alta rápida
                    </p>
                  <h2
                    style={{
                      font: `780 1.45rem/1.1 ${fd}`,
                      color: "#111827",
                      letterSpacing: "-0.03em",
                      marginBottom: 10,
                    }}
                  >
                    Carga manual de leads y trials
                  </h2>
                  <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: "#475569" }}>
                    Esta versión ya sigue mejor tu embudo real: lead antes del registro, trial con
                    15 días y luego conversión a cliente pago.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 18 }}>
                  <form
                    onSubmit={handleLeadSubmit}
                    style={{
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(255,255,255,0.95)",
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Plus size={16} color="#0F766E" />
                      <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nuevo lead</p>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {[
                        { key: "full_name", placeholder: "Nombre del contacto" },
                        { key: "business_name", placeholder: "Nombre del negocio" },
                        { key: "email", placeholder: "Email" },
                        { key: "phone", placeholder: "Teléfono" },
                        { key: "source", placeholder: "Fuente" },
                      ].map((field) => (
                        <input
                          key={field.key}
                          value={leadForm[field.key as keyof typeof leadForm]}
                          onChange={(event) =>
                            setLeadForm((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
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
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={savingLead}
                      style={{
                        marginTop: 14,
                        width: "100%",
                        border: "none",
                        borderRadius: 12,
                        background: "#0F172A",
                        color: "#FFFFFF",
                        padding: "11px 14px",
                        font: `700 0.84rem/1 ${fd}`,
                        cursor: "pointer",
                        opacity: savingLead ? 0.7 : 1,
                      }}
                    >
                      {savingLead ? "Guardando..." : "Guardar lead"}
                    </button>
                  </form>

                  <form
                    onSubmit={handleAccountSubmit}
                    style={{
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(255,255,255,0.95)",
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Plus size={16} color="#2563EB" />
                      <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nueva cuenta trial</p>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {[
                        { key: "company_name", placeholder: "Nombre del espacio" },
                        { key: "owner_name", placeholder: "Owner / contacto principal" },
                        { key: "email", placeholder: "Email" },
                        { key: "phone", placeholder: "Teléfono" },
                      ].map((field) => (
                        <input
                          key={field.key}
                          value={accountForm[field.key as keyof typeof accountForm] as string}
                          onChange={(event) =>
                            setAccountForm((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
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
                      ))}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <select
                          value={accountForm.subscription_plan}
                          onChange={(event) =>
                            setAccountForm((current) => ({
                              ...current,
                              subscription_plan: event.target.value,
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
                          {["starter", "growth", "pro", "enterprise"].map((plan) => (
                            <option key={plan} value={plan}>
                              {plan}
                            </option>
                          ))}
                        </select>
                        <select
                          value={accountForm.status}
                          onChange={(event) =>
                            setAccountForm((current) => ({
                              ...current,
                              status: event.target.value as AccountStatus,
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
                          {["trial_setup", "trial_active", "trial_risk", "converted", "churned"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={savingAccount}
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
                        opacity: savingAccount ? 0.7 : 1,
                      }}
                    >
                      {savingAccount ? "Guardando..." : "Guardar cuenta trial"}
                    </button>
                  </form>
                </div>
              </article>
            </section>
          ) : (
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
          )}

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
        </>
      )}

      {/* ── Feedback tab ── */}
      {!loading && !error && authorized && activeTab === "feedback" && (
        <>
          <section style={{ ...shellCard, padding: "28px 30px 26px", marginBottom: 20 }}>
            <p style={{ margin: "0 0 6px", font: `700 1.05rem/1 ${fd}`, color: "#111827" }}>
              Feedback de usuarios
            </p>
            <p style={{ margin: 0, font: `400 0.875rem/1.6 ${fb}`, color: "#64748B" }}>
              Mensajes enviados desde el dashboard por los dueños de gimnasio.
            </p>
          </section>

          {feedbackRows.length === 0 ? (
            emptyState("Sin feedback todavía", "Cuando algún usuario envíe un mensaje desde el dashboard, va a aparecer acá.")
          ) : (
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {feedbackRows.map(row => (
                <article key={row.id} style={{ ...shellCard, padding: "18px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ margin: 0, font: `700 0.88rem/1 ${fd}`, color: "#111827" }}>
                        {row.gym_name ?? row.email ?? row.gym_id}
                      </p>
                      {row.gym_name && row.email && (
                        <p style={{ margin: "3px 0 0", font: `400 0.78rem/1 ${fb}`, color: "#9CA3AF" }}>{row.email}</p>
                      )}
                    </div>
                    <p style={{ margin: 0, font: `400 0.76rem/1 ${fb}`, color: "#9CA3AF", flexShrink: 0 }}>
                      {formatDate(row.created_at)}
                    </p>
                  </div>
                  <p style={{ margin: 0, font: `400 0.875rem/1.65 ${fb}`, color: "#374151" }}>
                    {row.message}
                  </p>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {/* ── WhatsApp tab ── */}
      {!loading && !error && authorized && activeTab === "whatsapp" && (
        <>
          {/* Connection card */}
          <section style={{ ...shellCard, padding: "28px 30px 26px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
              <div>
                <p style={{ margin: "0 0 4px", font: `700 1.05rem/1 ${fd}`, color: "#111827" }}>
                  WhatsApp de plataforma
                </p>
                <p style={{ margin: 0, font: `400 0.875rem/1.6 ${fb}`, color: "#64748B" }}>
                  Desde acá enviás mensajes a tus clientes FitGrowX (dueños de gym).
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {platWaStatus === "connected" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(22,163,74,0.10)", font: `600 0.8rem/1 ${fd}`, color: "#15803D" }}>
                    <CheckCircle size={13} />
                    Conectado{platWaPhone ? ` · ${platWaPhone}` : ""}
                  </span>
                ) : platWaStatus === "disconnected" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(220,38,38,0.08)", font: `600 0.8rem/1 ${fd}`, color: "#B91C1C" }}>
                    <WifiOff size={13} />
                    Sin conexión
                  </span>
                ) : (
                  <span style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(100,116,139,0.10)", font: `600 0.8rem/1 ${fd}`, color: "#475569" }}>
                    Verificando...
                  </span>
                )}
                <button
                  type="button"
                  onClick={platOpenQr}
                  style={{ padding: "8px 16px", borderRadius: 12, border: "1.5px solid #111827", background: "#111827", color: "#fff", font: `600 0.82rem/1 ${fd}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Smartphone size={14} />
                  {platWaStatus === "connected" ? "Reconectar QR" : "Conectar QR"}
                </button>
              </div>
            </div>
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

          {/* Send individual message */}
          <section style={{ ...shellCard, padding: "28px 30px 26px", marginBottom: 20 }}>
            <p style={{ margin: "0 0 16px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>
              Enviar mensaje
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Número (ej: 5491165909374)"
                value={platSendPhone}
                onChange={e => setPlatSendPhone(e.target.value)}
                style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", background: "#F8FAFC", font: `400 0.9rem/1 ${fb}`, color: "#111827", outline: "none" }}
              />
              <textarea
                rows={4}
                placeholder="Escribí el mensaje..."
                value={platSendMsg}
                onChange={e => setPlatSendMsg(e.target.value)}
                style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.1)", background: "#F8FAFC", font: `400 0.9rem/1.6 ${fb}`, color: "#111827", outline: "none", resize: "vertical" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={platSendMessage}
                  disabled={platSending || platWaStatus !== "connected"}
                  style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: platWaStatus === "connected" ? "#111827" : "#D1D5DB", color: platWaStatus === "connected" ? "#fff" : "#6B7280", font: `600 0.88rem/1 ${fd}`, cursor: platWaStatus === "connected" ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 7 }}
                >
                  {platSending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                  {platSending ? "Enviando..." : "Enviar"}
                </button>
                {platSendResult === "ok" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, font: `500 0.85rem/1 ${fb}`, color: "#15803D" }}>
                    <CheckCircle size={14} /> Enviado
                  </span>
                )}
                {platSendResult === "error" && (
                  <span style={{ font: `500 0.85rem/1 ${fb}`, color: "#B91C1C" }}>Error al enviar</span>
                )}
                {platWaStatus !== "connected" && (
                  <span style={{ font: `400 0.82rem/1 ${fb}`, color: "#9CA3AF" }}>Conectá WhatsApp primero</span>
                )}
              </div>
            </div>
          </section>

          {/* Message templates */}
          <section style={{ ...shellCard, padding: "28px 30px 26px" }}>
            <p style={{ margin: "0 0 4px", font: `700 1rem/1 ${fd}`, color: "#111827" }}>
              Plantillas de mensaje
            </p>
            <p style={{ margin: "0 0 20px", font: `400 0.85rem/1.5 ${fb}`, color: "#64748B" }}>
              Hacé clic en "Usar" para cargar la plantilla en el editor. Variables disponibles: <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 4, fontSize: "0.8em" }}>{"{nombre}"}</code> <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 4, fontSize: "0.8em" }}>{"{dias}"}</code>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(["bienvenida", "onboarding", "trial_vence", "reactivacion"] as const).map(key => {
                const labels = { bienvenida: "Bienvenida", onboarding: "Onboarding (carga inicial)", trial_vence: "Trial por vencer", reactivacion: "Reactivación" };
                return (
                  <div key={key} style={{ background: "#F8FAFC", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(15,23,42,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ margin: 0, font: `700 0.85rem/1 ${fd}`, color: "#374151" }}>{labels[key]}</p>
                      <button
                        type="button"
                        onClick={() => setPlatSendMsg(platMsgTemplate[key])}
                        style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", font: `600 0.78rem/1 ${fd}`, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <MessageCircle size={11} /> Usar
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={platMsgTemplate[key]}
                      onChange={e => setPlatMsgTemplate(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", font: `400 0.82rem/1.55 ${fb}`, color: "#374151", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
