"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutomatizacionesPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/automatizaciones/flujos"); }, [router]);
  return null;
}
