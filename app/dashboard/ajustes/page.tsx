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

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";
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
    <section style={{ ...card, padding: 26 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
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
            <p style={{ font: `400 0.84rem/1.5 ${fb}`, color: t2, maxWidth: 520 }}>{desc}</p>
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
  const [instagramUrl, setInstagramUrl] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportStatus, setReportStatus] = useState<{ tone: "success" | "info" | "error"; message: string } | null>(null);
  const [lastMonthlyReport, setLastMonthlyReport] = useState<LastMonthlyReport | null>(null);

  const [gymId, setGymId] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [waStatus, setWaStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waBattery, setWaBattery] = useState<number | null>(null);
  const [waSignal, setWaSignal] = useState<number | null>(null);
  const [waPlugged, setWaPlugged] = useState<boolean | null>(null);
  const [waRetries, setWaRetries] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<"max" | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MOTOR = process.env.NEXT_PUBLIC_WA_MOTOR_URL ?? "https://motor-wsp-fitgrowx-production.up.railway.app";

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
  const [isMobile, setIsMobile] = useState(false);

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
          .select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type)")
          .eq("id", userIdVal)
          .maybeSingle(),
        supabase
          .from("gym_settings")
          .select("gym_name, logo_url, instagram_url, accent_color, landing_title, landing_desc, slug")
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
      if (settings?.gym_name) setGymName(settings.gym_name);
      if (settings?.logo_url) setLogoUrl(settings.logo_url);
      if (settings?.instagram_url) setInstagramUrl(settings.instagram_url);
      setHasMercadoPagoLink(Boolean(cuentas && cuentas.length > 0));

      const gym = Array.isArray(profile?.gyms) ? profile?.gyms[0] : profile?.gyms;
      if (gym) {
        if (!gym.is_subscription_active && gym.trial_expires_at) {
          const diff = new Date(gym.trial_expires_at).getTime() - Date.now();
          const left = Math.max(0, Math.ceil(diff / 86_400_000));
          setTrialDaysLeft(left);
          setIsTrial(left > 0);
        }
      }

      void loadLastMonthlyReport(gymIdVal);

      fetch("/api/admin/staff")
        .then((response) => response.json())
        .then((data) => {
          if (data.staff) setStaffList(data.staff);
        })
        .finally(() => setStaffLoading(false));
    })();
  }, [loadLastMonthlyReport]);

  const handleSaveGym = async () => {
    if (!gymId) return;
    await supabase.from("gyms").update({ name: gymName }).eq("id", gymId);
    await supabase.from("gym_settings").upsert({ gym_id: gymId, gym_name: gymName, instagram_url: instagramUrl.trim() || null }, { onConflict: "gym_id" });
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

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      try {
        const response = await fetch(`${MOTOR}/session-status/${gymId}`);
        const data = await response.json();
        setWaStatus(data.status === "active" ? "connected" : "disconnected");
        if (data.retries != null) setWaRetries(data.retries);
        if (data.phone) setWaPhone(data.phone);
        if (data.battery != null) setWaBattery(data.battery);
        if (data.signal != null) setWaSignal(data.signal);
        if (data.plugged != null) setWaPlugged(data.plugged);
      } catch {
        setWaStatus("disconnected");
      }
    })();
  }, [gymId, MOTOR]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  };

  const startStatusPoll = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${MOTOR}/session-status/${gymId}`);
        const data = await response.json();
        if (data.retries != null) setWaRetries(data.retries);
        if (data.status === "active") {
          stopPolling();
          setWaStatus("connected");
          setWaRetries(0);
          if (data.phone) setWaPhone(data.phone);
          if (data.battery != null) setWaBattery(data.battery);
          if (data.signal != null) setWaSignal(data.signal);
          if (data.plugged != null) setWaPlugged(data.plugged);
          setQrModalOpen(false);
        }
      } catch {
        // noop
      }
    }, 3000);
  };

  const attemptQrConnect = async (attempt: number) => {
    if (!gymId) return;
    setQrAttempt(Math.min(attempt, 2));
    setQrLoading(true);
    setQrImage(null);

    try {
      if (attempt === 0) {
        await fetch(`${MOTOR}/session/${gymId}`, { method: "DELETE" }).catch(() => {});
      }

      const response = await fetch(`${MOTOR}/qr/${gymId}/data`, { cache: "no-store" });
      const data = await response.json();

      if (data.status === "active") {
        setWaStatus("connected");
        setQrModalOpen(false);
        setQrLoading(false);
        return;
      }

      if (data.qr) {
        setQrImage(data.qr);
        setQrLoading(false);
        startStatusPoll();
        return;
      }

      retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 2000);
    } catch {
      setQrLoading(false);
      if (attempt < 4) {
        retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 3000);
      } else {
        setQrError("max");
      }
    }
  };

  const openQrModal = () => {
    stopPolling();
    setQrModalOpen(true);
    setQrImage(null);
    setQrError(null);
    setQrAttempt(0);
    void attemptQrConnect(0);
  };

  const closeQrModal = () => {
    stopPolling();
    setQrModalOpen(false);
  };

  const disconnectWA = async () => {
    if (!gymId || !window.confirm("¿Desvincular WhatsApp? Se detendrán los mensajes automáticos.")) return;
    stopPolling();
    await fetch(`${MOTOR}/session/${gymId}`, { method: "DELETE" });
    setWaStatus("disconnected");
    setWaPhone(null);
    setWaBattery(null);
    setWaSignal(null);
    setWaPlugged(null);
    openQrModal();
  };

  const handleRefreshSession = async () => {
    if (!gymId || refreshing) return;
    setRefreshing(true);
    try {
      await fetch(`${MOTOR}/session/${gymId}/reconnect`, { method: "POST" });
      setTimeout(async () => {
        try {
          const response = await fetch(`${MOTOR}/session-status/${gymId}`);
          const data = await response.json();
          setWaStatus(data.status === "active" ? "connected" : "disconnected");
          if (data.retries != null) setWaRetries(data.retries);
        } catch {}
        setRefreshing(false);
      }, 3500);
    } catch {
      setRefreshing(false);
    }
  };

  useEffect(() => () => stopPolling(), []);

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
              <div style={{ display: "grid", gap: isMobile ? 18 : 22 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 240px", gap: 18 }}>
                  <div style={{ display: "grid", gap: 16 }}>
                    <Field label="Nombre del gimnasio">
                      <input value={gymName} onChange={(event) => setGymName(event.target.value)} style={inputStyle} />
                    </Field>

                    <Field label="Email de acceso" hint="El cambio de email se gestiona desde autenticación, por eso hoy lo mostramos como referencia.">
                      <input value={email} readOnly style={mutedInputStyle} />
                    </Field>

                    <Field label="Instagram" hint="Podés pegar tu perfil completo o el usuario, por ejemplo `instagram.com/tugym` o `@tugym`.">
                      <div style={{ position: "relative" }}>
                        <Camera size={15} color={t3} style={{ position: "absolute", top: 14, left: 14 }} />
                        <input
                          value={instagramUrl}
                          onChange={(event) => setInstagramUrl(event.target.value)}
                          placeholder="@tugym"
                          style={{ ...inputStyle, paddingLeft: 40 }}
                        />
                      </div>
                    </Field>
                  </div>

                  <div style={{ padding: "18px", borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)", display: "grid", gap: 12, alignContent: "start", justifyItems: isMobile ? "stretch" : "start" }}>
                    <p style={{ font: `700 0.8rem/1 ${fd}`, color: t1 }}>Logo del gimnasio</p>
                    <div style={{ width: 88, height: 88, borderRadius: 20, border: "1px dashed rgba(15,23,42,0.12)", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", justifySelf: isMobile ? "center" : "start" }}>
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

                {isTrial && (
                  <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.14)", display: "flex", gap: 9 }}>
                    <Zap size={14} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ font: `400 0.78rem/1.45 ${fb}`, color: ACCENT }}>
                      Ya podés cargar tu logo, nombre e identidad visual del gym{trialDaysLeft !== null ? ` (${trialDaysLeft} días restantes de prueba)` : ""}.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
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
                    icon: <Smartphone size={18} color={waStatus === "connected" ? ACCENT : waRetries > 0 ? "#B45309" : t3} />,
                    title: "WhatsApp",
                    description:
                      waStatus === "connected"
                        ? `${waPhone ? waPhone : "Conectado"}${waBattery !== null ? ` · ${waBattery}% batería` : ""}${waSignal !== null ? ` · señal ${waSignal}/4` : ""}${waPlugged ? " · cargando" : ""}`
                        : waRetries > 0
                        ? "Reintentando reconectar... Si tu teléfono perdió internet, revisalo."
                        : "Usá el motor para recordatorios, reactivaciones y mensajes automáticos.",
                    badge: waStatus === "connected"
                      ? { label: "Conexión estable", bg: "rgba(34,197,94,0.10)", color: "#15803D" }
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
                      <button
                        disabled
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#E5E7EB", color: "#6B7280", font: `700 0.78rem/1 ${fd}`, cursor: "not-allowed" }}
                      >
                        Próximamente
                      </button>
                    ),
                  },
                  {
                    key: "mp",
                    icon: <CreditCard size={18} color={hasMercadoPagoLink ? ACCENT : t3} />,
                    title: "Mercado Pago",
                    description: hasMercadoPagoLink ? "Link de cobro activo configurado para la operación del gym." : "Configurá tu link de cobro desde Membresías para dejar esta conexión lista.",
                    badge: hasMercadoPagoLink ? { label: "Activo", bg: "rgba(34,197,94,0.10)", color: "#15803D" } : { label: "Desconectado", bg: "#F1F5F9", color: t2 },
                    action: (
                      <button
                        onClick={() => router.push("/dashboard/membresias")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "white", color: t2, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                      >
                        {hasMercadoPagoLink ? "Editar" : "Configurar"}
                        <ChevronRight size={13} />
                      </button>
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
              {waStatus !== "connected" && waRetries >= 3 && (
                <div style={{ marginTop: 10, padding: "14px 16px", borderRadius: 16, background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.22)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ font: `400 0.79rem/1.5 ${fb}`, color: "#92400E" }}>
                    Parece que tu teléfono perdió internet. Revisalo para seguir enviando mensajes automáticos.
                  </p>
                </div>
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

      </div>

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
              ) : qrError === "max" ? (
                <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <WifiOff size={20} color="#DC2626" />
                  <p style={{ font: `700 0.82rem/1.3 ${fd}`, color: "#DC2626" }}>No se pudo conectar</p>
                  <button
                    onClick={openQrModal}
                    style={{ marginTop: 4, background: `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`, color: "white", border: "none", borderRadius: 10, padding: "9px 18px", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    Volver a intentar
                  </button>
                </div>
              ) : qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImage} alt="WhatsApp QR" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
            </div>

            {qrImage && <p style={{ font: `500 0.74rem/1 ${fb}`, color: t3, marginTop: 16 }}>Esperando escaneo...</p>}
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
                <input value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Ej: Lucas Pérez" style={inputStyle} />
              </Field>

              <Field label="Email">
                <input type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="staff@gym.com" style={inputStyle} />
              </Field>

              <Field label="Contraseña" hint="Mínimo 6 caracteres. Esta es la clave inicial que le vas a compartir para que entre.">
                <input type="password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} placeholder="********" style={inputStyle} />
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
