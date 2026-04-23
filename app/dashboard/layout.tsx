"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Home, Users, CreditCard, Wallet, TrendingDown, Settings, LogOut,
  Search, Bell, Mail, ChevronLeft, ChevronRight,
  Zap, ChevronDown, MessageSquare, Target, Megaphone, CalendarDays, ScanLine,
  Clock, AlertTriangle, X, UserPlus, DollarSign, Inbox, FolderOpen,
} from "lucide-react";
import WelcomeModal from "./components/WelcomeModal";
import FloatingSupport from "@/components/FloatingSupport";

const MP_LINK   = process.env.NEXT_PUBLIC_FITGROWX_MP_LINK   ?? "#";
const USDT_ADDR = process.env.NEXT_PUBLIC_FITGROWX_USDT_ADDR ?? "";
const BTC_ADDR  = process.env.NEXT_PUBLIC_FITGROWX_BTC_ADDR  ?? "";
const t1 = "#1A1D23";
const t2 = "#6B7280";
const t3 = "#9CA3AF";

const NAV_TOP = [
  { href: "/dashboard",                   label: "Inicio",          icon: Home },
  { href: "/dashboard/alumnos",           label: "Alumnos",         icon: Users },
  { href: "/dashboard/clases",            label: "Clases",          icon: CalendarDays },
  { href: "/dashboard/scanner",           label: "Escáner QR",      icon: ScanLine },
  { href: "/dashboard/membresias",        label: "Membresías",      icon: CreditCard },
  { href: "/dashboard/pagos",             label: "Pagos",           icon: Wallet },
  { href: "/dashboard/egresos",           label: "Egresos",         icon: TrendingDown },
  { href: "/dashboard/automatizaciones",  label: "Automatizaciones",icon: MessageSquare },
  { href: "/dashboard/prospectos",        label: "Prospectos",      icon: Target },
  { href: "/dashboard/publicidad",        label: "Campañas",        icon: Megaphone },
  { href: "/dashboard/boveda",            label: "Bóveda",          icon: FolderOpen },
];


const SB_BG        = "#151515";
const SB_FULL      = 240;
const SB_COLLAPSED = 64;
const fd           = "var(--font-inter, 'Inter', sans-serif)";
const fb           = "var(--font-inter, 'Inter', sans-serif)";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isVaultRoute = pathname.startsWith("/dashboard/boveda");

  const [collapsed,        setCollapsed]        = useState(false);
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [userName,         setUserName]         = useState("Admin");
  const [userInitials,     setUserInitials]     = useState("FG");
  const [prospectBadge,    setProspectBadge]    = useState(0);
  const [trialDaysLeft,    setTrialDaysLeft]    = useState<number | null>(null);
  const [showTrialBanner,  setShowTrialBanner]  = useState(false);
  const [showTrialModal,   setShowTrialModal]   = useState(false);
  const [planType,         setPlanType]         = useState<string | null>(null);
  const [gymLogoUrl,       setGymLogoUrl]       = useState<string | null>(null);
  const [gymDisplayName,   setGymDisplayName]   = useState<string | null>(null);

  const menuRef    = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  type Notif = { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string };
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [gymId,       setGymId]       = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fetch user + trial info once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const name = user.email ?? "Admin";
      setUserName(name.split("@")[0]);
      setUserInitials(name.split("@")[0].slice(0, 2).toUpperCase());
      setGymId(user.id);

      const [{ count }, { data: profile }, { data: settings }] = await Promise.all([
        supabase.from("prospectos").select("*", { count: "exact", head: true }).eq("gym_id", user.id).eq("status", "pendiente"),
        supabase.from("profiles").select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type, gym_status)").eq("id", user.id).maybeSingle(),
        supabase.from("gym_settings").select("logo_url, gym_name").eq("gym_id", user.id).maybeSingle(),
      ]);

      setProspectBadge(count ?? 0);
      setGymLogoUrl(settings?.logo_url ?? null);
      setGymDisplayName(settings?.gym_name ?? null);

      const gym = profile?.gyms as { trial_expires_at: string | null; is_subscription_active: boolean; plan_type: string | null; gym_status: string | null } | null;
      setPlanType(gym?.plan_type ?? null);

      if (gym && !gym.is_subscription_active && gym.trial_expires_at) {
        const diff = new Date(gym.trial_expires_at).getTime() - Date.now();
        const left = Math.max(0, Math.ceil(diff / 86_400_000));
        setTrialDaysLeft(left);
        if (left <= 6) setShowTrialBanner(true);
        if (left <= 1) {
          const dismissed = localStorage.getItem("fitgrowx_trial_modal_dismissed");
          if (dismissed !== new Date().toDateString()) setShowTrialModal(true);
        }
      }
    })();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch notifications when gymId is known
  useEffect(() => {
    if (!gymId) return;
    fetch(`/api/notifications?gym_id=${gymId}`)
      .then(r => r.json())
      .then(d => { if (d.notifications) setNotifs(d.notifications); })
      .catch(() => {});
  }, [gymId]);

  const unreadCount = notifs.filter(n => !n.read).length;

  const handleOpenNotifs = () => {
    setNotifOpen(o => !o);
    // Mark all as read when opening
    if (!notifOpen && unreadCount > 0 && gymId) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gym_id: gymId }) })
        .then(() => setNotifs(prev => prev.map(n => ({ ...n, read: true }))))
        .catch(() => {});
    }
  };

  const notifIconMap: Record<string, React.ReactNode> = {
    new_alumno:   <UserPlus size={13} color="#F97316" />,
    new_payment:  <DollarSign size={13} color="#22c55e" />,
    new_prospecto: <Inbox size={13} color="#6366f1" />,
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/start");
    router.refresh();
  };

  const w = collapsed ? SB_COLLAPSED : SB_FULL;

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const navItemStyle = (href: string): React.CSSProperties => ({
    borderRadius: 10,
    padding: collapsed ? "10px 0" : "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: 11,
    fontSize: "0.875rem",
    fontWeight: isActive(href) ? 600 : 500,
    cursor: "pointer",
    transition: "all 0.14s",
    textDecoration: "none",
    fontFamily: fb,
    background: isActive(href) ? "rgba(255,255,255,0.10)" : "transparent",
    color: isActive(href) ? "#FFFFFF" : "rgba(255,255,255,0.50)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  });

  const logoutStyle: React.CSSProperties = {
    borderRadius: 10,
    padding: collapsed ? "10px 0" : "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: 11,
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.14s",
    background: "transparent",
    color: "rgba(255,255,255,0.50)",
    border: "none",
    textAlign: "left",
    width: "100%",
    fontFamily: fb,
    overflow: "hidden",
    whiteSpace: "nowrap",
  };


  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0D0F12" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        background: SB_BG,
        width: w,
        height: "calc(100vh - 24px)",
        minHeight: "calc(100vh - 24px)",
        position: "sticky",
        top: 12,
        flexShrink: 0,
        margin: "12px 0 12px 12px",
        borderRadius: 20,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? "26px 8px" : "26px 16px",
        overflow: "hidden",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), padding 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}>

        {/* Logo + collapse toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: 32, padding: "0 2px", gap: 8, minHeight: 40 }}>
          {!collapsed && (
            <div style={{
              borderRadius: 12, padding: "6px 10px",
              background: "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.30)",
              border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
            }}>
              {planType === "full_marca" && gymLogoUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={gymLogoUrl} alt={gymDisplayName ?? "Logo"} style={{ height: 32, maxWidth: 130, objectFit: "contain", display: "block" }} />
                : <Image src="/images/logo-fitgrowx.png" alt="FitGrowX" width={130} height={32} style={{ objectFit: "contain", display: "block" }} priority />
              }
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expandir" : "Colapsar"}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav top */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_TOP.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} style={navItemStyle(href)} title={collapsed ? label : undefined}>
              <Icon size={16} style={{ opacity: isActive(href) ? 1 : 0.65, flexShrink: 0 }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{label}</span>
                  {href === "/dashboard/prospectos" && prospectBadge > 0 && (
                    <span style={{ background: "#F97316", color: "white", borderRadius: 9999, fontSize: "0.6rem", fontWeight: 700, fontFamily: fd, padding: "2px 6px", minWidth: 16, textAlign: "center" as const, lineHeight: 1.4 }}>
                      {prospectBadge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "8px 4px" }} />

        {/* Nav bottom — logout only */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button onClick={handleSignOut} style={logoutStyle} title={collapsed ? "Salir" : undefined}>
            <LogOut size={16} style={{ opacity: 0.65, flexShrink: 0 }} />
            {!collapsed && "Salir"}
          </button>
        </div>

        {/* Soporte Banner */}
        {!collapsed && (
          <>
            <style>{`
              @keyframes borderBreath {
                0%, 100% { box-shadow: 0 0 0 0 rgba(110,168,254,0), 0 2px 14px rgba(10,22,40,0.60); }
                50%       { box-shadow: 0 0 14px 2px rgba(110,168,254,0.22), 0 2px 14px rgba(10,22,40,0.60); }
              }
              @keyframes glowPulse {
                0%, 100% { opacity: 0.45; transform: scale(1); }
                50%       { opacity: 0.75; transform: scale(1.3); }
              }
              @keyframes iconBounce {
                0%, 100% { transform: translateY(0); }
                40%       { transform: translateY(-3px); }
                60%       { transform: translateY(-1px); }
              }
              @keyframes shimmer {
                0%   { left: -70%; }
                100% { left: 130%; }
              }
              .support-btn-shimmer::after {
                content: '';
                position: absolute;
                top: 0; left: -70%;
                width: 50%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
                transform: skewX(-18deg);
                animation: shimmer 2.6s ease-in-out infinite;
                pointer-events: none;
              }
            `}</style>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_FITGROWX_SUPPORT_WA ?? ""}?text=${encodeURIComponent("Hola! Tengo una sugerencia para FitGrowX.")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ borderRadius: 16, padding: "14px 16px", marginTop: "auto", position: "relative", overflow: "hidden", background: "linear-gradient(145deg, #0a1628 0%, #0d1f3c 40%, #000000 100%)", border: "1px solid rgba(110,168,254,0.18)", display: "block", textDecoration: "none" }}
            >
              {/* Grain overlay */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
                <filter id="grain-support">
                  <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#grain-support)" />
              </svg>
              {/* Breathing glow */}
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,80,200,0.55) 0%, transparent 70%)", pointerEvents: "none", animation: "glowPulse 3s ease-in-out infinite" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, position: "relative", zIndex: 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(30,80,200,0.30)", border: "1px solid rgba(30,80,200,0.40)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "iconBounce 3s ease-in-out infinite" }}>
                  <MessageSquare size={13} color="#6ea8fe" />
                </div>
                <span style={{ font: `700 0.8rem/1 ${fd}`, color: "white" }}>Siempre mejorando para vos</span>
              </div>
              <p style={{ font: `400 0.72rem/1.45 ${fb}`, color: "rgba(255,255,255,0.55)", marginBottom: 12, position: "relative", zIndex: 1 }}>
                Tu feedback nos ayuda a construir algo mejor. Contanos qué necesitás.
              </p>
              <div className="support-btn-shimmer" style={{ width: "100%", padding: "8px", borderRadius: 9999, background: "linear-gradient(135deg, #1e3fa0, #0a1628)", color: "white", border: "1px solid rgba(110,168,254,0.30)", fontWeight: 700, fontSize: "0.75rem", fontFamily: fd, letterSpacing: "0.02em", position: "relative", zIndex: 1, textAlign: "center", overflow: "hidden", animation: "borderBreath 3s ease-in-out infinite" }}>
                Mandanos un mensaje
              </div>
            </a>
          </>
        )}
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: isVaultRoute ? "#ECEFF3" : "#f8fafc", borderRadius: 20, margin: "12px 12px 12px 8px" }}>

        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "11px 20px",
          margin: "12px 0 0",
          position: "sticky", top: 12, zIndex: 10,
          borderRadius: scrolled ? 16 : 0,
          background: scrolled ? "rgba(248,250,252,0.82)" : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06)" : "none",
          transition: "background 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease, border-radius 0.25s ease",
        }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 440 }}>
            <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input style={{ width: "100%", padding: "9px 18px 9px 36px", background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 9999, fontSize: "0.85rem", color: "#475569", outline: "none", fontFamily: fb }} placeholder="Buscar alumnos, planes..." />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 5, display: "flex", alignItems: "center" }}>
              <Mail size={19} />
              <span style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, background: "#EF4444", borderRadius: "50%", border: "2px solid white" }} />
            </button>
            {/* ── Notification Bell ── */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={handleOpenNotifs}
                style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 5, display: "flex", alignItems: "center" }}
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, background: "#F97316", borderRadius: "50%", border: "2px solid white" }} />
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: 340,
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  zIndex: 50,
                  overflow: "hidden",
                  animation: "dropIn 0.16s cubic-bezier(0.34,1.56,0.64,1) both",
                }}>
                  <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ font: `700 0.875rem/1 ${fd}`, color: "#1A1D23" }}>Notificaciones</span>
                    {notifs.length > 0 && (
                      <span style={{ font: `500 0.72rem/1 ${fd}`, color: "#9CA3AF" }}>{notifs.length} total</span>
                    )}
                  </div>

                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <Bell size={28} color="#D1D5DB" style={{ margin: "0 auto 10px", display: "block" }} />
                        <p style={{ font: `500 0.82rem/1 ${fd}`, color: "#9CA3AF", margin: 0 }}>Sin notificaciones</p>
                      </div>
                    ) : (
                      notifs.map(n => (
                        <div key={n.id} style={{
                          display: "flex", gap: 10, padding: "11px 16px",
                          borderBottom: "1px solid rgba(0,0,0,0.04)",
                          background: n.read ? "transparent" : "rgba(249,115,22,0.03)",
                          transition: "background 0.12s",
                        }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: n.type === "new_alumno" ? "rgba(249,115,22,0.1)" : n.type === "new_payment" ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            {notifIconMap[n.type] ?? <Bell size={13} color="#6B7280" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, font: `600 0.82rem/1.2 ${fd}`, color: "#1A1D23" }}>{n.title}</p>
                            {n.body && <p style={{ margin: "2px 0 0", font: `400 0.75rem/1.4 ${fd}`, color: "#6B7280" }}>{n.body}</p>}
                            <p style={{ margin: "4px 0 0", font: `400 0.7rem/1 ${fd}`, color: "#9CA3AF" }}>{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F97316", flexShrink: 0, marginTop: 6 }} />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Profile dropdown ── */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: menuOpen ? "#F4F5F9" : "none", border: menuOpen ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent", borderRadius: 10, padding: "5px 8px 5px 5px", cursor: "pointer", transition: "all 0.14s" }}
                onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = "#F4F5F9"; }}
                onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = "none"; }}
              >
                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.65rem", color: "white", flexShrink: 0, fontFamily: fd }}>
                  {userInitials}
                </div>
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1A1D23", whiteSpace: "nowrap", fontFamily: fd }}>{userName}</span>
                <ChevronDown size={13} color="#9CA3AF" style={{ transition: "transform 0.18s", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  width: 280,
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                  zIndex: 50,
                  overflow: "hidden",
                  animation: "dropIn 0.16s cubic-bezier(0.34,1.56,0.64,1) both",
                }}>
                  <style>{`
                    @keyframes dropIn {
                      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                      to   { opacity: 1; transform: translateY(0)   scale(1); }
                    }
                  `}</style>

                  {/* User info */}
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.68rem", color: "white", flexShrink: 0, fontFamily: fd }}>
                        {userInitials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ font: `700 0.875rem/1 ${fd}`, color: "#1A1D23", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p>
                        <p style={{ font: `400 0.72rem/1 ${fb}`, color: "#9CA3AF", marginTop: 3 }}>Administrador</p>
                      </div>
                    </div>

                  </div>

                  {/* Menu items */}
                  <div style={{ padding: "6px" }}>

                    {/* Planes y Suscripción — link a página */}
                    <Link
                      href="/dashboard/planes"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, textDecoration: "none", color: "#1A1D23", font: `500 0.845rem/1 ${fb}`, transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(249,115,22,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Zap size={13} color="#F97316" />
                      </div>
                      Planes y Suscripción
                    </Link>

                    <Link
                      href="/dashboard/ajustes"
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, textDecoration: "none", color: "#1A1D23", font: `500 0.845rem/1 ${fb}`, transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F4F5F9")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(75,107,251,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Settings size={13} color="#4B6BFB" />
                      </div>
                      Ajustes del Gimnasio
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div style={{ padding: "6px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <button
                      onClick={handleSignOut}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, width: "100%", background: "none", border: "none", cursor: "pointer", color: "#DC2626", font: `500 0.845rem/1 ${fb}`, textAlign: "left", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(220,38,38,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <LogOut size={13} color="#DC2626" />
                      </div>
                      Cerrar sesión
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Trial countdown banner (day 10+) ── */}
        {showTrialBanner && trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, padding: "9px 20px",
            background: trialDaysLeft <= 2 ? "rgba(220,38,38,0.07)" : "rgba(217,119,6,0.07)",
            borderBottom: `1px solid ${trialDaysLeft <= 2 ? "rgba(220,38,38,0.18)" : "rgba(217,119,6,0.18)"}`,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={13} color={trialDaysLeft <= 2 ? "#DC2626" : "#D97706"} />
              <span style={{ font: `500 0.8rem/1 ${fd}`, color: trialDaysLeft <= 2 ? "#DC2626" : "#D97706" }}>
                Tu prueba vence en{" "}
                <strong>{trialDaysLeft} día{trialDaysLeft !== 1 ? "s" : ""}</strong>.
                Suscribite para no perder el acceso.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/dashboard/suscripcion" style={{
                font: `700 0.72rem/1 ${fd}`, color: "white",
                background: trialDaysLeft <= 2 ? "#DC2626" : "#D97706",
                padding: "5px 12px", borderRadius: 9999, textDecoration: "none",
                whiteSpace: "nowrap",
              }}>Ver planes</Link>
              <button onClick={() => setShowTrialBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: trialDaysLeft <= 2 ? "#DC2626" : "#D97706", display: "flex", padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, padding: "20px 20px 28px", display: "flex", flexDirection: "column", gap: 18, background: isVaultRoute ? "#ECEFF3" : "transparent" }}>
          {children}
        </main>
        <WelcomeModal />
      </div>

      <FloatingSupport />

      {/* ── Trial last-24h modal ── */}
      {showTrialModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: 22, padding: "36px 32px", maxWidth: 420, width: "100%",
            boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
            animation: "dropIn 0.28s cubic-bezier(0.16,1,0.3,1) both",
            textAlign: "center",
          }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.16)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertTriangle size={26} color="#DC2626" />
            </div>
            <p style={{ font: `800 1.4rem/1.1 ${fd}`, color: "#1A1D23", marginBottom: 8, letterSpacing: "-0.025em" }}>
              Últimas 24 horas de prueba
            </p>
            <p style={{ font: `400 0.875rem/1.55 ${fd}`, color: "#6B7280", marginBottom: 28 }}>
              Tu período de prueba gratuita vence mañana. Elegí un plan ahora para seguir usando FitGrowX sin interrupciones.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link
                href="/dashboard/suscripcion"
                onClick={() => {
                  localStorage.setItem("fitgrowx_trial_modal_dismissed", new Date().toDateString());
                  setShowTrialModal(false);
                }}
                style={{
                  display: "block", padding: "13px", borderRadius: 14,
                  background: "#1A1D23", color: "white", textDecoration: "none",
                  font: `700 0.875rem/1 ${fd}`, textAlign: "center",
                }}
              >
                Ver planes y suscribirme
              </Link>
              <button
                onClick={() => {
                  localStorage.setItem("fitgrowx_trial_modal_dismissed", new Date().toDateString());
                  setShowTrialModal(false);
                }}
                style={{
                  padding: "11px", borderRadius: 14, background: "none",
                  border: "1px solid rgba(0,0,0,0.08)", color: "#9CA3AF",
                  font: `500 0.82rem/1 ${fd}`, cursor: "pointer",
                }}
              >
                Recordarme más tarde
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
