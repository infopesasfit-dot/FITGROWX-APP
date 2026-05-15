"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Copy,
  CreditCard,
  ImagePlus,
  Camera,
  Key,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  Users,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCachedProfile } from "@/lib/gym-cache";
import { useWaSession } from "@/hooks/useWaSession";
import { normalizePhone } from "@/lib/phone";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
const fm = "var(--font-mono, 'JetBrains Mono', monospace)";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";
const ACCENT = "#2563EB";
const ACCENT_DARK = "#1D4ED8";
const ACCENT_SOFT = "rgba(37,99,235,0.08)";

const card = {
  background: "#FFFFFF",
  border: "1px solid rgba(15,23,42,0.06)",
  borderRadius: 22,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  background: "#F8FAFC",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 14,
  font: `400 0.9rem/1 ${fb}`,
  color: t1,
  outline: "none",
  boxSizing: "border-box" as const,
};

const mutedInputStyle = {
  ...inputStyle,
  color: t2,
  background: "#F1F5F9",
};

const tabs = [
  { key: "general",    label: "General" },
  { key: "conexiones", label: "Conexiones" },
  { key: "equipo",     label: "Equipo" },
] as const;

type SettingsTab = typeof tabs[number]["key"];
type StaffMember = { id: string; email: string | null; full_name: string | null };
type LastMonthlyReport = { report_month: string; email: string; created_at: string };

function SectionCard({
  icon,
  title,
  desc,
  actions,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ ...card, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "linear-gradient(145deg, #1A1D23 0%, #2B3441 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {icon}
          </div>
          <div>
            <h2 style={{ font: `800 1rem/1.1 ${fd}`, color: t1, marginBottom: 6 }}>{title}</h2>
            <p style={{ font: `400 0.84rem/1.5 ${fm}`, color: t2, maxWidth: 520 }}>{desc}</p>
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <label style={{ font: `600 0.78rem/1 ${fb}`, color: t1 }}>{label}</label>
      {children}
      {hint && <p style={{ font: `400 0.73rem/1.45 ${fb}`, color: t3 }}>{hint}</p>}
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

function AjustesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchTab = searchParams.get("tab");
  const normalizeTab = (value: string | null): SettingsTab => {
    if (value === "gimnasio") return "general";
    return tabs.some((tab) => tab.key === value) ? (value as SettingsTab) : "general";
  };
  const initialTab = normalizeTab(searchTab);

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [gymName, setGymName] = useState("Power House Gym");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ tone: "success" | "info" | "error"; message: string } | null>(null);
  const [lastMonthlyReport, setLastMonthlyReport] = useState<LastMonthlyReport | null>(null);

  const [gymId, setGymId] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"export" | "confirm">("export");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pagoSound, setPagoSound] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("fitgrowx_pago_sound") !== "off" : true
  );
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    waStatus, waPhone, waBattery, waSignal, waPlugged, waRetries,
    refreshing, panicLoading,
    qrModalOpen, qrImage, qrLoading, qrError, qrAttempt, qrSecondsLeft,
    openQrModal, closeQrModal, disconnectWA,
    handlePanicReconnect, handleRefreshSession,
  } = useWaSession(gymId);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [staffAccessInfo, setStaffAccessInfo] = useState<{ email: string; password: string; loginUrl: string } | null>(null);
  const [staffAccessCopied, setStaffAccessCopied] = useState(false);
  const [hasMercadoPagoLink, setHasMercadoPagoLink] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [showWLModal, setShowWLModal] = useState(false);
  const [wlName,      setWlName]      = useState("");
  const [wlEmail,     setWlEmail]     = useState("");
  const [wlPhone,     setWlPhone]     = useState("");
  const [wlLoading,   setWlLoading]   = useState(false);
  const [wlDone,      setWlDone]      = useState(false);
  const [molineteKeys,       setMolineteKeys]       = useState<{ id: string; label: string; last_used_at: string | null; created_at: string }[]>([]);
  const [molineteLoading,    setMolineteLoading]    = useState(false);
  const [molineteGenerating, setMolineteGenerating] = useState(false);
  const [molineteNewLabel,   setMolineteNewLabel]   = useState("");
  const [molineteRevealKey,  setMolineteRevealKey]  = useState<string | null>(null);
  const [molineteKeyCopied,          setMolineteKeyCopied]          = useState(false);
  const [molineteInstructionsCopied, setMolineteInstructionsCopied] = useState(false);
  const [molineteRevokingId, setMolineteRevokingId] = useState<string | null>(null);
  const [molineteLabelModal, setMolineteLabelModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const loadMolineteKeys = useCallback(async () => {
    setMolineteLoading(true);
    const res = await fetch("/api/admin/molinete-key").catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setMolineteKeys(data.keys ?? []);
    }
    setMolineteLoading(false);
  }, []);

  const handleGenerateKey = async () => {
    setMolineteGenerating(true);
    const res = await fetch("/api/admin/molinete-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: molineteNewLabel.trim() || "Molinete" }),
    }).catch(() => null);
    setMolineteGenerating(false);
    if (!res?.ok) return;
    const data = await res.json();
    setMolineteKeys(prev => [data.meta, ...prev]);
    setMolineteRevealKey(data.key);
    setMolineteKeyCopied(false);
    setMolineteNewLabel("");
    setMolineteLabelModal(false);
  };

  const handleRevokeKey = async (id: string) => {
    setMolineteRevokingId(id);
    await fetch("/api/admin/molinete-key", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    setMolineteKeys(prev => prev.filter(k => k.id !== id));
    setMolineteRevokingId(null);
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setActiveTab(normalizeTab(searchTab));
  }, [searchTab]);

  const activeLogoSrc = logoPreview ?? logoUrl;

  const currentTabMeta = useMemo(() => {
    switch (activeTab) {
      case "conexiones":
        return {
          title: "Canales conectados",
          desc: "Conectá WhatsApp y Mercado Pago para que todo funcione solo.",
        };
      case "equipo":
        return {
          title: "Tu equipo",
          desc: "Agregá personas de confianza para ayudarte a manejar el gym.",
        };
      default:
        return {
          title: "Tu gimnasio",
          desc: "Actualizá el nombre, logo y datos principales de tu gym.",
        };
    }
  }, [activeTab]);

  const previousMonthLabel = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }, []);

  const loadLastMonthlyReport = useCallback(async (gymIdValue: string) => {
    const { data } = await supabase
      .from("monthly_dashboard_reports")
      .select("report_month, email, created_at")
      .eq("gym_id", gymIdValue)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastMonthlyReport((data as LastMonthlyReport | null) ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const cachedProfile = await getCachedProfile();
      if (!cachedProfile) return;

      const gymIdVal = cachedProfile.gymId;
      const userIdVal = cachedProfile.userId;
      setGymId(gymIdVal);

      const [{ data: authData }, { data: profile }, { data: settings }, { data: cuentas }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("gym_id, phone, gyms(trial_expires_at, is_subscription_active, plan_type, subscription_expires_at)")
          .eq("id", userIdVal)
          .maybeSingle(),
        supabase
          .from("gym_settings")
          .select("gym_name, logo_url, instagram_url, accent_color, landing_title, landing_desc, slug, mp_access_token, payment_info")
          .eq("gym_id", gymIdVal)
          .maybeSingle(),
        supabase
          .from("gym_cuentas")
          .select("id")
          .eq("gym_id", gymIdVal)
          .eq("tipo", "mercadopago")
          .eq("activa", true)
          .limit(1),
      ]);

      setEmail(authData.user?.email ?? "");
      setOwnerUserId(userIdVal);
      if ((profile as { phone?: string | null } | null)?.phone) setOwnerPhone((profile as { phone?: string | null }).phone!);
      if (settings?.gym_name) setGymName(settings.gym_name);
      if (settings?.slug) {
        setSlug(settings.slug);
      } else {
        // Auto-generate and persist slug for gyms that don't have one yet
        const base = (settings?.gym_name ?? "gym")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "gym";
        let candidate = base;
        let n = 2;
        for (;;) {
          const { data: taken } = await supabase
            .from("gym_settings")
            .select("gym_id")
            .eq("slug", candidate)
            .neq("gym_id", gymIdVal)
            .maybeSingle();
          if (!taken) break;
          candidate = `${base}-${n++}`;
        }
        setSlug(candidate);
        await supabase
          .from("gym_settings")
          .upsert({ gym_id: gymIdVal, slug: candidate }, { onConflict: "gym_id" });
      }
      if (settings?.logo_url) setLogoUrl(settings.logo_url);
      if (settings?.instagram_url) setInstagramUrl(settings.instagram_url);
      if (settings?.mp_access_token) setMpToken(settings.mp_access_token);
      if (settings?.payment_info) setPaymentInfo(settings.payment_info);
      setHasMercadoPagoLink(Boolean(cuentas && cuentas.length > 0));
      fetch("/api/gym/webhook-url").then(r => r.json()).then(d => { if (d.url) setWebhookUrl(d.url); }).catch(() => {});
      loadMolineteKeys();

      const gym = Array.isArray(profile?.gyms) ? profile?.gyms[0] : profile?.gyms;
      if (gym) {
        setIsSubscriptionActive(Boolean(gym.is_subscription_active));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSubscriptionExpiresAt((gym as any).subscription_expires_at ?? null);
        if (gym.trial_expires_at) {
          setTrialExpiresAt(gym.trial_expires_at);
          const diff = new Date(gym.trial_expires_at).getTime() - Date.now();
          const left = Math.max(0, Math.ceil(diff / 86_400_000));
          setTrialDaysLeft(left);
          setIsTrial(!gym.is_subscription_active && left > 0);
        }
      }

      void loadLastMonthlyReport(gymIdVal);

      // Cargar ref_code para el link de referidos
      supabase
        .from("platform_accounts")
        .select("ref_code")
        .eq("auth_user_id", userIdVal)
        .maybeSingle()
        .then(({ data: pa }) => { if (pa?.ref_code) setRefCode(pa.ref_code); });

      fetch("/api/admin/staff")
        .then((response) => response.json())
        .then((data) => {
          if (data.staff) setStaffList(data.staff);
        })
        .finally(() => setStaffLoading(false));
    })();
  }, [loadLastMonthlyReport]);

  const handleDeleteGym = async () => {
    if (deleteConfirm !== gymName) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/gym/delete", { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setDeleteError(d.error ?? "Error al eliminar."); setDeleting(false); return; }
      await supabase.auth.signOut();
      router.push("/start");
    } catch {
      setDeleteError("Error de conexión. Intentá de nuevo.");
      setDeleting(false);
    }
  };

  const handleSaveGym = async () => {
    if (!gymId) return;
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug.trim() && cleanSlug !== slug.trim()) {
      setSlug(cleanSlug);
    }
    if (cleanSlug) {
      const { data: existing } = await supabase.from("gym_settings").select("gym_id").eq("slug", cleanSlug).neq("gym_id", gymId).maybeSingle();
      if (existing) { setSlugError("Este link ya está en uso. Elegí otro."); return; }
    }
    setSlugError("");
    await supabase.from("gyms").update({ name: gymName }).eq("id", gymId);
    await supabase.from("gym_settings").upsert({ gym_id: gymId, gym_name: gymName, slug: cleanSlug || null, instagram_url: instagramUrl.trim() || null, mp_access_token: mpToken.trim() || null, payment_info: paymentInfo.trim() || null }, { onConflict: "gym_id" });
    if (ownerUserId && ownerPhone.trim()) {
      await supabase.from("profiles").update({ phone: normalizePhone(ownerPhone.trim()) }).eq("id", ownerUserId);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleSendMonthlyReport = async () => {
    setReportSending(true);
    setReportStatus(null);
    try {
      const response = await fetch("/api/admin/monthly-dashboard-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setReportStatus({ tone: "error", message: data.error ?? "No se pudo enviar el reporte." });
      } else if (data.alreadySent) {
        setReportStatus({ tone: "info", message: data.message ?? "Ese reporte ya fue enviado." });
      } else {
        setReportStatus({ tone: "success", message: data.message ?? "Reporte enviado correctamente." });
      }
      if (gymId) {
        await loadLastMonthlyReport(gymId);
      }
    } catch {
      setReportStatus({ tone: "error", message: "No se pudo enviar el reporte." });
    } finally {
      setReportSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("El archivo no puede superar 2 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLogoError("Solo se aceptan imágenes PNG, JPG, SVG o WEBP.");
      return;
    }
    setLogoError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !gymId) return;
    setUploading(true);
    setLogoError(null);
    try {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const path = `${gymId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("gym-logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("gym-logos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await supabase.from("gym_settings").upsert({ gym_id: gymId, logo_url: publicUrl }, { onConflict: "gym_id" });

      setLogoUrl(publicUrl);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2200);
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "No se pudo subir el logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!gymId) return;
    await supabase.from("gym_settings").update({ logo_url: null }).eq("gym_id", gymId);
    setLogoUrl(null);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateStaff = async () => {
    setStaffError(null);
    if (!staffEmail.trim() || !staffPassword) {
      setStaffError("Email y contraseña son obligatorios.");
      return;
    }

    setStaffSaving(true);
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: staffEmail.trim(),
        password: staffPassword,
        full_name: staffName.trim() || undefined,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setStaffError(data.error ?? "No se pudo crear la cuenta.");
      setStaffSaving(false);
      return;
    }

    setStaffList((prev) => [
      ...prev,
      { id: data.id, email: staffEmail.trim(), full_name: staffName.trim() || null },
    ]);
    setStaffAccessInfo({
      email: staffEmail.trim(),
      password: staffPassword,
      loginUrl: typeof window !== "undefined" ? `${window.location.origin}/start?login=1` : "/start?login=1",
    });
    setStaffAccessCopied(false);
    setStaffEmail("");
    setStaffPassword("");
    setStaffName("");
    setStaffSaving(false);
    setStaffModalOpen(false);
  };

  const handleCopyStaffAccess = async () => {
    if (!staffAccessInfo) return;
    const accessText = [
      "Acceso staff FitGrowX",
      `Ingresar desde: ${staffAccessInfo.loginUrl}`,
      `Email: ${staffAccessInfo.email}`,
      `Contraseña: ${staffAccessInfo.password}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(accessText);
      setStaffAccessCopied(true);
      window.setTimeout(() => setStaffAccessCopied(false), 1800);
    } catch {
      setStaffAccessCopied(false);
    }
  };

  const buildStaffAccessText = (access: { email: string; password: string; loginUrl: string }) =>
    [
      "Hola. Ya está lista tu cuenta de staff en FitGrowX.",
      "",
      `Ingresá desde: ${access.loginUrl}`,
      `Email: ${access.email}`,
      `Contraseña inicial: ${access.password}`,
      "",
      "Una vez dentro, podés cambiar la contraseña si querés.",
    ].join("\n");

  const handleShareStaffByWhatsApp = () => {
    if (!staffAccessInfo) return;
    const text = buildStaffAccessText(staffAccessInfo);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const handleShareStaffByEmail = () => {
    if (!staffAccessInfo) return;
    const subject = "Tu acceso de staff a FitGrowX";
    const body = buildStaffAccessText(staffAccessInfo);
    window.location.href = `mailto:${encodeURIComponent(staffAccessInfo.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleDeleteStaff = async (id: string) => {
    setDeletingId(id);
    await fetch("/api/admin/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStaffList((prev) => prev.filter((member) => member.id !== id));
    setDeletingId(null);
  };


  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section
          style={{
            ...card,
            padding: 28,
            background: "linear-gradient(140deg, #FFFFFF 0%, #F8FAFC 48%, #EEF4FF 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -80, left: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,23,42,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 700 }}>
                <h1 style={{ font: `800 1.6rem/1.1 ${fd}`, color: t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
                  {currentTabMeta.title}
                </h1>
                <p style={{ font: `400 0.88rem/1.5 ${fb}`, color: t2 }}>
                  {currentTabMeta.desc}
                </p>
              </div>

            </div>

          </div>
        </section>

        {activeTab === "general" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Building2 size={18} color="white" />}
              title="Datos del gym"
              desc="El nombre y la info que tus alumnos van a ver."
              actions={
                <button
                  onClick={handleSaveGym}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(37,99,235,0.16)",
                    background: "rgba(37,99,235,0.08)",
                    color: ACCENT,
                    font: `700 0.8rem/1 ${fd}`,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Save size={13} />
                  {saved ? "Guardado ✓" : "Guardar"}
                </button>
              }
            >
              <div style={{ display: "grid", gap: isMobile ? 14 : 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 200px", gap: 14 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <Field label="Nombre del gimnasio">
                      <input value={gymName} onChange={(event) => setGymName(event.target.value)} maxLength={100} style={inputStyle} />
                    </Field>

                    <Field label="Email de acceso" hint="El cambio de email se gestiona desde autenticación, por eso hoy lo mostramos como referencia.">
                      <input value={email} readOnly style={mutedInputStyle} />
                    </Field>

                    <Field label="Tu número de WhatsApp para alertas" hint="Con código de país, sin espacios. Ej: 5491165909374. Si usás este número también para el WhatsApp del gym, las alertas llegan solo por notificación en el dashboard.">
                      <input
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value.replace(/[^\d+]/g, ""))}
                        placeholder="5491165909374"
                        maxLength={30}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Link de tu landing" hint="Solo letras, números y guiones. Este link se incluye automáticamente en los mensajes de WhatsApp de seguimiento.">
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 0, border: `1.5px solid ${slugError ? "#EF4444" : "rgba(15,23,42,0.12)"}`, borderRadius: 10, overflow: "hidden", background: "white" }}>
                          <span style={{ padding: "10px 10px 10px 13px", fontSize: "0.82rem", color: t3, whiteSpace: "nowrap", borderRight: "1px solid rgba(15,23,42,0.08)", background: "#F8FAFC" }}>fitgrowx.com/gym/</span>
                          <input
                            value={slug}
                            onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
                            placeholder="mi-gimnasio"
                            style={{ ...inputStyle, border: "none", borderRadius: 0, flex: 1, outline: "none", padding: "10px 12px" }}
                          />
                        </div>
                        {slugError && <span style={{ fontSize: "0.77rem", color: "#EF4444", fontWeight: 600 }}>{slugError}</span>}
                        {slug && !slugError && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "0.77rem", color: "#16A34A", fontWeight: 600 }}>✓ Tu link público:</span>
                            <a href={`/gym/${slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.77rem", color: ACCENT, fontWeight: 600, textDecoration: "none" }}>
                              fitgrowx.com/gym/{slug} →
                            </a>
                          </div>
                        )}
                      </div>
                    </Field>

                  </div>

                  <div style={{ padding: "12px", borderRadius: 14, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)", display: "grid", gap: 10, alignContent: "start", justifyItems: isMobile ? "stretch" : "start" }}>
                    <p style={{ font: `700 0.78rem/1 ${fd}`, color: t1 }}>Logo del gimnasio</p>
                    <div style={{ width: 68, height: 68, borderRadius: 14, border: "1px dashed rgba(15,23,42,0.12)", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", justifySelf: isMobile ? "center" : "start" }}>
                      {activeLogoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeLogoSrc} alt="Logo preview" style={{ maxWidth: "84%", maxHeight: "84%", objectFit: "contain" }} />
                      ) : (
                        <ImagePlus size={20} color={t3} />
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%" }}>
                      <label
                        htmlFor="logo-file-input"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "9px 12px",
                          borderRadius: 12,
                          cursor: "pointer",
                          background: "white",
                          border: "1px solid rgba(15,23,42,0.08)",
                          font: `700 0.77rem/1 ${fd}`,
                          color: t1,
                        }}
                      >
                        <Upload size={13} />
                        Cambiar
                      </label>
                      <input
                        ref={fileInputRef}
                        id="logo-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                      />
                      {logoFile && (
                        <button
                          onClick={handleLogoUpload}
                          disabled={uploading}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "9px 12px",
                            borderRadius: 12,
                            border: "none",
                            background: uploading ? "#D1D5DB" : ACCENT,
                            color: "white",
                            font: `800 0.77rem/1 ${fd}`,
                            cursor: "pointer",
                          }}
                        >
                          <Save size={13} />
                          {uploading ? "Subiendo..." : "Guardar"}
                        </button>
                      )}
                      {logoUrl && !logoFile && (
                        <button
                          onClick={handleLogoRemove}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "9px 12px",
                            borderRadius: 12,
                            background: "rgba(239,68,68,0.05)",
                            color: "#DC2626",
                            border: "1px solid rgba(239,68,68,0.16)",
                            font: `700 0.77rem/1 ${fd}`,
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={13} />
                          Quitar
                        </button>
                      )}
                    </div>

                    <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: t3 }}>
                      PNG, JPG, SVG o WEBP. Máximo 2 MB.
                    </p>
                    {logoSaved && <p style={{ font: `700 0.76rem/1 ${fb}`, color: "#16A34A" }}>✓ Logo guardado correctamente</p>}
                    {logoError && <p style={{ font: `600 0.76rem/1.4 ${fb}`, color: "#DC2626" }}>{logoError}</p>}
                  </div>
                </div>

                <div style={{ padding: "16px 18px", borderRadius: 16, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Seguridad de la cuenta</p>
                    <p style={{ font: `400 0.75rem/1.45 ${fb}`, color: t2 }}>Protegé el acceso principal del negocio.</p>
                  </div>
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#FFFFFF",
                      color: t2,
                      border: "1px solid rgba(15,23,42,0.08)",
                      padding: "10px 14px",
                      borderRadius: 12,
                      font: `700 0.78rem/1 ${fd}`,
                      cursor: "pointer",
                    }}
                  >
                    <Lock size={13} />
                    Cambiar contraseña
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div style={{ padding: "16px 18px", borderRadius: 16, background: "linear-gradient(180deg, #FFFDF9 0%, #FFF7EF 100%)", border: "1px solid rgba(255,122,24,0.10)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Reporte mensual del dashboard</p>
                    <p style={{ font: `400 0.75rem/1.5 ${fb}`, color: t2, maxWidth: 520 }}>
                      Cada primer día del mes te vamos a enviar el resumen de <span style={{ color: ACCENT_DARK, fontWeight: 700 }}>{previousMonthLabel}</span> por email y además te va a aparecer el aviso dentro del sistema.
                    </p>
                    {lastMonthlyReport && (
                      <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                        <p style={{ font: `600 0.73rem/1.45 ${fb}`, color: t1 }}>
                          Último reporte enviado:{" "}
                          <span style={{ color: ACCENT_DARK }}>
                            {new Date(`${lastMonthlyReport.report_month}T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                          </span>
                        </p>
                        <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: t3 }}>
                          Salió el {new Date(lastMonthlyReport.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })} a {lastMonthlyReport.email}
                        </p>
                      </div>
                    )}
                    {reportStatus && (
                      <p
                        style={{
                          marginTop: 10,
                          font: `600 0.74rem/1.45 ${fb}`,
                          color: reportStatus.tone === "success" ? "#166534" : reportStatus.tone === "info" ? ACCENT_DARK : "#DC2626",
                        }}
                      >
                        {reportStatus.message}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleSendMonthlyReport}
                    disabled={reportSending}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      background: reportSending ? "#D1D5DB" : "#FFFFFF",
                      color: reportSending ? "#6B7280" : ACCENT_DARK,
                      border: "1px solid rgba(255,122,24,0.14)",
                      padding: "10px 14px",
                      borderRadius: 12,
                      font: `800 0.78rem/1 ${fd}`,
                      cursor: reportSending ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Mail size={13} />
                    {reportSending ? "Enviando..." : "Enviar reporte ahora"}
                  </button>
                </div>

                {/* ── Suscripción ── */}
                {(() => {
                  const trialExpired = trialExpiresAt ? new Date(trialExpiresAt) < new Date() : false;
                  const statusColor = isSubscriptionActive ? "#15803D" : trialExpired ? "#DC2626" : "#C2410C";
                  const statusBg    = isSubscriptionActive ? "rgba(22,163,74,0.06)" : trialExpired ? "rgba(220,38,38,0.06)" : "rgba(249,115,22,0.06)";
                  const statusBorder = isSubscriptionActive ? "rgba(22,163,74,0.18)" : trialExpired ? "rgba(220,38,38,0.18)" : "rgba(249,115,22,0.18)";
                  const expLabel = isSubscriptionActive && subscriptionExpiresAt
                    ? `Válido hasta ${new Date(subscriptionExpiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`
                    : trialExpiresAt && !trialExpired
                    ? `Prueba vence el ${new Date(trialExpiresAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`
                    : trialExpired ? "Tu período de prueba venció" : null;
                  return (
                    <div style={{ padding: "14px 16px", borderRadius: 16, background: statusBg, border: `1px solid ${statusBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ font: `700 0.84rem/1 ${fd}`, color: statusColor, marginBottom: 3 }}>
                          {isSubscriptionActive ? "Plan activo — FitGrowX Crecimiento" : trialExpired ? "Prueba vencida" : `${trialDaysLeft ?? "—"} días de prueba restantes`}
                        </p>
                        {expLabel && <p style={{ font: `400 0.74rem/1.4 ${fb}`, color: t2 }}>{expLabel}</p>}
                      </div>
                      <Link
                        href="/dashboard/planes"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 14px", borderRadius: 10, textDecoration: "none",
                          background: isSubscriptionActive ? "rgba(22,163,74,0.10)" : "rgba(249,115,22,0.10)",
                          color: isSubscriptionActive ? "#15803D" : "#C2410C",
                          font: `700 0.76rem/1 ${fd}`, whiteSpace: "nowrap",
                        }}
                      >
                        <CreditCard size={12} />
                        {isSubscriptionActive ? "Ver plan" : "Activar plan"}
                      </Link>
                    </div>
                  );
                })()}
              </div>
            </SectionCard>

            {/* ── Sonido de pago ── */}
            <div style={{ border: "1px solid rgba(15,23,42,0.07)", borderRadius: 22, padding: "20px 24px", background: "#FAFBFC" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Sonido al recibir un pago</p>
                  <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2 }}>
                    Suena un ca-ching cuando MercadoPago confirma un pago. Desactivalo si estás con música.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !pagoSound;
                    setPagoSound(next);
                    localStorage.setItem("fitgrowx_pago_sound", next ? "on" : "off");
                  }}
                  style={{
                    flexShrink: 0,
                    width: 44, height: 24, borderRadius: 9999,
                    background: pagoSound ? "#16A34A" : "#D1D5DB",
                    border: "none", cursor: "pointer",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3,
                    left: pagoSound ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            </div>

            {/* ── Exportar datos ── */}
            <div style={{ border: "1px solid rgba(15,23,42,0.07)", borderRadius: 22, padding: "20px 24px", background: "#FAFBFC" }}>
              <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Exportar mis datos</p>
              <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2, marginBottom: 14 }}>
                Tus datos son tuyos. Descargalos en cualquier momento para migrar, hacer backup o llevarlos a otro sistema.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                <a
                  href="/api/user/export-data?format=xlsx"
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: `1px solid ${ACCENT}22`, background: ACCENT_SOFT, color: ACCENT, font: `700 0.8rem/1 ${fd}`, textDecoration: "none", whiteSpace: "nowrap" as const }}
                >
                  Exportar Todo (Excel)
                </a>
                <a
                  href="/api/user/export-alumnos-csv"
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "white", color: t2, font: `600 0.8rem/1 ${fd}`, textDecoration: "none", whiteSpace: "nowrap" as const }}
                >
                  Alumnos (CSV)
                </a>
                <a
                  href="/api/user/export-data"
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "white", color: t3, font: `500 0.78rem/1 ${fd}`, textDecoration: "none", whiteSpace: "nowrap" as const }}
                >
                  Todo (JSON)
                </a>
              </div>
            </div>

            {/* ── Zona de peligro ── */}
            <div style={{ border: "1px solid rgba(220,38,38,0.18)", borderRadius: 22, padding: "20px 24px", background: "rgba(220,38,38,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
                <div>
                  <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#DC2626", marginBottom: 4 }}>Eliminar cuenta</p>
                  <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2, maxWidth: 460 }}>
                    Borra permanentemente el gym, todos los alumnos, pagos, automatizaciones y datos asociados. Esta acción <strong>no se puede deshacer</strong>.
                  </p>
                </div>
                <button
                  onClick={() => { setDeleteModalOpen(true); setDeleteStep("export"); setDeleteConfirm(""); setDeleteError(null); }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.30)", background: "rgba(220,38,38,0.06)", color: "#DC2626", font: `700 0.8rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                  Eliminar cuenta
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "conexiones" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Smartphone size={18} color="white" />}
              title="Tus canales"
              desc="Conectá las herramientas que usás para cobrar y comunicarte."
            >
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  {
                    key: "wa",
                    icon: <Smartphone size={18} color={waStatus === "connected" ? ACCENT : waStatus === "needs_reauth" ? "#DC2626" : waRetries > 0 ? "#B45309" : t3} />,
                    title: "WhatsApp",
                    description:
                      waStatus === "connected"
                        ? `${waPhone ? waPhone : "Conectado"}${waBattery !== null ? ` · ${waBattery}% batería` : ""}${waSignal !== null ? ` · señal ${waSignal}/4` : ""}${waPlugged ? " · cargando" : ""}`
                        : waStatus === "needs_reauth"
                        ? "La sesión venció o fue cerrada desde el teléfono. Necesitás vincular de nuevo."
                        : waRetries > 0
                        ? "Reintentando reconectar... Si tu teléfono perdió internet, revisalo."
                        : "Escaneá el QR para activar los mensajes automáticos.",
                    badge: waStatus === "connected"
                      ? { label: "Conexión estable", bg: "rgba(34,197,94,0.10)", color: "#15803D" }
                      : waStatus === "needs_reauth"
                      ? { label: "Acción requerida", bg: "rgba(239,68,68,0.10)", color: "#DC2626" }
                      : waRetries > 0
                      ? { label: "Reintentando...", bg: "rgba(234,179,8,0.10)", color: "#92400E" }
                      : { label: "Desconectado", bg: "#F1F5F9", color: t2 },
                    action: waStatus === "connected" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button
                          onClick={handleRefreshSession}
                          disabled={refreshing}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "white", color: t2, font: `700 0.78rem/1 ${fd}`, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}
                        >
                          <RefreshCw size={13} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
                          {refreshing ? "Actualizando..." : "Refrescar"}
                        </button>
                        <button
                          onClick={disconnectWA}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.18)", background: "white", color: "#DC2626", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                        >
                          <X size={13} />
                          Desvincular
                        </button>
                      </div>
                    ) : waRetries > 0 ? (
                      <button
                        onClick={handleRefreshSession}
                        disabled={refreshing}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(234,179,8,0.24)", background: "rgba(234,179,8,0.08)", color: "#92400E", font: `800 0.78rem/1 ${fd}`, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}
                      >
                        <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
                        {refreshing ? "Reconectando..." : "Refrescar sesión"}
                      </button>
                    ) : (
                      <button
                        onClick={openQrModal}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)", color: "white", font: `800 0.78rem/1 ${fd}`, cursor: "pointer" }}
                      >
                        <Smartphone size={14} />
                        Vincular
                      </button>
                    ),
                  },
                  {
                    key: "gmail",
                    icon: <Mail size={18} color={t3} />,
                    title: "Gmail",
                    description: "Preparado para futura integración de envío y bandeja. Hoy no hay backend activo.",
                    badge: { label: "Próximamente", bg: "#F1F5F9", color: t2 },
                    action: (
                      <button disabled style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#E5E7EB", color: "#6B7280", font: `700 0.78rem/1 ${fd}`, cursor: "not-allowed" }}>
                        Próximamente
                      </button>
                    ),
                  },
                  {
                    key: "ig",
                    icon: <Camera size={18} color={instagramUrl ? "#E1306C" : t3} />,
                    title: "Instagram",
                    description: instagramUrl ? instagramUrl : "Vinculá tu perfil para mostrarlo en tu landing y automatizaciones.",
                    badge: instagramUrl ? { label: "Vinculado", bg: "rgba(225,48,108,0.08)", color: "#E1306C" } : { label: "Sin vincular", bg: "#F1F5F9", color: t2 },
                    action: (
                      <div style={{ position: "relative" }}>
                        <Camera size={14} color={t3} style={{ position: "absolute", top: 12, left: 12 }} />
                        <input
                          value={instagramUrl}
                          onChange={e => setInstagramUrl(e.target.value)}
                          onBlur={handleSaveGym}
                          placeholder="@tugym"
                          maxLength={200}
                          style={{ ...inputStyle, paddingLeft: 36, width: 200, fontSize: "0.78rem" }}
                        />
                      </div>
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: "16px 18px",
                      borderRadius: 18,
                      background: "#F8FAFC",
                      border: "1px solid rgba(15,23,42,0.06)",
                      display: "grid",
                      gridTemplateColumns: isMobile ? "44px minmax(0, 1fr)" : "44px minmax(0, 1fr) auto",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: "white", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(15,23,42,0.06)" }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                        <p style={{ font: `800 0.86rem/1 ${fd}`, color: t1 }}>{item.title}</p>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", borderRadius: 9999, background: item.badge.bg, color: item.badge.color, font: `700 0.68rem/1 ${fb}` }}>
                          {item.badge.label}
                        </span>
                      </div>
                      <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: t2 }}>{item.description}</p>
                    </div>
                    <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>{item.action}</div>
                  </div>
                ))}
              </div>
              {waStatus === "needs_reauth" && (
                <div style={{ marginTop: 12, padding: "20px 20px", borderRadius: 18, background: "rgba(239,68,68,0.05)", border: "2px solid rgba(239,68,68,0.22)", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <WifiOff size={20} color="#DC2626" />
                    <p style={{ font: `800 0.88rem/1 ${fd}`, color: "#DC2626" }}>Tu WhatsApp se desconectó</p>
                  </div>
                  <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: "#7F1D1D", maxWidth: 340 }}>
                    El sistema intentó reconectar pero no pudo. Tocá el botón para restaurar la conexión en segundos.
                  </p>
                  <button
                    onClick={handlePanicReconnect}
                    disabled={panicLoading}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 10,
                      padding: "14px 28px", borderRadius: 14, border: "none",
                      background: panicLoading ? "#9CA3AF" : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                      color: "white", font: `800 0.95rem/1 ${fd}`,
                      cursor: panicLoading ? "not-allowed" : "pointer",
                      boxShadow: panicLoading ? "none" : "0 4px 14px rgba(239,68,68,0.35)",
                      transition: "all 0.15s",
                      width: "100%", justifyContent: "center",
                    }}
                  >
                    <RefreshCw size={17} style={panicLoading ? { animation: "spin 1s linear infinite" } : undefined} />
                    {panicLoading ? "Reconectando... esperá unos segundos" : "Re-vincular WhatsApp ahora"}
                  </button>
                </div>
              )}
              {waStatus !== "connected" && waStatus !== "needs_reauth" && waRetries >= 3 && (
                <div style={{ marginTop: 10, padding: "14px 16px", borderRadius: 16, background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.22)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ font: `400 0.79rem/1.5 ${fb}`, color: "#92400E" }}>
                    Parece que tu teléfono perdió internet. Revisalo para seguir enviando mensajes automáticos.
                  </p>
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<CreditCard size={18} color="white" />}
              title="Mercado Pago"
              desc="Conectá tu cuenta para generar links de cobro para tus alumnos."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Clave de conexión</span>
                    <p style={{ font: `400 0.68rem/1.3 ${fb}`, color: t3, marginTop: 3 }}>La genera MercadoPago y la pegás acá una sola vez.</p>
                  </div>
                  {mpToken ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 0.68rem/1 ${fb}`, color: "#16A34A", background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.18)", padding: "3px 9px", borderRadius: 9999 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
                      Conectado
                    </span>
                  ) : (
                    <span style={{ font: `600 0.68rem/1 ${fb}`, color: t3 }}>Desconectado</span>
                  )}
                </div>

                <div style={{ background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.07)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ font: `600 0.72rem/1 ${fb}`, color: t2, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Cómo conectar tu cuenta</p>
                  {[
                    { n: "1", text: "Entrá a mercadopago.com.ar con la cuenta de tu negocio" },
                    { n: "2", text: 'En el menú, buscá "Tu negocio" → "Herramientas para desarrolladores" → "Panel de desarrolladores"' },
                    { n: "3", text: 'Hacé click en "Crear aplicación" (o elegí una que ya tengas)' },
                    { n: "4", text: 'Andá a "Credenciales de producción" y copiá el texto largo que empieza con APP_USR-' },
                    { n: "5", text: "Pegalo en el campo de abajo y guardá — listo, ya podés cobrar online" },
                  ].map(step => (
                    <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#009EE3", color: "white", font: `700 0.65rem/1 ${fb}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{step.n}</span>
                      <span style={{ font: `400 0.78rem/1.45 ${fb}`, color: t2 }}>{step.text}</span>
                    </div>
                  ))}
                  <a href="https://www.mercadopago.com.ar/developers/panel" target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2, padding: "8px 14px", background: "#009EE3", borderRadius: 9, font: `700 0.75rem/1 ${fb}`, color: "white", textDecoration: "none", width: "fit-content" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Ir al panel de desarrolladores
                  </a>
                </div>

                <div style={{ position: "relative" }}>
                  <CreditCard size={15} color={t3} style={{ position: "absolute", top: 14, left: 14 }} />
                  <input
                    value={mpToken}
                    onChange={(event) => setMpToken(event.target.value)}
                    placeholder="Pegá acá tu clave (empieza con APP_USR-...)"
                    type="password"
                    autoComplete="off"
                    style={{ ...inputStyle, paddingLeft: 40 }}
                  />
                </div>
                <p style={{ font: `400 0.7rem/1.4 ${fb}`, color: t3 }}>
                  Tu token se guarda de forma segura y solo se usa para generar links de pago.
                </p>

                {webhookUrl && (
                  <div style={{ background: "#F0FDF4", border: "1px solid rgba(22,163,74,0.20)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ font: `600 0.72rem/1 ${fb}`, color: "#15803D", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                      URL de webhook para MercadoPago
                    </p>
                    <p style={{ font: `400 0.7rem/1.4 ${fb}`, color: "#166534" }}>
                      Pegá esta URL en tu aplicación de MP → Webhooks → Notificaciones de pagos.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid rgba(22,163,74,0.15)", borderRadius: 8, padding: "8px 12px" }}>
                      <code style={{ font: `500 0.68rem/1.4 ${fb}`, color: "#15803D", flex: 1, wordBreak: "break-all" as const }}>
                        {webhookUrl}
                      </code>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(webhookUrl); }}
                        style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(22,163,74,0.25)", background: "white", color: "#15803D", font: `600 0.7rem/1 ${fb}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSaveGym}
                  disabled={saved}
                  style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, border: "none", background: saved ? "#E5E7EB" : ACCENT, color: saved ? t2 : "white", font: `700 0.82rem/1 ${fd}`, cursor: saved ? "default" : "pointer", transition: "all 0.2s" }}
                >
                  {saved ? "Guardado ✓" : "Guardar token"}
                </button>

                <div style={{ borderTop: "1px solid rgba(15,23,42,0.07)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <span style={{ font: `500 0.78rem/1 ${fb}`, color: t2 }}>Datos de pago alternativos</span>
                    <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: t3, margin: "4px 0 0" }}>CBU, alias, efectivo u otro método. El alumno lo ve en su panel al renovar.</p>
                  </div>
                  <textarea
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    placeholder={"CBU: 0000003100012345678901\nAlias: gimnasio.nombre\nEfectivo: pagá en recepción de lunes a viernes."}
                    rows={4}
                    maxLength={500}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: fb, lineHeight: 1.5 }}
                  />
                  <button
                    onClick={handleSaveGym}
                    disabled={saved}
                    style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 12, border: "none", background: saved ? "#E5E7EB" : ACCENT, color: saved ? t2 : "white", font: `700 0.82rem/1 ${fd}`, cursor: saved ? "default" : "pointer", transition: "all 0.2s" }}
                  >
                    {saved ? "Guardado ✓" : "Guardar"}
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Molinete / Control de acceso */}
            <SectionCard
              icon={<Key size={18} color="white" />}
              title="Molinete / Control de acceso"
              desc="Generá una API key para conectar tu molinete o lector de QR. El dispositivo la usa para validar membresías y registrar asistencias en tiempo real."
              actions={
                <button
                  onClick={() => setMolineteLabelModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: ACCENT, color: "white", border: "none", font: `700 0.78rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  + Nueva key
                </button>
              }
            >
              {molineteLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: t3, font: `400 0.82rem/1 ${fb}` }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Cargando...
                </div>
              ) : molineteKeys.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                    <Key size={20} color={t3} />
                  </div>
                  <p style={{ font: `500 0.82rem/1.5 ${fb}`, color: t3, margin: 0 }}>
                    No hay keys activas.<br />Generá una para conectar tu molinete.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {molineteKeys.map(k => (
                    <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.07)", borderRadius: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ font: `600 0.85rem/1 ${fd}`, color: t1, margin: 0 }}>{k.label}</p>
                        <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, margin: "4px 0 0" }}>
                          Creada {new Date(k.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                          {k.last_used_at
                            ? ` · Último uso ${new Date(k.last_used_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`
                            : " · Nunca usada"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        disabled={molineteRevokingId === k.id}
                        style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(220,38,38,0.07)", color: "#DC2626", border: "none", font: `600 0.72rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap", opacity: molineteRevokingId === k.id ? 0.5 : 1 }}
                      >
                        {molineteRevokingId === k.id ? "Revocando..." : "Revocar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, padding: "12px 14px", background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.07)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <MessageCircle size={15} color={t3} style={{ flexShrink: 0 }} />
                <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2, margin: 0 }}>
                  Al generar una key, el sistema te da un mensaje listo para mandarle a tu técnico con todo lo que necesita para configurar el molinete.
                </p>
              </div>
            </SectionCard>

            {/* Link de referidos */}
            <SectionCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
              title="Tu link de referidos"
              desc="Compartí este link con otros dueños de gym. Ganás 1 mes gratis cada vez que alguien que te recomendaste pague su primera suscripción."
            >
              {refCode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "10px 14px" }}>
                    <span style={{ flex: 1, font: `500 0.82rem/1 ${fd}`, color: t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      fitgrowx.com/start?ref={refCode}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://fitgrowx.com/start?ref=${refCode}`);
                        setRefCopied(true);
                        setTimeout(() => setRefCopied(false), 2000);
                      }}
                      style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 9, border: "none", background: refCopied ? "#DCFCE7" : ACCENT_SOFT, color: refCopied ? "#15803D" : ACCENT, font: `700 0.75rem/1 ${fd}`, cursor: "pointer", transition: "all .15s" }}
                    >
                      {refCopied ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <p style={{ font: `400 0.75rem/1.5 ${fd}`, color: t3, margin: 0 }}>
                    Cada gym que se registre con tu link y pague su primer mes te extiende la suscripción 1 mes automáticamente. Sin límite de referidos.
                  </p>
                </div>
              ) : (
                <p style={{ font: `400 0.8rem/1.5 ${fd}`, color: t3, margin: 0 }}>Cargando tu link...</p>
              )}
            </SectionCard>
          </div>
        )}

        {activeTab === "equipo" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Users size={18} color="white" />}
              title="Quién puede entrar"
              desc="Creá cuentas de staff para recepción o entrenadores. Cada miembro entra con su propio email y contraseña desde el mismo botón Entrar."
              actions={
                <button
                  onClick={() => { setStaffError(null); setStaffModalOpen(true); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "linear-gradient(135deg, #1D4ED8, #2563EB)",
                    color: "white",
                    border: "none",
                    padding: "11px 16px",
                    borderRadius: 14,
                    font: `800 0.82rem/1 ${fd}`,
                    cursor: "pointer",
                    boxShadow: "0 10px 24px rgba(37,99,235,0.18)",
                  }}
                >
                  <UserPlus size={14} />
                  Agregar Miembro
                </button>
              }
            >
              <div
                style={{
                  marginBottom: 14,
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "linear-gradient(180deg, rgba(37,99,235,0.06), rgba(37,99,235,0.03))",
                  border: "1px solid rgba(37,99,235,0.14)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ font: `800 0.84rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Cómo entra el staff</p>
                    <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2 }}>
                      1. Creás el usuario acá. 2. Le compartís email y contraseña. 3. Ingresa desde <span style={{ color: ACCENT, fontWeight: 700 }}>Entrar</span> en <span style={{ color: ACCENT, fontWeight: 700 }}>/start?login=1</span>.
                    </p>
                  </div>
                  <Link
                    href="/start?login=1"
                    target="_blank"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(37,99,235,0.16)",
                      background: "white",
                      color: ACCENT_DARK,
                      font: `800 0.78rem/1 ${fd}`,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Ver acceso staff
                    <ChevronRight size={14} />
                  </Link>
                </div>
                {staffAccessInfo && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: "white",
                      border: "1px solid rgba(37,99,235,0.12)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <p style={{ font: `800 0.79rem/1 ${fd}`, color: t1 }}>Último acceso creado</p>
                      <button
                        onClick={handleCopyStaffAccess}
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "9px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(15,23,42,0.08)",
                          background: staffAccessCopied ? "rgba(22,163,74,0.08)" : "#F8FAFC",
                          color: staffAccessCopied ? "#166534" : t2,
                          font: `700 0.76rem/1 ${fd}`,
                          cursor: "pointer",
                        }}
                      >
                        <Copy size={13} />
                        {staffAccessCopied ? "Copiado" : "Copiar acceso"}
                      </button>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: t2 }}>
                        <span style={{ color: t1, fontWeight: 700 }}>Ingreso:</span> {staffAccessInfo.loginUrl}
                      </p>
                      <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: t2 }}>
                        <span style={{ color: t1, fontWeight: 700 }}>Email:</span> {staffAccessInfo.email}
                      </p>
                      <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: t2 }}>
                        <span style={{ color: t1, fontWeight: 700 }}>Contraseña inicial:</span> {staffAccessInfo.password}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={handleShareStaffByWhatsApp}
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(22,163,74,0.14)",
                          background: "rgba(22,163,74,0.06)",
                          color: "#166534",
                          font: `700 0.76rem/1 ${fd}`,
                          cursor: "pointer",
                        }}
                      >
                        <MessageCircle size={13} />
                        Enviar por WhatsApp
                      </button>
                      <button
                        onClick={handleShareStaffByEmail}
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(37,99,235,0.14)",
                          background: "rgba(37,99,235,0.06)",
                          color: ACCENT_DARK,
                          font: `700 0.76rem/1 ${fd}`,
                          cursor: "pointer",
                        }}
                      >
                        <Mail size={13} />
                        Enviar por email
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {staffLoading ? (
                <p style={{ font: `400 0.84rem/1.4 ${fb}`, color: t3 }}>Cargando equipo...</p>
              ) : staffList.length === 0 ? (
                <div style={{ padding: "24px 20px", borderRadius: 18, background: "#F8FAFC", border: "1px dashed rgba(15,23,42,0.10)" }}>
                  <p style={{ font: `800 0.92rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Todavía no agregaste miembros de staff</p>
                  <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2 }}>
                    Creá cuentas para recepción o entrenadores. Después entran desde el login general con su email y contraseña.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {staffList.map((member) => {
                    const displayName = member.full_name ?? member.email ?? "?";
                    return (
                      <div
                        key={member.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: 18,
                          background: "#F8FAFC",
                          border: "1px solid rgba(15,23,42,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 14,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg,#E2E8F0,#CBD5E1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              font: `800 0.72rem/1 ${fd}`,
                              color: t2,
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(displayName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1 }}>{member.full_name ?? "Staff"}</p>
                            <p style={{ font: `400 0.76rem/1.4 ${fb}`, color: t3, marginTop: 3, overflowWrap: "anywhere" }}>{member.email}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteStaff(member.id)}
                          disabled={deletingId === member.id}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 12,
                            border: "none",
                            background: "rgba(239,68,68,0.06)",
                            color: "#DC2626",
                            cursor: deletingId === member.id ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: deletingId === member.id ? 0.5 : 1,
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── White-label upsell ── */}
        <section style={{ ...card, padding: 24, background: "linear-gradient(135deg,#0D1117 0%,#1A1D23 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ font: `700 0.65rem/1 ${fd}`, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>White-label</p>
              <h2 style={{ font: `900 1.1rem/1.2 ${fd}`, color: "#FFFFFF", marginBottom: 8 }}>¿Te gusta el sistema?</h2>
              <p style={{ font: `400 0.82rem/1.45 ${fb}`, color: "rgba(255,255,255,0.50)", maxWidth: 480 }}>
                Lo adaptamos a tu marca con tu nombre, logo y app propia. Tus alumnos ven tu identidad, no FitGrowX.
              </p>
            </div>
            <button
              onClick={() => { setShowWLModal(true); setWlDone(false); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, border: "none", background: "#7C3AED", color: "#FFFFFF", font: `800 0.82rem/1 ${fd}`, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              <Zap size={14} />
              Me interesa
            </button>
          </div>
        </section>

      </div>

      {/* ── Modal: Nombre de nueva key de molinete ── */}
      {molineteLabelModal && (
        <div onClick={() => setMolineteLabelModal(false)} style={{ position: "fixed", inset: 0, zIndex: 9010, background: "rgba(0,0,0,0.50)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", width: "100%", maxWidth: 400, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ font: `800 1rem/1 ${fd}`, color: t1, margin: 0 }}>Nueva API key</h2>
              <button onClick={() => setMolineteLabelModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: t3, display: "flex" }}><X size={18} /></button>
            </div>
            <label style={{ display: "block", font: `500 0.78rem/1 ${fb}`, color: t1, marginBottom: 6 }}>Nombre del dispositivo</label>
            <input
              value={molineteNewLabel}
              onChange={e => setMolineteNewLabel(e.target.value)}
              placeholder="Ej: Molinete entrada principal"
              autoFocus
              style={{ ...inputStyle, marginBottom: 18 }}
              onKeyDown={e => { if (e.key === "Enter") handleGenerateKey(); }}
            />
            <button
              onClick={handleGenerateKey}
              disabled={molineteGenerating}
              style={{ width: "100%", padding: "12px", background: molineteGenerating ? "#9CA3AF" : ACCENT, color: "white", border: "none", borderRadius: 12, font: `700 0.9rem/1 ${fd}`, cursor: molineteGenerating ? "not-allowed" : "pointer" }}
            >
              {molineteGenerating ? "Generando..." : "Generar key"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Revelar key generada (solo una vez) ── */}
      {molineteRevealKey && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9020, background: "rgba(0,0,0,0.60)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", width: "100%", maxWidth: 460, padding: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Key size={22} color="#16A34A" />
              </div>
              <h2 style={{ font: `800 1.05rem/1 ${fd}`, color: t1, margin: 0 }}>¡Key generada!</h2>
              <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: "#DC2626", margin: "8px 0 0" }}>
                Copiala ahora. No vas a poder verla de nuevo.
              </p>
            </div>
            {/* La key */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <code style={{ flex: 1, font: `600 0.72rem/1.4 ${fm}`, color: t1, wordBreak: "break-all", letterSpacing: "0.04em" }}>{molineteRevealKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(molineteRevealKey!); setMolineteKeyCopied(true); setTimeout(() => setMolineteKeyCopied(false), 2000); }}
                style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 9, border: "none", background: molineteKeyCopied ? "#DCFCE7" : ACCENT_SOFT, color: molineteKeyCopied ? "#15803D" : ACCENT, font: `700 0.75rem/1 ${fd}`, cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 5 }}
              >
                <Copy size={13} />{molineteKeyCopied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>

            {/* Botones de instrucciones */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => {
                  const base = window.location.origin;
                  const msg = [
                    "Instrucciones para conectar el molinete con FitGrowX",
                    "",
                    `URL: ${base}/api/molinete/access`,
                    "Método: POST",
                    `Headers:`,
                    `  x-api-key: ${molineteRevealKey}`,
                    `  Content-Type: application/json`,
                    "",
                    "Cuando el alumno tipea su DNI:",
                    '{"qr":"FITGROWX:12345678"}',
                    "",
                    "Cuando el alumno muestra el QR del celular:",
                    '{"qr":"FITGROWX:ID:uuid-del-alumno"}',
                    "",
                    "Respuesta exitosa completa:",
                    '{"access":"allow","alumno":{"full_name":"Juan Pérez"},"hora":"09:32"}',
                    "",
                    "Respuesta denegada:",
                    '{"access":"deny","reason":"Membresía vencida."}',
                    "",
                    "Para configurar la condición de apertura en el controlador:",
                    "  Campo a evaluar: access",
                    '  Valor que ABRE la tranca: "allow"',
                    '  Valor que BLOQUEA: "deny"',
                  ].join("\n");
                  navigator.clipboard.writeText(msg);
                  setMolineteInstructionsCopied(true);
                  setTimeout(() => setMolineteInstructionsCopied(false), 2500);
                }}
                style={{ flex: 1, padding: "11px 10px", borderRadius: 11, border: `1.5px solid ${molineteInstructionsCopied ? "#16A34A" : "rgba(15,23,42,0.10)"}`, background: molineteInstructionsCopied ? "#DCFCE7" : "#F8FAFC", color: molineteInstructionsCopied ? "#15803D" : t1, font: `600 0.78rem/1.3 ${fd}`, cursor: "pointer", transition: "all .18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Copy size={13} />
                {molineteInstructionsCopied ? "¡Copiadas!" : "Copiar instrucciones"}
              </button>
              <button
                onClick={() => {
                  const base = window.location.origin;
                  const msg = `Instrucciones para conectar el molinete con FitGrowX\n\nURL: ${base}/api/molinete/access\nMétodo: POST\nHeaders:\n  x-api-key: ${molineteRevealKey}\n  Content-Type: application/json\n\nCuando el alumno tipea su DNI:\n{"qr":"FITGROWX:12345678"}\n\nCuando muestra el QR del celular:\n{"qr":"FITGROWX:ID:uuid-del-alumno"}\n\nRespuesta exitosa completa:\n{"access":"allow","alumno":{"full_name":"Juan Pérez"},"hora":"09:32"}\n\nRespuesta denegada:\n{"access":"deny","reason":"Membresía vencida."}\n\nPara configurar la condición de apertura en el controlador:\n  Campo a evaluar: access\n  Valor que ABRE la tranca: "allow"\n  Valor que BLOQUEA: "deny"`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                style={{ flex: 1, padding: "11px 10px", borderRadius: 11, border: "1.5px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.06)", color: "#128C7E", font: `600 0.78rem/1.3 ${fd}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <MessageCircle size={13} />
                Enviar por WhatsApp
              </button>
            </div>

            <button
              onClick={() => setMolineteRevealKey(null)}
              style={{ width: "100%", padding: "11px", background: "#F1F5F9", color: t2, border: "none", borderRadius: 12, font: `600 0.85rem/1 ${fd}`, cursor: "pointer" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: White-label ── */}
      {showWLModal && (
        <div
          onClick={() => setShowWLModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 24, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 40px 80px rgba(0,0,0,0.30)", position: "relative" }}>
            <button onClick={() => setShowWLModal(false)} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 10, border: "none", background: "#F1F5F9", color: t2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>

            {!wlDone ? (
              <>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(124,58,237,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Zap size={20} color="#7C3AED" />
                </div>
                <p style={{ font: `700 0.65rem/1 ${fd}`, color: "#7C3AED", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>White-label</p>
                <h2 style={{ font: `900 1.3rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>FitGrowX con tu marca</h2>
                <p style={{ font: `400 0.82rem/1.4 ${fd}`, color: t2, marginBottom: 20 }}>
                  Tus alumnos ven tu nombre, tu logo, tu app. Nosotros nos ocupamos de toda la tecnología.
                </p>

                <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                  <input value={wlName} onChange={e => setWlName(e.target.value)} placeholder="Tu nombre" style={inputStyle} />
                  <input type="email" value={wlEmail} onChange={e => setWlEmail(e.target.value)} placeholder="Email" style={inputStyle} />
                  <input value={wlPhone} onChange={e => setWlPhone(e.target.value)} placeholder="WhatsApp (ej: 1165432100)" style={inputStyle} />
                </div>

                <button
                  disabled={wlLoading || (!wlEmail && !wlPhone)}
                  onClick={async () => {
                    setWlLoading(true);
                    try {
                      await fetch("/api/upsell/lead", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: wlName, email: wlEmail, phone: wlPhone, type: "whitelabel" }),
                      });
                      setWlDone(true);
                    } finally {
                      setWlLoading(false);
                    }
                  }}
                  style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: wlLoading ? "#D1D5DB" : "linear-gradient(135deg,#6D28D9,#7C3AED)", color: "#FFFFFF", font: `800 0.9rem/1 ${fd}`, cursor: wlLoading ? "not-allowed" : "pointer" }}
                >
                  {wlLoading ? "Enviando..." : "Me interesa, contactame →"}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(124,58,237,0.10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Zap size={22} color="#7C3AED" />
                </div>
                <h3 style={{ font: `800 1.1rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>¡Recibido!</h3>
                <p style={{ font: `400 0.84rem/1.5 ${fd}`, color: t2 }}>Te contactamos pronto para arrancar con tu versión personalizada.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {qrModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 205,
            background: "rgba(15,23,42,0.56)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{ ...card, width: "100%", maxWidth: 420, padding: 28, textAlign: "center", position: "relative", boxShadow: "0 28px 64px rgba(15,23,42,0.20)" }}>
            <button
              onClick={closeQrModal}
              style={{ position: "absolute", top: 18, right: 18, width: 34, height: 34, borderRadius: 12, border: "none", background: "#F1F5F9", color: t2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X size={16} />
            </button>
            <div style={{ width: 52, height: 52, borderRadius: 18, margin: "0 auto 16px", background: ACCENT_SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Smartphone size={22} color={ACCENT} />
            </div>
            <h3 style={{ font: `900 1.15rem/1 ${fd}`, color: t1, marginBottom: 8 }}>Vincular WhatsApp</h3>
            <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2, marginBottom: 22 }}>
              Escaneá el código desde WhatsApp en Dispositivos vinculados para dejar activas las automatizaciones.
            </p>

            <div style={{ width: 244, height: 244, margin: "0 auto", borderRadius: 20, border: "1px solid rgba(15,23,42,0.06)", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {qrLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <Loader2 size={32} color={ACCENT} style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ font: `700 0.8rem/1.35 ${fd}`, color: t1 }}>
                    {qrAttempt === 0 ? "Conectando con el motor..." : `Reintentando (${qrAttempt + 1}/3)...`}
                  </p>
                </div>
              ) : qrError ? (
                <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                  <WifiOff size={20} color="#DC2626" />
                  <p style={{ font: `700 0.82rem/1.3 ${fd}`, color: "#DC2626" }}>
                    {qrError === "max_network" ? "No llegamos al servidor"
                      : qrError === "scan_failed" ? "WhatsApp no aceptó el escaneo"
                      : "La sesión necesita reiniciarse"}
                  </p>
                  <p style={{ font: `400 0.75rem/1.45 ${fd}`, color: "#6b7280", maxWidth: 210, textAlign: "left" }}>
                    {qrError === "max_network"
                      ? "Puede ser un problema temporal de nuestra parte. Esperá 1 minuto e intentá de nuevo."
                      : qrError === "scan_failed"
                      ? <>Causas frecuentes:<br />• Ya tenés 4 dispositivos vinculados en tu celu → abrí WhatsApp → ⋮ → <strong>Dispositivos vinculados</strong> → eliminá uno viejo.<br />• El teléfono perdió internet justo al escanear.<br />• La sesión anterior no cerró bien.</>
                      : "Tu sesión de WhatsApp quedó en un estado inválido. Tocá 'Reiniciar' para limpiarla y generar un QR nuevo."}
                  </p>
                  <button
                    onClick={openQrModal}
                    style={{ marginTop: 4, background: `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    {qrError === "max_network" ? "Reintentar" : "Reiniciar sesión"}
                  </button>
                </div>
              ) : qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImage} alt="WhatsApp QR" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </div>

            {qrImage && (
              <p style={{ font: `500 0.74rem/1 ${fb}`, color: t3, marginTop: 16 }}>
                {qrSecondsLeft !== null && qrSecondsLeft <= 15
                  ? `⏱ El código expira en ${qrSecondsLeft}s — se renovará solo`
                  : "Esperando escaneo..."}
              </p>
            )}

            {/* Step-by-step guide */}
            <div style={{ marginTop: 22, borderTop: "1px solid rgba(15,23,42,0.07)", paddingTop: 18 }}>
              <p style={{ font: `600 0.7rem/1 ${fb}`, color: t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Cómo escanear</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { n: 1, icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="2" width="14" height="20" rx="3"/>
                      <path d="M9 21h6"/>
                    </svg>
                  ), label: "Abrí WhatsApp en tu celu" },
                  { n: 2, icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="5" r="1" fill={ACCENT}/><circle cx="12" cy="12" r="1" fill={ACCENT}/><circle cx="12" cy="19" r="1" fill={ACCENT}/>
                    </svg>
                  ), label: "Tocá ⋮ y luego Dispositivos vinculados" },
                  { n: 3, icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  ), label: "Tocá Vincular un dispositivo" },
                  { n: 4, icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                      <rect x="7" y="7" width="10" height="10" rx="1"/>
                    </svg>
                  ), label: "Apuntá la cámara al QR de arriba" },
                ].map(s => (
                  <div key={s.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "10px 4px", borderRadius: 12, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT_SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {s.icon}
                    </div>
                    <p style={{ font: `400 0.65rem/1.4 ${fb}`, color: t2, textAlign: "center", margin: 0 }}>{s.label}</p>
                    <span style={{ font: `800 0.6rem/1 ${fd}`, color: ACCENT, background: ACCENT_SOFT, borderRadius: 999, padding: "2px 7px" }}>paso {s.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {staffModalOpen && (
        <div
          onClick={() => { setStaffModalOpen(false); setStaffError(null); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15,23,42,0.46)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              ...card,
              padding: 26,
              boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
              <div>
                <p style={{ font: `700 0.72rem/1 ${fb}`, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  Nuevo miembro
                </p>
                <h3 style={{ font: `900 1.2rem/1 ${fd}`, color: t1, marginBottom: 8 }}>Agregar miembro del equipo</h3>
                <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: t2 }}>
                  Creá una cuenta para recepción o entrenadores. Después entra desde <span style={{ color: ACCENT, fontWeight: 700 }}>/start?login=1</span> con este email y contraseña.
                </p>
              </div>
              <button
                onClick={() => { setStaffModalOpen(false); setStaffError(null); }}
                style={{ width: 34, height: 34, borderRadius: 12, border: "none", background: "#F1F5F9", color: t2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <Field label="Nombre">
                <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Ej: Lucas Pérez" maxLength={100} style={inputStyle} />
              </Field>

              <Field label="Email">
                <input type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="staff@gym.com" maxLength={255} style={inputStyle} />
              </Field>

              <Field label="Contraseña" hint="Mínimo 6 caracteres. Esta es la clave inicial que le vas a compartir para que entre.">
                <input type="password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} placeholder="********" maxLength={128} style={inputStyle} />
              </Field>

              {staffError && <p style={{ font: `600 0.78rem/1.4 ${fb}`, color: "#DC2626" }}>{staffError}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  onClick={() => { setStaffModalOpen(false); setStaffError(null); }}
                  style={{
                    padding: "11px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "white",
                    color: t2,
                    font: `700 0.8rem/1 ${fd}`,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateStaff}
                  disabled={staffSaving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "11px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: staffSaving ? "#D1D5DB" : "linear-gradient(135deg, #1D4ED8, #2563EB)",
                    color: "white",
                    font: `800 0.8rem/1 ${fd}`,
                    cursor: staffSaving ? "not-allowed" : "pointer",
                  }}
                >
                  <UserPlus size={13} />
                  {staffSaving ? "Creando..." : "Crear cuenta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete account modal ── */}
      {deleteModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 24, padding: "28px 24px", maxWidth: 440, width: "100%", boxShadow: "0 40px 100px rgba(0,0,0,0.22)" }}>
            {deleteStep === "export" ? (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px" }}>
                  <AlertTriangle size={20} color="#6366f1" />
                </div>
                <h3 style={{ font: `800 1.1rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>Antes de eliminar, descargá tus datos</h3>
                <p style={{ font: `400 0.84rem/1.55 ${fb}`, color: t2, marginBottom: 20 }}>
                  Tus alumnos y pagos te pertenecen. Descargalos en CSV para importarlos en cualquier otro sistema. Una vez eliminada la cuenta no hay recuperación posible.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                  <a
                    href="/api/user/export-alumnos-csv"
                    download
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)", textDecoration: "none" }}
                  >
                    <div>
                      <p style={{ font: `700 0.84rem/1 ${fd}`, color: "#4f46e5", margin: "0 0 3px" }}>Lista de alumnos (CSV)</p>
                      <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, margin: 0 }}>Nombre, teléfono, email, plan, vencimiento</p>
                    </div>
                    <span style={{ font: `700 0.75rem/1 ${fd}`, color: "#4f46e5", padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.1)" }}>CSV</span>
                  </a>
                  <a
                    href="/api/user/export-data?format=xlsx"
                    download
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fafbfc", textDecoration: "none" }}
                  >
                    <div>
                      <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1, margin: "0 0 3px" }}>Copia completa (Excel)</p>
                      <p style={{ font: `400 0.72rem/1 ${fb}`, color: t3, margin: 0 }}>Alumnos, pagos, asistencias, rutinas, egresos, prospectos</p>
                    </div>
                    <span style={{ font: `700 0.75rem/1 ${fd}`, color: t2, padding: "6px 10px", borderRadius: 8, background: "rgba(15,23,42,0.05)" }}>XLSX</span>
                  </a>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "none", color: t2, font: `600 0.82rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setDeleteStep("confirm")}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#DC2626", color: "white", font: `700 0.82rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    Continuar y eliminar →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 0 16px" }}>
                  <Trash2 size={20} color="#DC2626" />
                </div>
                <h3 style={{ font: `800 1.1rem/1.2 ${fd}`, color: t1, marginBottom: 8 }}>¿Eliminar cuenta?</h3>
                <p style={{ font: `400 0.84rem/1.55 ${fb}`, color: t2, marginBottom: 20 }}>
                  Se eliminarán permanentemente todos los alumnos, pagos, planes, automatizaciones y datos del gym. <strong>No hay vuelta atrás.</strong>
                </p>
                <p style={{ font: `600 0.78rem/1 ${fd}`, color: t1, marginBottom: 8 }}>
                  Escribí <strong>{gymName}</strong> para confirmar:
                </p>
                <input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={gymName}
                  style={{ ...inputStyle, marginBottom: 12, border: `1px solid ${deleteConfirm === gymName ? "rgba(220,38,38,0.40)" : "rgba(15,23,42,0.08)"}` }}
                />
                {deleteError && (
                  <p style={{ font: `500 0.78rem/1 ${fb}`, color: "#DC2626", marginBottom: 10 }}>{deleteError}</p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setDeleteStep("export")}
                    disabled={deleting}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.10)", background: "none", color: t2, font: `600 0.82rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    ← Atrás
                  </button>
                  <button
                    onClick={handleDeleteGym}
                    disabled={deleteConfirm !== gymName || deleting}
                    style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: deleteConfirm === gymName && !deleting ? "#DC2626" : "#E5E7EB", color: deleteConfirm === gymName && !deleting ? "white" : t3, font: `700 0.82rem/1 ${fd}`, cursor: deleteConfirm === gymName && !deleting ? "pointer" : "not-allowed", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
                  >
                    {deleting ? <><Loader2 size={13} style={{ animation: "spin 0.7s linear infinite" }} /> Eliminando...</> : "Eliminar para siempre"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}

export default function AjustesPage() {
  return (
    <Suspense>
      <AjustesContent />
    </Suspense>
  );
}
