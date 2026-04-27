"use client";

import { useState } from "react";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem("cookie_consent");
  });

  function accept() {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-xl">
      <div className="rounded-2xl border border-white/10 bg-[#0e0e0e]/90 backdrop-blur-md px-5 py-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-white/70 flex-1 leading-relaxed">
          Usamos cookies para mejorar tu experiencia.{" "}
          <Link href="/privacidad" className="underline underline-offset-2 text-white/90 hover:text-white">
            Política de privacidad
          </Link>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-xl bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-white/90 transition-colors"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
