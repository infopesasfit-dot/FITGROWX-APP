"use client";

import { useEffect, useRef, useState } from "react";
import { playBeep, playCaChing } from "@/lib/sounds";

export type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  link?: string | null;
};

async function fetchNotifications(gymId: string): Promise<Notif[]> {
  const r = await fetch(`/api/notifications?gym_id=${gymId}`);
  const d = await r.json();
  return d.notifications ?? [];
}

export function useNotificationPolling(gymId: string | null) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifLoadedGymId, setNotifLoadedGymId] = useState<string | null>(null);
  const latestNotifAt = useRef<string | null>(null);

  async function ensureLoaded(gId: string) {
    if (notifLoadedGymId === gId) return;
    try {
      const list = await fetchNotifications(gId);
      setNotifs(list);
      setNotifLoadedGymId(gId);
    } catch {}
  }

  // Poll every 8 s; seeds latestNotifAt on first call without triggering sound
  useEffect(() => {
    if (!gymId) return;

    const poll = async () => {
      try {
        const incoming = await fetchNotifications(gymId);
        if (!incoming.length) return;
        const newLatest = incoming[0].created_at;
        const prev = latestNotifAt.current;
        latestNotifAt.current = newLatest;
        if (prev === null) return; // first poll — seed only, no sound
        const newOnes = incoming.filter(n => !n.read && n.created_at > prev);
        if (newOnes.length > 0) {
          setNotifs(incoming);
          const soundOn = localStorage.getItem("fitgrowx_pago_sound") !== "off";
          if (soundOn) newOnes.some(n => n.type === "pago_mp") ? playCaChing() : playBeep();
        }
      } catch {}
    };

    poll();
    const id = window.setInterval(poll, 8_000);
    return () => window.clearInterval(id);
  }, [gymId]);

  return { notifs, setNotifs, ensureLoaded, notifLoadedGymId };
}
