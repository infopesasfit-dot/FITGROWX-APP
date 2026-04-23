"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DevLogin() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    localStorage.setItem("fitgrowx_alumno", JSON.stringify({
      alumno_id:  "cf0da0ea-12e6-4559-8008-ebf7fc054f5f",
      gym_id:     "42ddb4b7-cc18-4d4f-94c9-b6efea21726e",
      full_name:  "julian alvarez",
      status:     "activo",
      plan:       null,
      expiration: null,
    }));
    router.replace("/alumno/panel");
  }, [router]);

  if (process.env.NODE_ENV === "production") return <p>Not found</p>;

  return <p style={{ fontFamily: "sans-serif", padding: 20 }}>Entrando como Julian (dev)…</p>;
}
