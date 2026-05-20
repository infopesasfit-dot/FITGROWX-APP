"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useAlumnoSessionHandler() {
  const router = useRouter();

  const handleUnauthorized = useCallback(async () => {
    await fetch("/api/alumno/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.replace("/alumno/login");
  }, [router]);

  const fetchWithSessionCheck = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const res = await fetch(url, { ...options, credentials: "include" });
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Session expired");
      }
      return res;
    },
    [handleUnauthorized]
  );

  return { fetchWithSessionCheck, handleUnauthorized };
}
