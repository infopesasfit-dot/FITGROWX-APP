"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LandingHeaderProps =
  | {
      actionType: "link";
      actionLabel: string;
      actionHref: string;
    }
  | {
      actionType: "button";
      actionLabel: string;
      onAction: () => void;
    };

const NAV_ITEMS = [
  { href: "/#beneficios", label: "Beneficios" },
  { href: "/#demo", label: "Demo" },
  { href: "/#planes", label: "Planes" },
];

export function LandingHeader(props: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 18);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  return (
    <header
      data-scrolled={isScrolled ? "true" : "false"}
      className="landing-header fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 lg:px-8"
    >
      <div className="landing-header-shell mx-auto flex max-w-6xl items-center justify-between px-5 py-3 lg:px-7">
        <Link href="/" className="landing-brand group relative inline-flex shrink-0 items-center overflow-hidden rounded-full px-2 py-1">
          <span className="landing-brand-glow" />
          <span className="landing-brand-text relative z-10">
            FITGROW<span className="text-[#FF7A1A]">X</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="landing-nav-link group relative overflow-hidden rounded-full px-4 py-2 text-[13px] font-medium tracking-[-0.01em] text-white/45"
            >
              <span className="landing-nav-link-glow" />
              <span className="landing-nav-base relative z-10">{item.label}</span>
              <span className="landing-nav-reveal absolute inset-0 z-10 flex items-center justify-center text-white/90">
                <span className="landing-nav-caret" />
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {props.actionType === "link" ? (
            <Link
              href={props.actionHref}
              className="landing-header-cta group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] text-white/85 sm:px-5"
            >
              <span className="landing-header-cta-glow" />
              <span className="relative z-10 hidden sm:inline">{props.actionLabel}</span>
              <span className="relative z-10 sm:hidden">Probar</span>
              <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <button
              onClick={props.onAction}
              className="landing-header-cta group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] text-white/85 sm:px-5"
            >
              <span className="landing-header-cta-glow" />
              <span className="relative z-10">{props.actionLabel}</span>
            </button>
          )}

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            className="md:hidden relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div ref={mobileMenuRef} className="md:hidden mx-auto mt-2 max-w-6xl px-1">
          <nav className="flex flex-col gap-1 rounded-2xl border border-white/[0.08] bg-black/80 p-3 shadow-2xl backdrop-blur-2xl">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90 active:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
