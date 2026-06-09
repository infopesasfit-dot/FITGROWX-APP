"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Activity, BookOpen, Building2, ChevronDown, ClipboardList, CreditCard, Heart, LogOut, MessageCircle, Shield, Users } from "lucide-react";

export default function PlatformHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenu]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/start");
  }

  const isUnder = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

  const dropdownItem = (href: string, icon: React.ReactNode, label: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 14px",
    color: isUnder(href) ? "#6366f1" : "#374151",
    textDecoration: "none",
    font: "500 0.78rem/1 'Inter', sans-serif",
    background: isUnder(href) ? "rgba(99,102,241,0.06)" : "transparent",
  });

  const dropdownBox: React.CSSProperties = {
    position: "absolute", top: "100%", left: 0, marginTop: 6,
    background: "white", borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    border: "1px solid rgba(0,0,0,0.06)",
    padding: "4px 0", minWidth: 170, zIndex: 200,
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(238,242,246,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(0,0,0,0.07)",
      padding: "0 28px",
      height: 52,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield size={15} color="#6366f1" />
          <Link href="/platform" style={{ font: "700 0.82rem/1 'Inter', sans-serif", color: "#111827", letterSpacing: "-0.01em", textDecoration: "none" }}>
            FitGrowX Platform
          </Link>
        </div>

        {/* Clientes */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setOpenMenu(openMenu === "clientes" ? null : "clientes")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              font: "600 0.75rem/1 'Inter', sans-serif",
              color: (pathname === "/platform" || isUnder("/platform/gyms")) ? "#6366f1" : "#6b7280",
              background: (pathname === "/platform" || isUnder("/platform/gyms")) ? "rgba(99,102,241,0.08)" : "transparent",
              border: "none", cursor: "pointer",
              padding: "4px 8px", borderRadius: 6,
            }}
          >
            <Building2 size={13} />
            Clientes
            <ChevronDown size={11} style={{ transform: openMenu === "clientes" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {openMenu === "clientes" && (
            <div style={dropdownBox}>
              <Link href="/platform" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform", null, "CRM")}>
                <Users size={13} />
                CRM
              </Link>
              <Link href="/platform/gyms" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/gyms", null, "Gyms")}>
                <Building2 size={13} />
                Gyms
              </Link>
            </div>
          )}
        </div>

        {/* Operaciones */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setOpenMenu(openMenu === "ops" ? null : "ops")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              font: "600 0.75rem/1 'Inter', sans-serif",
              color: (isUnder("/platform/pagos") || isUnder("/platform/radar") || isUnder("/platform/pulso")) ? "#6366f1" : "#6b7280",
              background: (isUnder("/platform/pagos") || isUnder("/platform/radar") || isUnder("/platform/pulso")) ? "rgba(99,102,241,0.08)" : "transparent",
              border: "none", cursor: "pointer",
              padding: "4px 8px", borderRadius: 6,
            }}
          >
            <Activity size={13} />
            Operaciones
            <ChevronDown size={11} style={{ transform: openMenu === "ops" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {openMenu === "ops" && (
            <div style={dropdownBox}>
              <Link href="/platform/pagos" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/pagos", null, "Pagos")}>
                <CreditCard size={13} />
                Pagos
              </Link>
              <Link href="/platform/radar" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/radar", null, "Radar")}>
                <Activity size={13} />
                Radar
              </Link>
              <Link href="/platform/pulso" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/pulso", null, "Pulso")}>
                <Heart size={13} />
                Pulso
              </Link>
            </div>
          )}
        </div>

        {/* Resellers */}
        <Link
          href="/platform/resellers"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            font: "600 0.75rem/1 'Inter', sans-serif",
            color: isUnder("/platform/resellers") ? "#6366f1" : "#6b7280",
            textDecoration: "none",
            padding: "4px 8px", borderRadius: 6,
            background: isUnder("/platform/resellers") ? "rgba(99,102,241,0.08)" : "transparent",
          }}
        >
          <Users size={13} />
          Resellers
        </Link>

        {/* Config */}
        <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setOpenMenu(openMenu === "config" ? null : "config")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              font: "600 0.75rem/1 'Inter', sans-serif",
              color: (isUnder("/platform/auditoria") || isUnder("/platform/whatsapp") || isUnder("/platform/cms")) ? "#6366f1" : "#6b7280",
              background: (isUnder("/platform/auditoria") || isUnder("/platform/whatsapp") || isUnder("/platform/cms")) ? "rgba(99,102,241,0.08)" : "transparent",
              border: "none", cursor: "pointer",
              padding: "4px 8px", borderRadius: 6,
            }}
          >
            <ClipboardList size={13} />
            Config
            <ChevronDown size={11} style={{ transform: openMenu === "config" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {openMenu === "config" && (
            <div style={dropdownBox}>
              <Link href="/platform/auditoria" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/auditoria", null, "Auditoría")}>
                <ClipboardList size={13} />
                Auditoría
              </Link>
              <Link href="/platform/whatsapp" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/whatsapp", null, "WhatsApp Plataforma")}>
                <MessageCircle size={13} />
                WhatsApp Plataforma
              </Link>
              <Link href="/platform/cms" onClick={() => setOpenMenu(null)} style={dropdownItem("/platform/cms", null, "CMS Bóveda")}>
                <BookOpen size={13} />
                CMS Bóveda
              </Link>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {email && (
          <span style={{ font: "400 0.78rem/1 'Inter', sans-serif", color: "#9CA3AF" }}>
            {email}
          </span>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8,
            background: "rgba(0,0,0,0.05)", border: "none",
            font: "600 0.78rem/1 'Inter', sans-serif", color: "#374151",
            cursor: "pointer",
          }}
        >
          <LogOut size={13} />
          Salir
        </button>
      </div>
    </header>
  );
}
