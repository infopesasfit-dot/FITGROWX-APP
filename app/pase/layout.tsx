"use client";

import { ReactNode, useEffect } from "react";

export default function PaseLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="referrer"]');
    if (!meta) {
      const referrerMeta = document.createElement("meta");
      referrerMeta.name = "referrer";
      referrerMeta.content = "no-referrer";
      document.head.appendChild(referrerMeta);
    }
  }, []);

  return children;
}
