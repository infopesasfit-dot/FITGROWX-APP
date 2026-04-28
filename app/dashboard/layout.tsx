"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Home, Users, CreditCard, Wallet, TrendingDown, Settings, LogOut,
  Search, Bell, Mail, ChevronLeft, ChevronRight, Menu,
  Zap, ChevronDown, MessageSquare, Target, Megaphone, CalendarDays, ScanLine,
  Clock, AlertTriangle, X, UserPlus, DollarSign, Inbox, FolderOpen, ClipboardList,
  Globe,
} from "lucide-react";
import WelcomeModal from "./components/WelcomeModal";
import { getGymSummary } from "@/lib/supabase-relations";
import { getCachedProfile } from "@/lib/gym-cache";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  sub?: { href: string; label: string }[];
};
type NavSection = { section: string; items: NavItem[] };

const NAV_SECTIONS_ADMIN: NavSection[] = [
  {
    section: "HOY",
    items: [
      { href: "/dashboard",             label: "Inicio",      icon: Home },
      { href: "/dashboard/asistencias", label: "Asistencias", icon: ClipboardList },
      { href: "/dashboard/scanner",     label: "Escáner QR",  icon: ScanLine },
    ],
  },
  {
    section: "ALUMNOS",
    items: [
      { href: "/dashboard/alumnos",    label: "Alumnos",           icon: Users },
      { href: "/dashboard/clases",     label: "Clases y Horarios", icon: CalendarDays },
      { href: "/dashboard/membresias", label: "Membresías",        icon: CreditCard },
    ],
  },
  {
    section: "CRECIMIENTO",
    items: [
      {
        href: "/dashboard/prospectos",
        label: "Atraer Clientes",
        icon: Megaphone,
        sub: [
          { href: "/dashboard/prospectos",          label: "Prospectos" },
          { href: "/dashboard/publicidad",          label: "Campañas" },
          { href: "/dashboard/ajustes?tab=landing", label: "Mi Web / Landing" },
        ],
      },
      { href: "/dashboard/automatizaciones", label: "Automatizaciones",     icon: Zap },
      { href: "/dashboard/boveda",           label: "Bóveda",               icon: FolderOpen },
    ],
  },
  {
    section: "DINERO",
    items: [
      { href: "/dashboard/pagos",   label: "Ingresos", icon: Wallet },
      { href: "/dashboard/egresos", label: "Egresos",  icon: TrendingDown },
    ],
  },
  {
    section: "SISTEMA",
    items: [
      {
        href: "/dashboard/ajustes",
        label: "Configuración",
        icon: Settings,
        sub: [
          { href: "/dashboard/ajustes?tab=general",    label: "General" },
          { href: "/dashboard/ajustes?tab=conexiones", label: "Conexiones" },
          { href: "/dashboard/ajustes?tab=equipo",     label: "Equipo" },
        ],
      },
    ],
  },
];

const NAV_SECTIONS_STAFF: NavSection[] = [
  {
    section: "HOY",
    items: [
      { href: "/dashboard",             label: "Inicio",      icon: Home },
      { href: "/dashboard/asistencias", label: "Asistencias", icon: ClipboardList },
      { href: "/dashboard/scanner",     label: "Escáner QR",  icon: ScanLine },
    ],
  },
  {
    section: "GESTIÓN",
    items: [
      { href: "/dashboard/alumnos", label: "Alumnos", icon: Users },
      { href: "/dashboard/clases",  label: "Clases",  icon: CalendarDays },
    ],
  },
];

const ATTRACT_ROUTES = ["/dashboard/prospectos", "/dashboard/publicidad"];
const STAFF_ALLOWED_ROUTES = ["/dashboard", "/dashboard/alumnos", "/dashboard/clases", "/dashboard/scanner", "/dashboard/asistencias"];

const BOTTOM_NAV = [
  { href: "/dashboard",         label: "Inicio",  icon: Home },
  { href: "/dashboard/alumnos", label: "Alumnos", icon: Users },
  { href: "/dashboard/scanner", label: "Escáner", icon: ScanLine },
  { href: "/dashboard/pagos",   label: "Pagos",   icon: Wallet },
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

  const [isMobile,         setIsMobile]         = useState(false);
  const [mobileNavOpen,    setMobileNavOpen]    = useState(false);
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

  type Notif = { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string; link?: string | null };
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [gymId,       setGymId]       = useState<string | null>(null);
  const [role,        setRole]        = useState<"admin" | "staff">("admin");
  const [attractOpen, setAttractOpen] = useState(() => ATTRACT_ROUTES.some(r => pathname.startsWith(r)));
  const [configOpen,  setConfigOpen]  = useState(() => pathname.startsWith("/dashboard/ajustes"));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMobileNavOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  // Staff route protection
  useEffect(() => {
    if (role !== "staff") return;
    const allowed = STAFF_ALLOWED_ROUTES.some(r =>
      r === "/dashboard" ? pathname === r : pathname.startsWith(r)
    );
    if (!allowed) router.replace("/dashboard");
  }, [role, pathname, router]);

  // Fetch user + trial info once
  useEffect(() => {
    (async () => {
      const cachedProfile = await getCachedProfile();
      if (!cachedProfile) return;
      const gymIdVal = cachedProfile.gymId;
      const userIdVal = cachedProfile.userId;
      const roleVal = cachedProfile.role as "admin" | "staff";

      setGymId(gymIdVal);
      setRole(roleVal);

      const { data: { user } } = await supabase.auth.getUser();
      const name = user?.email ?? "Admin";
      setUserName(name.split("@")[0]);
      setUserInitials(name.split("@")[0].slice(0, 2).toUpperCase());

      const [{ count }, { data: profile }, { data: settings }] = await Promise.all([
        supabase.from("prospectos").select("*", { count: "exact", head: true }).eq("gym_id", gymIdVal).eq("status", "pendiente"),
        supabase.from("profiles").select("gym_id, gyms(trial_expires_at, is_subscription_active, plan_type, gym_status)").eq("id", userIdVal).maybeSingle(),
        supabase.from("gym_settings").select("logo_url, gym_name").eq("gym_id", gymIdVal).maybeSingle(),
      ]);

      setProspectBadge(count ?? 0);
      setGymLogoUrl(settings?.logo_url ?? null);
      setGymDisplayName(settings?.gym_name ?? null);

      const gym = getGymSummary(profile?.gyms);
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
  const notificationsNowMs = notifs.length > 0 ? new Date(notifs[0].created_at).getTime() : 0;

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
    new_alumno:    <UserPlus size={13} color="#F97316" />,
    new_payment:   <DollarSign size={13} color="#FF6A00" />,
    new_prospecto: <Inbox size={13} color="#6ea8fe" />,
    wa_disconnected: <Bell size={13} color="#EF4444" />,
  };

  const timeAgo = (iso: string) => {
    const diff = notificationsNowMs - new Date(iso).getTime();
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
    padding: (!isMobile && collapsed) ? "10px 0" : "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: (!isMobile && collapsed) ? "center" : "flex-start",
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
    padding: (!isMobile && collapsed) ? "10px 0" : "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: (!isMobile && collapsed) ? "center" : "flex-start",
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

      {/* ── Mobile backdrop ── */}
      {isMobile && mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        background: "linear-gradient(160deg, #000000 0%, #0e0e0e 35%, #151515 100%)",
        width: isMobile ? 260 : w,
        height: isMobile ? "100vh" : "calc(100vh - 24px)",
        minHeight: isMobile ? "100vh" : "calc(100vh - 24px)",
        position: isMobile ? "fixed" : "sticky",
        top: isMobile ? 0 : 12,
        left: 0,
        zIndex: isMobile ? 100 : undefined,
        flexShrink: 0,
        margin: isMobile ? 0 : "12px 0 12px 12px",
        borderRadius: isMobile ? "0 20px 20px 0" : 20,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: isMobile ? (mobileNavOpen ? "flex" : "none") : "flex",
        flexDirection: "column",
        padding: (!isMobile && collapsed) ? "26px 8px" : "26px 16px",
        overflow: "hidden",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), padding 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}>

        {/* Blob 1 — top */}
        <div style={{ position: "absolute", top: "-10%", left: "10%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, #323232 0%, transparent 70%)", filter: "blur(72px)", pointerEvents: "none", zIndex: 0 }} />
        {/* Blob 2 — bottom */}
        <div style={{ position: "absolute", bottom: "-8%", right: "-10%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, #272727 0%, transparent 70%)", filter: "blur(90px)", pointerEvents: "none", zIndex: 0 }} />
        {/* Grain overlay — sutil */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.14, pointerEvents: "none", zIndex: 0 }} xmlns="http://www.w3.org/2000/svg">
          <filter id="sb-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#sb-grain)" />
        </svg>

        {/* Logo + collapse/close toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: (!isMobile && collapsed) ? "center" : "space-between", marginBottom: 32, padding: "0 2px", gap: 8, minHeight: 40, position: "relative", zIndex: 1 }}>
          {(isMobile || !collapsed) && (
            <div style={{ flexShrink: 0 }}>
              {planType === "full_marca" && gymLogoUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={gymLogoUrl} alt={gymDisplayName ?? "Logo"} style={{ height: 36, maxWidth: 160, objectFit: "contain", display: "block", filter: "drop-shadow(0 2px 18px rgba(0,0,0,0.90)) drop-shadow(0 1px 6px rgba(0,0,0,0.70))" }} />
                : <Image src="/images/logo-fondo-oscuro.png" alt="FitGrowX" width={500} height={150} style={{ height: 36, width: "auto", objectFit: "contain", display: "block", filter: "drop-shadow(0 2px 18px rgba(0,0,0,0.90)) drop-shadow(0 1px 6px rgba(0,0,0,0.70))" }} priority unoptimized />
              }
            </div>
          )}
          <button
            onClick={() => isMobile ? setMobileNavOpen(false) : setCollapsed(c => !c)}
            title={isMobile ? "Cerrar" : (collapsed ? "Expandir" : "Colapsar")}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.14s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
          >
            {isMobile ? <X size={14} /> : (collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
          </button>
        </div>

        {/* Nav top */}
        <style>{`
          .sb-nav::-webkit-scrollbar { width: 3px; }
          .sb-nav::-webkit-scrollbar-track { background: transparent; }
          .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
          .sb-nav { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
        `}</style>
        <nav className="sb-nav" style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          {(role === "staff" ? NAV_SECTIONS_STAFF : NAV_SECTIONS_ADMIN).map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 2 }}>
              {(isMobile || !collapsed) ? (
                <p style={{ font: `600 0.58rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "12px 14px 4px", margin: 0 }}>
                  {section}
                </p>
              ) : (
                <div style={{ margin: "8px 0 3px", borderTop: "1px solid rgba(255,255,255,0.07)" }} />
              )}

              {items.map((item) => {
                const Icon = item.icon;

                /* ── Collapsible group ── */
                if (item.sub) {
                  const isAttract = item.href === "/dashboard/prospectos";
                  const open      = isAttract ? attractOpen : configOpen;
                  const setOpen   = isAttract ? setAttractOpen : setConfigOpen;
                  const anyActive = item.sub.some(s => pathname.startsWith(s.href.split("?")[0]) && (isAttract || pathname === "/dashboard/ajustes"));

                  if (!isMobile && collapsed) {
                    return (
                      <Link key={item.href} href={item.href} style={navItemStyle(item.href)} title={item.label}>
                        <Icon size={16} style={{ opacity: anyActive ? 1 : 0.65, flexShrink: 0 }} />
                      </Link>
                    );
                  }
                  return (
                    <div key={item.href}>
                      <button
                        onClick={() => setOpen(o => !o)}
                        style={{
                          borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center",
                          gap: 11, width: "100%", border: "none", textAlign: "left" as const, cursor: "pointer",
                          background: anyActive ? "rgba(255,255,255,0.10)" : "transparent",
                          color: anyActive ? "#FFFFFF" : "rgba(255,255,255,0.50)",
                          fontFamily: fb, fontSize: "0.875rem", fontWeight: anyActive ? 600 : 500,
                          transition: "all 0.14s",
                        }}
                      >
                        <Icon size={16} style={{ opacity: anyActive ? 1 : 0.65, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {isAttract && prospectBadge > 0 && !open && (
                          <span style={{ background: "#F97316", color: "white", borderRadius: 9999, fontSize: "0.6rem", fontWeight: 700, fontFamily: fd, padding: "2px 6px", lineHeight: 1.4 }}>
                            {prospectBadge}
                          </span>
                        )}
                        <ChevronDown size={12} style={{ opacity: 0.4, flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                      </button>
                      {open && (
                        <div style={{ paddingLeft: 14, marginBottom: 2 }}>
                          {item.sub.map(s => {
                            const subActive = pathname.startsWith(s.href.split("?")[0]) && (!s.href.includes("?") || true);
                            return (
                              <Link key={s.href} href={s.href} style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "7px 10px 7px 14px",
                                borderLeft: `2px solid ${subActive ? "rgba(249,115,22,0.55)" : "rgba(255,255,255,0.09)"}`,
                                borderRadius: "0 8px 8px 0", marginBottom: 1,
                                textDecoration: "none", fontSize: "0.82rem",
                                fontWeight: subActive ? 600 : 400, fontFamily: fb,
                                color: subActive ? "#FFFFFF" : "rgba(255,255,255,0.42)",
                                background: subActive ? "rgba(255,255,255,0.05)" : "transparent",
                                transition: "all 0.12s",
                              }}>
                                <span style={{ flex: 1 }}>{s.label}</span>
                                {s.href === "/dashboard/prospectos" && prospectBadge > 0 && (
                                  <span style={{ background: "#F97316", color: "white", borderRadius: 9999, fontSize: "0.6rem", fontWeight: 700, fontFamily: fd, padding: "2px 6px", lineHeight: 1.4 }}>
                                    {prospectBadge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                /* ── Regular item ── */
                return (
                  <Link key={item.href} href={item.href} style={navItemStyle(item.href)} title={(!isMobile && collapsed) ? item.label : undefined}>
                    <Icon size={16} style={{ opacity: isActive(item.href) ? 1 : 0.65, flexShrink: 0 }} />
                    {(isMobile || !collapsed) && <span style={{ flex: 1 }}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 6, position: "relative", zIndex: 1 }}>
          <button onClick={handleSignOut} style={logoutStyle} title={(!isMobile && collapsed) ? "Cerrar sesión" : undefined}>
            <LogOut size={16} style={{ opacity: 0.65, flexShrink: 0 }} />
            {(isMobile || !collapsed) && <span>Cerrar sesión</span>}
          </button>
        </div>

      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: isVaultRoute ? "#ECEFF3" : (isMobile ? "#F0F2F7" : "#f8fafc"), borderRadius: isMobile ? 0 : 20, margin: isMobile ? 0 : "12px 12px 12px 8px" }}>

        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", gap: isMobile ? 8 : 14,
          padding: isMobile ? "10px 14px" : "11px 20px",
          margin: isMobile ? "0" : "12px 0 0",
          position: "sticky", top: isMobile ? 0 : 12, zIndex: 10,
          borderRadius: scrolled ? 16 : 0,
          background: isMobile ? "#151515" : (scrolled ? "rgba(248,250,252,0.82)" : "transparent"),
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          boxShadow: isMobile ? "0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.30)" : (scrolled ? "0 1px 0 rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06)" : "none"),
          transition: "background 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease, border-radius 0.25s ease",
        }}>
          {/* Mobile: show gym logo / brand in topbar instead of hamburger */}
          {isMobile && (
            <div style={{ flexShrink: 0 }}>
              {planType === "full_marca" && gymLogoUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={gymLogoUrl} alt={gymDisplayName ?? "Logo"} style={{ height: 28, maxWidth: 100, objectFit: "contain", display: "block" }} />
                : <Image src="/images/logo-fondo-oscuro.png" alt="FitGrowX" width={300} height={90} style={{ height: 24, width: "auto", objectFit: "contain", display: "block" }} priority unoptimized />
              }
            </div>
          )}

          {/* Search — hidden on mobile */}
          {!isMobile && (
            <div style={{ position: "relative", flex: 1, maxWidth: 440 }}>
              <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input style={{ width: "100%", padding: "9px 18px 9px 36px", background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 9999, fontSize: "0.85rem", color: "#475569", outline: "none", fontFamily: fb }} placeholder="Buscar alumnos, planes..." />
            </div>
          )}

          {/* Spacer on mobile to push actions right */}
          {isMobile && <span style={{ flex: 1 }} />}

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, marginLeft: isMobile ? 0 : "auto" }}>
            {!isMobile && (
              <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 5, display: "flex", alignItems: "center" }}>
                <Mail size={19} />
                <span style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, background: "#EF4444", borderRadius: "50%", border: "2px solid white" }} />
              </button>
            )}
            {/* ── Notification Bell ── */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={handleOpenNotifs}
                style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: isMobile ? "rgba(255,255,255,0.6)" : "#6B7280", padding: 5, display: "flex", alignItems: "center" }}
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, background: "#F97316", borderRadius: "50%", border: `2px solid ${isMobile ? "#151515" : "white"}` }} />
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  width: isMobile ? "calc(100vw - 28px)" : 340,
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
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: n.type === "new_alumno" ? "rgba(249,115,22,0.1)" : n.type === "new_payment" ? "rgba(255,106,0,0.1)" : "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            {notifIconMap[n.type] ?? <Bell size={13} color="#6B7280" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, font: `600 0.82rem/1.2 ${fd}`, color: "#1A1D23" }}>{n.title}</p>
                            {n.body && (
                              n.link
                                ? <Link href={n.link} style={{ margin: "2px 0 0", display: "block", font: `400 0.75rem/1.4 ${fd}`, color: "#F97316", textDecoration: "underline" }}>{n.body}</Link>
                                : <p style={{ margin: "2px 0 0", font: `400 0.75rem/1.4 ${fd}`, color: "#6B7280" }}>{n.body}</p>
                            )}
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
                style={{ display: "flex", alignItems: "center", gap: 8, background: menuOpen ? (isMobile ? "rgba(255,255,255,0.08)" : "#F4F5F9") : "none", border: menuOpen ? (isMobile ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)") : "1px solid transparent", borderRadius: 10, padding: "5px 8px 5px 5px", cursor: "pointer", transition: "all 0.14s" }}
                onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = isMobile ? "rgba(255,255,255,0.08)" : "#F4F5F9"; }}
                onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = "none"; }}
              >
                {/* Avatar */}
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.65rem", color: "white", flexShrink: 0, fontFamily: fd }}>
                  {userInitials}
                </div>
                {!isMobile && <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1A1D23", whiteSpace: "nowrap", fontFamily: fd }}>{userName}</span>}
                {!isMobile && <ChevronDown size={13} color="#9CA3AF" style={{ transition: "transform 0.18s", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />}
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  width: isMobile ? "min(280px, calc(100vw - 28px))" : 280,
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
                        <p style={{ font: `400 0.72rem/1 ${fb}`, color: "#9CA3AF", marginTop: 3 }}>{role === "staff" ? "Staff" : "Administrador"}</p>
                      </div>
                    </div>

                  </div>

                  {/* Menu items */}
                  <div style={{ padding: "6px" }}>
                    {role === "admin" && (
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
                    )}
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
        {role === "admin" && showTrialBanner && trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 8, padding: isMobile ? "8px 14px" : "9px 20px",
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
        <main style={{ flex: 1, padding: isMobile ? "14px 12px 90px" : "20px 20px 28px", display: "flex", flexDirection: "column", gap: 18, background: isVaultRoute ? "#ECEFF3" : "transparent" }}>
          {children}
        </main>
        <WelcomeModal />
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
          background: "rgba(21,21,21,0.86)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom, 8px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
        }}>
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: "10px 4px 8px", textDecoration: "none",
                color: active ? "#FF6A00" : "rgba(255,255,255,0.38)",
                transition: "color 0.15s",
              }}>
                <div style={{
                  width: 38, height: 28, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? "rgba(255,106,0,0.14)" : "transparent",
                  transition: "background 0.15s",
                }}>
                  <Icon size={19} />
                </div>
                <span style={{ font: `${active ? 700 : 400} 0.6rem/1 ${fd}`, letterSpacing: "0.02em" }}>{label}</span>
              </Link>
            );
          })}
          {/* Más — opens sidebar drawer */}
          <button onClick={() => setMobileNavOpen(true)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer",
            color: mobileNavOpen ? "#FF6A00" : "rgba(255,255,255,0.38)",
            transition: "color 0.15s",
          }}>
            <div style={{
              width: 38, height: 28, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: mobileNavOpen ? "rgba(255,106,0,0.14)" : "transparent",
              transition: "background 0.15s",
            }}>
              <Menu size={19} />
            </div>
            <span style={{ font: `400 0.6rem/1 ${fd}`, letterSpacing: "0.02em" }}>Más</span>
          </button>
        </nav>
      )}


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
