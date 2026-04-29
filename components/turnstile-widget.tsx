"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId?: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  onTokenChange: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  resetKey?: number;
};

export function TurnstileWidget({
  onTokenChange,
  theme = "auto",
  resetKey = 0,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile) {
      return;
    }

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    onTokenChange(null);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(null),
      "error-callback": () => onTokenChange(null),
    });
  }, [onTokenChange, siteKey, theme]);

  useEffect(() => {
    if (window.turnstile) {
      renderWidget();
    }
  }, [renderWidget, resetKey]);

  useEffect(() => {
    if (!siteKey && process.env.NODE_ENV !== "production") {
      onTokenChange("dev-turnstile-bypass");
    }
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (!siteKey) {
    return (
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.18)",
          background: "rgba(239,68,68,0.06)",
          color: "#DC2626",
          fontSize: "0.78rem",
          lineHeight: 1.5,
        }}
      >
        {process.env.NODE_ENV === "production"
          ? "Falta configurar NEXT_PUBLIC_TURNSTILE_SITE_KEY."
          : "Turnstile no está configurado en este entorno. En desarrollo se habilita un bypass local para poder probar el flujo."}
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} />
    </>
  );
}
