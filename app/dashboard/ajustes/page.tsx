"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  ImagePlus,
  Camera,
  Loader2,
  Lock,
  Mail,
  Save,
  Smartphone,
  Star,
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
import AutomatizacionesPage from "../automatizaciones/page";

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
  { key: "general", label: "General" },
  { key: "conexiones", label: "Conexiones" },
  { key: "landing", label: "Landing" },
  { key: "membresias", label: "Membresías" },
  { key: "equipo", label: "Equipo" },
  { key: "automatizaciones", label: "Automatizaciones" },
] as const;

type SettingsTab = typeof tabs[number]["key"];
type StaffMember = { id: string; email: string | null; full_name: string | null };
type CobroMethod = "alias" | "cbu" | "mp";

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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function AjustesPage() {
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
  const [metodo, setMetodo] = useState<CobroMethod>("alias");
  const [alias, setAlias] = useState("");
  const [cbu, setCbu] = useState("");
  const [mpLink, setMpLink] = useState("");
  const [saved, setSaved] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  const [gymId, setGymId] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [landingSaved, setLandingSaved] = useState(false);
  const [landingAccent, setLandingAccent] = useState(ACCENT);
  const [landingTitle, setLandingTitle] = useState("Probá una clase gratis.");
  const [landingDesc, setLandingDesc] = useState("Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis.");
  const [gymSlug, setGymSlug] = useState("tu-gym");

  const [waStatus, setWaStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waBattery, setWaBattery] = useState<number | null>(null);
  const [waSignal, setWaSignal] = useState<number | null>(null);
  const [waPlugged, setWaPlugged] = useState<boolean | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<"max" | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MOTOR = process.env.NEXT_PUBLIC_WA_MOTOR_URL ?? "https://motor-wsp-fitgrowx-production.up.railway.app";

  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(normalizeTab(searchTab));
  }, [searchTab]);

  useEffect(() => {
    (async () => {
      const cachedProfile = await getCachedProfile();
      if (!cachedProfile) return;

      const gymIdVal = cachedProfile.gymId;
      const userIdVal = cachedProfile.userId;
      setGymId(gymIdVal);

      const [{ data: authData }, { data: profile }, { data: settings }, { data: billingAccount }] = await Promise.all([
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
          .select("tipo, valor")
          .eq("gym_id", gymIdVal)
          .eq("activa", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setEmail(authData.user?.email ?? "");
      if (settings?.gym_name) setGymName(settings.gym_name);
      if (settings?.logo_url) setLogoUrl(settings.logo_url);
      if (settings?.instagram_url) setInstagramUrl(settings.instagram_url);
      if (settings?.accent_color) setLandingAccent(settings.accent_color);
      if (settings?.landing_title) setLandingTitle(settings.landing_title);
      if (settings?.landing_desc) setLandingDesc(settings.landing_desc);
      if (settings?.slug) setGymSlug(settings.slug);

      if (billingAccount?.tipo === "alias") {
        setMetodo("alias");
        setAlias(billingAccount.valor);
      } else if (billingAccount?.tipo === "cbu") {
        setMetodo("cbu");
        setCbu(billingAccount.valor);
      } else if (billingAccount?.tipo === "mercadopago") {
        setMetodo("mp");
        setMpLink(billingAccount.valor);
      }

      const gym = Array.isArray(profile?.gyms) ? profile?.gyms[0] : profile?.gyms;
      if (gym) {
        setPlanType(gym.plan_type ?? null);
        if (!gym.is_subscription_active && gym.trial_expires_at) {
          const diff = new Date(gym.trial_expires_at).getTime() - Date.now();
          const left = Math.max(0, Math.ceil(diff / 86_400_000));
          setTrialDaysLeft(left);
          setIsTrial(left > 0);
        }
      }

      fetch("/api/admin/staff")
        .then((response) => response.json())
        .then((data) => {
          if (data.staff) setStaffList(data.staff);
        })
        .finally(() => setStaffLoading(false));
    })();
  }, []);

  const activeLogoSrc = logoPreview ?? logoUrl;
  const canUseBranding = isTrial || planType === "full_marca";
  const billingValue = metodo === "alias" ? alias : metodo === "cbu" ? cbu : mpLink;
  const publicLandingUrl = `fitgrowx.app/${gymSlug || "tu-gym"}`;
  const hasMercadoPagoLink = metodo === "mp" && mpLink.trim().length > 0;

  const currentTabMeta = useMemo(() => {
    switch (activeTab) {
      case "general":
        return {
          eyebrow: "Centro de Configuración",
          title: "General",
          desc: "Actualizá los datos base del gimnasio desde una vista más compacta y clara.",
        };
      case "conexiones":
        return {
          eyebrow: "Integraciones",
          title: "Conexiones",
          desc: "Controlá los canales y servicios conectados con estados simples y acciones claras.",
        };
      case "landing":
        return {
          eyebrow: "Captación",
          title: "Landing",
          desc: "Editá tu página pública y el dominio corto sin mezclarlo con otros ajustes.",
        };
      case "membresias":
        return {
          eyebrow: "Facturación y Plan",
          title: "Membresías y cobros",
          desc: "Configurá cómo cobrás y administrá tu suscripción activa sin dar vueltas.",
        };
      case "equipo":
        return {
          eyebrow: "Equipo interno",
          title: "Miembros y accesos",
          desc: "Invitá staff, revisá quién tiene acceso y mantené la operación ordenada.",
        };
      default:
        return {
          eyebrow: "Mensajería y Captación",
          title: "Automatizaciones",
          desc: "Gestioná los mensajes automáticos, accesos al panel y reactivaciones desde una vista enfocada.",
        };
    }
  }, [activeTab]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/dashboard/ajustes?${params.toString()}`, { scroll: false });
  };

  const handleSaveGym = async () => {
    if (!gymId) return;
    await supabase.from("gyms").update({ name: gymName }).eq("id", gymId);
    await supabase.from("gym_settings").upsert({ gym_id: gymId, gym_name: gymName, instagram_url: instagramUrl.trim() || null }, { onConflict: "gym_id" });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleSaveLanding = async () => {
    if (!gymId) return;
    const nextSlug = slugify(gymSlug) || slugify(gymName) || "tu-gym";
    await supabase.from("gym_settings").upsert({
      gym_id: gymId,
      accent_color: landingAccent,
      landing_title: landingTitle.trim() || null,
      landing_desc: landingDesc.trim() || null,
      slug: nextSlug,
    }, { onConflict: "gym_id" });
    setGymSlug(nextSlug);
    setLandingSaved(true);
    setTimeout(() => setLandingSaved(false), 2200);
  };

  const handleSaveBilling = async () => {
    if (!gymId || !billingValue.trim()) return;

    const tipo = metodo === "mp" ? "mercadopago" : metodo;
    await supabase.from("gym_cuentas").update({ activa: false }).eq("gym_id", gymId);
    await supabase.from("gym_cuentas").insert({
      gym_id: gymId,
      tipo,
      valor: billingValue.trim(),
      activa: true,
    });

    if (metodo === "alias") {
      await supabase.from("gym_settings").upsert({ gym_id: gymId, cobro_alias: alias.trim() || null }, { onConflict: "gym_id" });
    }

    setBillingSaved(true);
    setTimeout(() => setBillingSaved(false), 2200);
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
    setStaffEmail("");
    setStaffPassword("");
    setStaffName("");
    setStaffSaving(false);
    setStaffModalOpen(false);
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

  const handleCancelSubscription = async () => {
    if (!gymId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const response = await fetch("/api/mp/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: gymId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Error al cancelar.");
      setCancelDone(true);
      setShowConfirm(false);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      try {
        const response = await fetch(`${MOTOR}/session-status/${gymId}`);
        const data = await response.json();
        setWaStatus(data.status === "active" ? "connected" : "disconnected");
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
        if (data.status === "active") {
          stopPolling();
          setWaStatus("connected");
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
                <p style={{ font: `700 0.72rem/1 ${fb}`, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
                  {currentTabMeta.eyebrow}
                </p>
                <h1 style={{ font: `900 2rem/1 ${fd}`, color: t1, letterSpacing: "-0.04em", marginBottom: 10 }}>
                  {currentTabMeta.title}
                </h1>
                <p style={{ font: `400 0.94rem/1.6 ${fb}`, color: t2 }}>
                  {currentTabMeta.desc}
                </p>
              </div>

            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    style={{
                      flexShrink: 0,
                      padding: "11px 16px",
                      borderRadius: 9999,
                      border: isActive ? "1px solid rgba(37,99,235,0.22)" : "1px solid rgba(15,23,42,0.08)",
                      background: isActive ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,1) 100%)" : "rgba(255,255,255,0.72)",
                      color: isActive ? ACCENT : t2,
                      font: `${isActive ? "800" : "600"} 0.82rem/1 ${fd}`,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 6px 18px rgba(37,99,235,0.10)" : "none",
                      transition: "all 0.16s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === "general" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Building2 size={18} color="white" />}
              title="General"
              desc="Nombre, acceso, Instagram, logo y seguridad en una sola vista compacta."
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
              <div style={{ display: "grid", gap: 22 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 240px", gap: 18 }}>
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

                  <div style={{ padding: "18px", borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)", display: "grid", gap: 12, alignContent: "start" }}>
                    <p style={{ font: `700 0.8rem/1 ${fd}`, color: t1 }}>Logo del gimnasio</p>
                    <div style={{ width: 88, height: 88, borderRadius: 20, border: "1px dashed rgba(15,23,42,0.12)", background: "white", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {activeLogoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeLogoSrc} alt="Logo preview" style={{ maxWidth: "84%", maxHeight: "84%", objectFit: "contain" }} />
                      ) : (
                        <ImagePlus size={20} color={t3} />
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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

                {canUseBranding ? (
                  isTrial && (
                    <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.14)", display: "flex", gap: 9 }}>
                      <Zap size={14} color={ACCENT} style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ font: `400 0.78rem/1.45 ${fb}`, color: ACCENT }}>
                        Tenés branding disponible durante el trial{trialDaysLeft !== null ? ` (${trialDaysLeft} días restantes)` : ""}. Después queda incluido en Full Marca.
                      </p>
                    </div>
                  )
                ) : (
                  <div style={{ padding: "18px", borderRadius: 18, background: "linear-gradient(135deg, #F8FAFC 0%, #EEF4FF 100%)", border: "1px dashed rgba(37,99,235,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ font: `800 0.92rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Branding incluido en Full Marca</p>
                      <p style={{ font: `400 0.78rem/1.5 ${fb}`, color: t2, maxWidth: 460 }}>
                        Mostrá tu identidad visual propia en toda la experiencia del gym, sin marca de FitGrowX.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/suscripcion"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "11px 16px",
                        borderRadius: 14,
                        background: ACCENT,
                        color: "white",
                        textDecoration: "none",
                        font: `800 0.82rem/1 ${fd}`,
                      }}
                    >
                      <Star size={13} />
                      Ver plan
                    </Link>
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
              title="Canales y conexiones"
              desc="Cada conexión aparece en una fila clara con estado y acción principal."
            >
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  {
                    key: "wa",
                    icon: <Smartphone size={18} color={waStatus === "connected" ? ACCENT : t3} />,
                    title: "WhatsApp",
                    description:
                      waStatus === "connected"
                        ? `${waPhone ? waPhone : "Conectado"}${waBattery !== null ? ` · ${waBattery}% batería` : ""}${waSignal !== null ? ` · señal ${waSignal}/4` : ""}${waPlugged ? " · cargando" : ""}`
                        : "Usa el motor actual para recordatorios, reactivaciones y mensajes automáticos.",
                    badge: waStatus === "connected" ? { label: "Activo", bg: "rgba(34,197,94,0.10)", color: "#15803D" } : { label: "Desconectado", bg: "#F1F5F9", color: t2 },
                    action: waStatus === "connected" ? (
                      <button
                        onClick={disconnectWA}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,0.18)", background: "white", color: "#DC2626", font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                      >
                        <X size={13} />
                        Desvincular
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
                        onClick={() => handleTabChange("membresias")}
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
                      gridTemplateColumns: "44px minmax(0, 1fr) auto",
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
                    <div>{item.action}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "landing" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Globe size={18} color="white" />}
              title="Landing"
              desc="Tu página pública tiene su propia pestaña para que no quede perdida entre ajustes menores."
              actions={
                <button
                  onClick={handleSaveLanding}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "11px 16px",
                    borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)`,
                    color: "white",
                    font: `800 0.8rem/1 ${fd}`,
                    cursor: "pointer",
                    boxShadow: "0 12px 24px rgba(37,99,235,0.16)",
                  }}
                >
                  <Save size={13} />
                  {landingSaved ? "Guardado ✓" : "Guardar landing"}
                </button>
              }
            >
              <div style={{ display: "grid", gap: 18 }}>
                <div style={{ padding: "16px 18px", borderRadius: 18, background: "linear-gradient(135deg, #F8FAFC 0%, #EEF4FF 100%)", border: "1px solid rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ font: `800 0.84rem/1 ${fd}`, color: t1, marginBottom: 5 }}>Configuración de dominio</p>
                    <p style={{ font: `400 0.76rem/1.45 ${fb}`, color: t2 }}>{publicLandingUrl}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(publicLandingUrl);
                      setCopiedSlug(true);
                      setTimeout(() => setCopiedSlug(false), 1800);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "white", color: t2, font: `700 0.78rem/1 ${fd}`, cursor: "pointer" }}
                  >
                    <Copy size={13} />
                    {copiedSlug ? "Copiado" : "Copiar link"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <Field label="Slug / dominio corto" hint="Se usa en `fitgrowx.app/tugym`. Solo letras, números y guiones.">
                    <input value={gymSlug} onChange={(event) => setGymSlug(slugify(event.target.value))} placeholder="power-house" style={inputStyle} />
                  </Field>

                  <Field label="Color de acento" hint="Impacta la landing pública y el CTA principal.">
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {[ACCENT, "#1E40AF", "#60A5FA", "#0F766E", "#64748B", "#EF4444"].map((color) => (
                        <button
                          key={color}
                          onClick={() => setLandingAccent(color)}
                          style={{ width: 32, height: 32, borderRadius: 10, border: landingAccent === color ? "2px solid #111827" : "1px solid rgba(15,23,42,0.08)", background: color, cursor: "pointer" }}
                        />
                      ))}
                      <input type="color" value={landingAccent} onChange={(event) => setLandingAccent(event.target.value)} style={{ width: 34, height: 34, padding: 0, border: "none", background: "transparent", cursor: "pointer" }} />
                    </div>
                  </Field>
                </div>

                <Field label="Título principal">
                  <input value={landingTitle} onChange={(event) => setLandingTitle(event.target.value)} style={inputStyle} />
                </Field>

                <Field label="Descripción" hint="Este texto aparece abajo del título en tu landing pública.">
                  <textarea value={landingDesc} onChange={(event) => setLandingDesc(event.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
                </Field>

                <div style={{ padding: "16px 18px", borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)" }}>
                  <p style={{ font: `700 0.75rem/1 ${fb}`, color: landingAccent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Preview
                  </p>
                  <p style={{ font: `900 1.1rem/1.1 ${fd}`, color: t1, marginBottom: 8 }}>{landingTitle || "Probá una clase gratis."}</p>
                  <p style={{ font: `400 0.82rem/1.55 ${fb}`, color: t2, marginBottom: 14 }}>{landingDesc || "Vení a conocernos. Te esperamos con una clase de bienvenida totalmente gratis."}</p>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 16px", borderRadius: 12, background: landingAccent, color: "white", font: `800 0.8rem/1 ${fd}` }}>
                    Reservar clase
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "membresias" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <SectionCard
              icon={<CreditCard size={18} color="white" />}
              title="Métodos de cobro"
              desc="Elegí cómo querés que aparezca tu dato de cobro en recordatorios y seguimientos."
              actions={
                <button
                  onClick={handleSaveBilling}
                  disabled={!billingValue.trim()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 20px",
                    borderRadius: 12,
                    border: "none",
                    background: billingValue.trim() ? `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 100%)` : "#D1D5DB",
                    color: "white",
                    font: `800 0.8rem/1 ${fd}`,
                    cursor: billingValue.trim() ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                    minWidth: 174,
                    justifyContent: "center",
                    boxShadow: billingValue.trim() ? "0 12px 24px rgba(37,99,235,0.16)" : "none",
                  }}
                >
                  <Save size={14} />
                  {billingSaved ? "Guardado ✓" : "Guardar cobro"}
                </button>
              }
            >
              <div style={{ display: "grid", gap: 18 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {([
                    { key: "alias", label: "Alias" },
                    { key: "cbu", label: "CBU / CVU" },
                    { key: "mp", label: "Mercado Pago" },
                  ] as const).map((option) => {
                    const selected = metodo === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setMetodo(option.key)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 9999,
                          border: selected ? "1px solid rgba(37,99,235,0.18)" : "1px solid rgba(15,23,42,0.08)",
                          background: selected ? "rgba(37,99,235,0.08)" : "#FFFFFF",
                          color: selected ? ACCENT : t2,
                          font: `${selected ? "800" : "600"} 0.8rem/1 ${fd}`,
                          cursor: "pointer",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {metodo === "alias" && (
                  <Field label="Alias de cobro" hint="Es el formato más claro para WhatsApp y recordatorios rápidos.">
                    <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="mi.gym.alias" style={inputStyle} />
                  </Field>
                )}

                {metodo === "cbu" && (
                  <Field label="CBU / CVU" hint="Usá los 22 dígitos completos para evitar errores de copia.">
                    <input value={cbu} onChange={(event) => setCbu(event.target.value)} maxLength={22} placeholder="0000000000000000000000" style={inputStyle} />
                  </Field>
                )}

                {metodo === "mp" && (
                  <Field label="Link de pago de Mercado Pago" hint="Ideal si querés que el alumno pague directo desde el enlace.">
                    <input value={mpLink} onChange={(event) => setMpLink(event.target.value)} placeholder="https://mpago.la/tu-link" style={inputStyle} />
                  </Field>
                )}

                <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.14)" }}>
                  <p style={{ font: `700 0.75rem/1 ${fb}`, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Preview del mensaje
                  </p>
                  <p style={{ font: `400 0.82rem/1.55 ${fb}`, color: t2 }}>
                    Para renovar tu membresía, pagá por <strong style={{ color: t1 }}>{metodo === "mp" ? "Mercado Pago" : metodo === "cbu" ? "CBU / CVU" : "alias"}</strong>:{" "}
                    <span style={{ color: t1 }}>{billingValue || "completá un dato de cobro"}</span>
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<AlertTriangle size={18} color="white" />}
              title="Suscripción y cancelación"
              desc="Revisá tu plan actual o cancelá tu suscripción cuando lo necesites."
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ padding: "18px 18px", borderRadius: 18, background: "#F8FAFC", border: "1px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ font: `700 0.9rem/1 ${fd}`, color: t1, marginBottom: 4 }}>Ver o cambiar plan</p>
                    <p style={{ font: `400 0.77rem/1.45 ${fb}`, color: t2 }}>Consultá tu suscripción activa y los upgrades disponibles.</p>
                  </div>
                  <Link
                    href="/dashboard/suscripcion"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#111827",
                      color: "white",
                      textDecoration: "none",
                      font: `800 0.8rem/1 ${fd}`,
                    }}
                  >
                    Ver suscripción
                    <ChevronRight size={13} />
                  </Link>
                </div>

                <div style={{ padding: "18px 18px", borderRadius: 18, border: "1px solid rgba(239,68,68,0.14)", background: "rgba(239,68,68,0.03)" }}>
                  <p style={{ font: `800 0.92rem/1 ${fd}`, color: "#DC2626", marginBottom: 8 }}>Cancelar suscripción</p>
                  <p style={{ font: `400 0.78rem/1.55 ${fb}`, color: t2, maxWidth: 420 }}>
                    Tu acceso se mantiene hasta el final del período ya abonado. No hay reintegros proporcionales por los días no utilizados.
                  </p>
                  <Link
                    href="/terminos"
                    target="_blank"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, font: `600 0.75rem/1 ${fb}`, color: t3, textDecoration: "none" }}
                  >
                    <ExternalLink size={11} />
                    Ver política de cancelación
                  </Link>

                  <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={cancelDone}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(239,68,68,0.2)",
                        background: cancelDone ? "rgba(34,197,94,0.08)" : "white",
                        color: cancelDone ? "#16A34A" : "#DC2626",
                        font: `800 0.8rem/1 ${fd}`,
                        cursor: cancelDone ? "default" : "pointer",
                      }}
                    >
                      {cancelDone ? "Cancelación solicitada ✓" : "Cancelar suscripción"}
                    </button>
                    {cancelError && <span style={{ font: `600 0.75rem/1.4 ${fb}`, color: "#DC2626" }}>{cancelError}</span>}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "equipo" && (
          <div style={{ display: "grid", gap: 18 }}>
            <SectionCard
              icon={<Users size={18} color="white" />}
              title="Equipo y accesos"
              desc="Gestioná quién entra al panel y mantené al staff con acceso solo a operación diaria."
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
              {staffLoading ? (
                <p style={{ font: `400 0.84rem/1.4 ${fb}`, color: t3 }}>Cargando equipo...</p>
              ) : staffList.length === 0 ? (
                <div style={{ padding: "24px 20px", borderRadius: 18, background: "#F8FAFC", border: "1px dashed rgba(15,23,42,0.10)" }}>
                  <p style={{ font: `800 0.92rem/1 ${fd}`, color: t1, marginBottom: 6 }}>Todavía no agregaste miembros de staff</p>
                  <p style={{ font: `400 0.8rem/1.5 ${fb}`, color: t2 }}>
                    Creá cuentas para recepción o entrenadores. Van a poder ver alumnos, clases y asistencias.
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
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                          <div>
                            <p style={{ font: `700 0.84rem/1 ${fd}`, color: t1 }}>{member.full_name ?? "Staff"}</p>
                            <p style={{ font: `400 0.76rem/1.4 ${fb}`, color: t3, marginTop: 3 }}>{member.email}</p>
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

        {activeTab === "automatizaciones" && (
          <div style={{ display: "grid", gap: 18 }}>
            <AutomatizacionesPage />
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
                  Creá una cuenta para recepción o entrenadores. Tendrán acceso solo a alumnos, clases y asistencias.
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

              <Field label="Contraseña" hint="Mínimo 6 caracteres. Podés compartirla y luego cambiarla.">
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

      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            background: "rgba(15,23,42,0.50)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, ...card, padding: 26, boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <AlertTriangle size={22} color="#DC2626" />
            </div>
            <h3 style={{ font: `900 1.1rem/1 ${fd}`, color: t1, marginBottom: 10 }}>Confirmar cancelación</h3>
            <p style={{ font: `400 0.84rem/1.55 ${fb}`, color: t2, marginBottom: 18 }}>
              Vas a cancelar la suscripción del gym. El acceso se mantiene hasta el final del período ya abonado.
            </p>
            {cancelError && <p style={{ font: `600 0.78rem/1.4 ${fb}`, color: "#DC2626", marginBottom: 14 }}>{cancelError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "white", color: t2, font: `700 0.8rem/1 ${fd}`, cursor: "pointer" }}
              >
                Volver
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                style={{ padding: "11px 16px", borderRadius: 12, border: "none", background: "#DC2626", color: "white", font: `800 0.8rem/1 ${fd}`, cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.7 : 1 }}
              >
                {cancelling ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
