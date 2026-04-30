"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  ChevronDown,
  CircleDollarSign,
  HelpCircle,
  LayoutTemplate,
  Menu,
  MessageCircleMore,
  PlayCircle,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

type MenuLeaf = {
  href: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

type NavItem =
  | {
      label: string;
      href: string;
    }
  | {
      label: string;
      items: MenuLeaf[];
    };

const NAV_ITEMS: NavItem[] = [
  {
    label: "Producto",
    items: [
      {
        href: "/#beneficios",
        label: "Cobros automáticos",
        description: "Recordatorios, vencimientos y seguimiento sin perseguir pagos a mano.",
        icon: CircleDollarSign,
      },
      {
        href: "/#beneficios",
        label: "Leads & WhatsApp",
        description: "Captación, respuestas y seguimiento para no perder consultas calientes.",
        icon: MessageCircleMore,
      },
      {
        href: "/#demo",
        label: "Ver demo del sistema",
        description: "Una mirada rápida a cómo se ve el día a día dentro de FitGrowX.",
        icon: PlayCircle,
      },
      {
        href: "/#demo",
        label: "Landing & automatización",
        description: "Tu entrada comercial conectada con el seguimiento operativo del gimnasio.",
        icon: LayoutTemplate,
      },
    ],
  },
  {
    label: "Precios",
    href: "/#planes",
  },
  {
    label: "Recursos",
    items: [
      {
        href: "/guia",
        label: "Guía paso a paso",
        description: "Configurá FitGrowX desde cero con un orden claro y pensado para gimnasios reales.",
        icon: BookOpenText,
      },
      {
        href: "/faq",
        label: "FAQ",
        description: "Preguntas frecuentes sobre operación, configuración y uso diario del sistema.",
        icon: HelpCircle,
      },
      {
        href: "/privacidad",
        label: "Privacidad",
        description: "Cómo cuidamos los datos del gimnasio, el staff y los alumnos.",
        icon: Sparkles,
      },
    ],
  },
];

function isDropdownItem(item: NavItem): item is Extract<NavItem, { items: MenuLeaf[] }> {
  return "items" in item;
}

export function LandingHeader(props: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryAction = useMemo(() => {
    if (props.actionType === "link") {
      return {
        label: props.actionLabel,
        href: props.actionHref,
      };
    }

    return null;
  }, [props]);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 18);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 140);
  };

  const toggleMobileGroup = (label: string) => {
    setOpenMobileGroup((current) => (current === label ? null : label));
  };

  return (
    <header
      ref={headerRef}
      data-scrolled={isScrolled ? "true" : "false"}
      className="landing-header fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 lg:px-7"
    >
      <div className="landing-header-shell mx-auto flex max-w-[72rem] items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
        <Link href="/" className="landing-brand group relative inline-flex shrink-0 items-center overflow-hidden rounded-full px-2 py-1">
          <span className="landing-brand-glow" />
          <Image
            src="/images/logo-fondo-oscuro.png"
            alt="FitGrowX"
            width={500}
            height={150}
            className="relative z-10 h-8 w-auto object-contain lg:h-7.5"
            priority
            unoptimized
          />
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            if (!isDropdownItem(item)) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="landing-nav-link group relative overflow-hidden rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-[-0.01em] text-white/50"
                >
                  <span className="landing-nav-link-glow" />
                  <span className="landing-nav-base relative z-10">{item.label}</span>
                  <span className="landing-nav-reveal absolute inset-0 z-10 flex items-center justify-center text-white/90">
                    <span className="landing-nav-caret" />
                    {item.label}
                  </span>
                </Link>
              );
            }

            const isOpen = activeMenu === item.label;

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => {
                  clearCloseTimer();
                  setActiveMenu(item.label);
                }}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  onClick={() => setActiveMenu((current) => (current === item.label ? null : item.label))}
                  className="landing-nav-link group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-[-0.01em] text-white/50"
                  aria-expanded={isOpen}
                >
                  <span className="landing-nav-link-glow" />
                  <span className="landing-nav-base relative z-10 inline-flex items-center gap-1.5">
                    {item.label}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180 text-white/80" : ""}`} />
                  </span>
                  <span className="landing-nav-reveal absolute inset-0 z-10 flex items-center justify-center text-white/90">
                    <span className="landing-nav-caret" />
                    {item.label}
                  </span>
                </button>

                {isOpen && (
                  <div className="landing-menu-panel absolute left-1/2 top-[calc(100%+12px)] w-[min(29rem,72vw)] -translate-x-1/2 rounded-[1.5rem] border border-white/[0.09] bg-[rgba(10,10,15,0.96)] p-2.5 shadow-[0_28px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
                    <div className="grid gap-1.5">
                      {item.items.map((subitem) => {
                        const Icon = subitem.icon;
                        return (
                          <Link
                            key={subitem.label}
                            href={subitem.href}
                            className="landing-menu-item flex items-start gap-3 rounded-[1rem] px-3.5 py-3.5 transition-colors duration-200 hover:bg-white/[0.055]"
                            onClick={() => setActiveMenu(null)}
                          >
                            {Icon && (
                              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/[0.08] bg-white/[0.045] text-[#FF8C3A]">
                                <Icon size={17} />
                              </span>
                            )}
                            <span className="flex min-w-0 flex-col">
                              <span className="text-[0.95rem] font-semibold tracking-[-0.02em] text-white/92">{subitem.label}</span>
                              {subitem.description && (
                                <span className="mt-1 text-[0.82rem] leading-5 text-white/46">{subitem.description}</span>
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {props.actionType === "link" ? (
            <>
              <Link
                href="/start?login=1"
                className="hidden sm:inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white/58 transition-colors hover:text-white/85"
              >
                Entrar
              </Link>
              <Link
                href={props.actionHref}
                className="landing-header-cta group relative hidden sm:inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[12px] font-semibold tracking-[-0.01em] text-white/90 sm:px-4.5"
              >
                <span className="landing-header-cta-glow" />
                <span className="relative z-10">{props.actionLabel}</span>
                <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/start?login=1"
                className="hidden sm:inline-flex items-center rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white/58 transition-colors hover:text-white/85"
              >
                Entrar
              </Link>
              <button
                onClick={props.onAction}
                className="landing-header-cta group relative hidden sm:inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2 text-[12px] font-semibold tracking-[-0.01em] text-white/90 sm:px-4.5"
              >
                <span className="landing-header-cta-glow" />
                <span className="relative z-10">{props.actionLabel}</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setMobileOpen((open) => {
                const nextOpen = !open;
                if (!nextOpen) {
                  setOpenMobileGroup(null);
                }
                return nextOpen;
              });
            }}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 md:hidden"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div ref={mobileMenuRef} className="mx-auto mt-2 max-w-6xl px-1 md:hidden">
          <nav className="flex flex-col gap-1 rounded-[1.7rem] border border-white/[0.08] bg-black/85 p-3 shadow-2xl backdrop-blur-2xl">
            <div className="flex gap-2 p-1 pb-2">
              <Link
                href="/start?login=1"
                onClick={() => setMobileOpen(false)}
                className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.09] active:bg-white/10"
              >
                Entrar
              </Link>

              {primaryAction ? (
                <Link
                  href={primaryAction.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                >
                  {primaryAction.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <button
                  onClick={() => {
                    if (props.actionType === "button") {
                      props.onAction();
                    }
                    setOpenMobileGroup(null);
                    setMobileOpen(false);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                >
                  {props.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mb-1 h-px bg-white/[0.06]" />

            {NAV_ITEMS.map((item) => {
              if (!isDropdownItem(item)) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90 active:bg-white/10"
                  >
                    {item.label}
                  </Link>
                );
              }

              const isOpen = openMobileGroup === item.label;

              return (
                <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => toggleMobileGroup(item.label)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-white/82">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 text-white/45 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="grid gap-1 px-2 pb-2">
                      {item.items.map((subitem) => {
                        const Icon = subitem.icon;
                        return (
                          <Link
                            key={subitem.label}
                            href={subitem.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.05]"
                          >
                            {Icon && (
                              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-[#FF8C3A]">
                                <Icon size={16} />
                              </span>
                            )}
                            <span className="flex flex-col">
                              <span className="text-[0.92rem] font-semibold text-white/90">{subitem.label}</span>
                              {subitem.description && (
                                <span className="mt-0.5 text-[0.78rem] leading-5 text-white/42">{subitem.description}</span>
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
