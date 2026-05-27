"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";

type ConfirmVariant = "default" | "danger" | "success";

type BrandConfirmOptions = {
  title: string;
  message?: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  hideCancel?: boolean;
};

type BrandConfirmContextValue = {
  confirm: (options: BrandConfirmOptions | string) => Promise<boolean>;
  alert: (options: BrandConfirmOptions | string) => Promise<void>;
};

const BrandConfirmContext = createContext<BrandConfirmContextValue | null>(null);

const fd = "var(--font-inter, 'Inter', sans-serif)";

const variantStyles: Record<ConfirmVariant, { color: string; soft: string; icon: typeof AlertTriangle }> = {
  default: { color: "#F97316", soft: "rgba(249,115,22,0.10)", icon: AlertTriangle },
  danger: { color: "#EF4444", soft: "rgba(239,68,68,0.10)", icon: Trash2 },
  success: { color: "#16A34A", soft: "rgba(22,163,74,0.10)", icon: CheckCircle2 },
};

export function BrandConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<BrandConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((options: BrandConfirmOptions | string) => {
    const next = typeof options === "string" ? { title: options } : options;
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setDialog(next);
    });
  }, []);

  const alert = useCallback((options: BrandConfirmOptions | string) => {
    const next = typeof options === "string" ? { title: options } : options;
    return new Promise<void>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = () => resolve();
      setDialog({ ...next, hideCancel: true, confirmLabel: next.confirmLabel ?? "Entendido" });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, dialog]);

  const value = useMemo(() => ({ confirm, alert }), [alert, confirm]);
  const variant = dialog?.variant ?? "default";
  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <BrandConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "grid",
            placeItems: "center",
            padding: 18,
            background: "rgba(5,7,10,0.58)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="brand-confirm-title"
            aria-describedby={dialog.message ? "brand-confirm-message" : undefined}
            style={{
              width: "min(100%, 462px)",
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "linear-gradient(180deg, #171A21 0%, #0D0F14 100%)",
              boxShadow: "0 32px 90px rgba(0,0,0,0.42)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "24px 24px 18px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: style.soft, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon size={21} color={style.color} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 8px", font: `800 0.72rem/1 ${fd}`, color: style.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {dialog.eyebrow ?? "Confirmar acción"}
                </p>
                <h2 id="brand-confirm-title" style={{ margin: 0, font: `850 1.32rem/1.1 ${fd}`, color: "#F8FAFC", letterSpacing: "-0.035em" }}>
                  {dialog.title}
                </h2>
                {dialog.message && (
                  <p id="brand-confirm-message" style={{ margin: "10px 0 0", font: `500 0.92rem/1.55 ${fd}`, color: "#AEB7C4" }}>
                    {dialog.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => close(false)}
                style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)", color: "#CBD5E1", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ padding: "16px 24px 24px", display: "grid", gridTemplateColumns: dialog.hideCancel ? "1fr" : "1fr 1fr", gap: 10 }}>
              {!dialog.hideCancel && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  style={{ minHeight: 48, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.06)", color: "#E2E8F0", font: `800 0.88rem/1 ${fd}`, cursor: "pointer" }}
                >
                  {dialog.cancelLabel ?? "Cancelar"}
                </button>
              )}
              <button
                type="button"
                onClick={() => close(true)}
                style={{ minHeight: 48, borderRadius: 14, border: "none", background: style.color, color: "white", font: `850 0.88rem/1 ${fd}`, cursor: "pointer", boxShadow: `0 16px 34px ${style.color}40` }}
              >
                {dialog.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </BrandConfirmContext.Provider>
  );
}

export function useBrandConfirm() {
  const context = useContext(BrandConfirmContext);
  if (!context) throw new Error("useBrandConfirm must be used inside BrandConfirmProvider");
  return context.confirm;
}

export function useBrandAlert() {
  const context = useContext(BrandConfirmContext);
  if (!context) throw new Error("useBrandAlert must be used inside BrandConfirmProvider");
  return context.alert;
}
