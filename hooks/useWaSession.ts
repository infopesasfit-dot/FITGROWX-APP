"use client";

import { useEffect, useRef, useState } from "react";

export type WaStatus = "unknown" | "connected" | "disconnected" | "needs_reauth" | "connecting";
export type QrError = "max_network" | "max_session" | "scan_failed" | null;

export function useWaSession(gymId: string | null) {
  const [waStatus,    setWaStatus]    = useState<WaStatus>("unknown");
  const [panicLoading,setPanicLoading]= useState(false);
  const [waPhone,     setWaPhone]     = useState<string | null>(null);
  const [waBattery,   setWaBattery]   = useState<number | null>(null);
  const [waSignal,    setWaSignal]    = useState<number | null>(null);
  const [waPlugged,   setWaPlugged]   = useState<boolean | null>(null);
  const [waRetries,   setWaRetries]   = useState(0);
  const [refreshing,  setRefreshing]  = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage,     setQrImage]     = useState<string | null>(null);
  const [qrLoading,   setQrLoading]   = useState(false);
  const [qrError,     setQrError]     = useState<QrError>(null);
  const [qrAttempt,   setQrAttempt]   = useState(0);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number | null>(null);

  const qrCountdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef        = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const bgPollRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────────

  const waProxy = async (action: string) => {
    const res = await fetch("/api/wa/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, gymId }),
    });
    return res;
  };

  const parseWaStatus = (raw: string): WaStatus => {
    if (raw === "active")       return "connected";
    if (raw === "needs_reauth") return "needs_reauth";
    if (raw === "qr")           return "connecting";
    return "disconnected";
  };

  // ── QR countdown ─────────────────────────────────────────────────────────────

  const stopQrCountdown = () => {
    if (qrCountdownRef.current) { clearInterval(qrCountdownRef.current); qrCountdownRef.current = null; }
    setQrSecondsLeft(null);
  };

  const startQrCountdown = () => {
    stopQrCountdown();
    setQrSecondsLeft(60);
    qrCountdownRef.current = setInterval(() => {
      setQrSecondsLeft(s => {
        if (s === null || s <= 1) { stopQrCountdown(); return null; }
        return s - 1;
      });
    }, 1000);
  };

  // ── Status polling ────────────────────────────────────────────────────────────

  const stopPolling = () => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (retryRef.current) { clearTimeout(retryRef.current);  retryRef.current = null; }
    stopQrCountdown();
  };

  const startStatusPoll = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const response = await waProxy("session-status");
        const data = await response.json();
        if (data.retries != null) setWaRetries(data.retries);
        if (data.status === "needs_reauth") {
          stopPolling();
          // Si el modal está abierto, el usuario intentó escanear y falló — mostrar error accionable.
          // Si el modal está cerrado, actualizar el banner de estado general.
          setQrModalOpen(prev => {
            if (prev) { setQrImage(null); setQrError("scan_failed"); return true; }
            setWaStatus("needs_reauth");
            return false;
          });
        }
        if (data.status === "qr" && data.qr) {
          setQrImage(prev => { if (prev !== data.qr) { startQrCountdown(); return data.qr; } return prev; });
        }
        if (data.status === "active") {
          stopPolling();
          setWaStatus("connected");
          setWaRetries(0);
          if (data.phone)     setWaPhone(data.phone);
          if (data.battery != null) setWaBattery(data.battery);
          if (data.signal  != null) setWaSignal(data.signal);
          if (data.plugged != null) setWaPlugged(data.plugged);
          setQrModalOpen(false);
        }
      } catch {}
    }, 3000);
  };

  // ── QR connect ───────────────────────────────────────────────────────────────

  const attemptQrConnect = async (attempt: number) => {
    if (!gymId) return;
    setQrAttempt(Math.min(attempt, 2));
    setQrLoading(true);
    setQrImage(null);
    try {
      if (attempt === 0) await waProxy("session-delete").catch(() => {});
      const response = await waProxy("qr-data");
      const data = await response.json();
      if (data.status === "active") {
        setWaStatus("connected");
        setQrModalOpen(false);
        setQrLoading(false);
        return;
      }
      if (data.qr) {
        setQrImage(data.qr);
        setQrLoading(false);
        startStatusPoll();
        startQrCountdown();
        return;
      }
      // Motor respondió pero no devolvió QR — sesión en estado inválido
      if (attempt < 4) retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 2000);
      else setQrError("max_session");
    } catch {
      // Motor inalcanzable — problema de red o servidor caído
      setQrLoading(false);
      if (attempt < 4) retryRef.current = setTimeout(() => attemptQrConnect(attempt + 1), 3000);
      else setQrError("max_network");
    }
  };

  const openQrModal = () => {
    stopPolling();
    setQrModalOpen(true);
    setQrImage(null);
    setQrError(null);
    setQrAttempt(0);
    setQrSecondsLeft(null);
    void attemptQrConnect(0);
  };

  const closeQrModal = () => {
    stopPolling();
    setQrModalOpen(false);
    // QR was never scanned — stop the Baileys session so it doesn't keep generating QRs
    if (qrImage) { waProxy("session-delete").catch(() => {}); setQrImage(null); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────────

  const disconnectWA = async () => {
    if (!gymId || !window.confirm("¿Desvincular WhatsApp? Se detendrán los mensajes automáticos.")) return;
    stopPolling();
    await waProxy("session-delete");
    setWaStatus("disconnected");
    setWaPhone(null); setWaBattery(null); setWaSignal(null); setWaPlugged(null);
    openQrModal();
  };

  const handlePanicReconnect = async () => {
    if (!gymId || panicLoading) return;
    setPanicLoading(true);
    try {
      await waProxy("session-reconnect");
      await new Promise(r => setTimeout(r, 6000));
      const res  = await waProxy("session-status");
      const data = await res.json();
      const resolved = parseWaStatus(data.status);
      setWaStatus(resolved);
      if (data.retries != null) setWaRetries(data.retries);
      if (resolved !== "connected") openQrModal();
    } catch { openQrModal(); }
    finally  { setPanicLoading(false); }
  };

  const handleRefreshSession = async () => {
    if (!gymId || refreshing) return;
    setRefreshing(true);
    try {
      await waProxy("session-reconnect");
      await new Promise(r => setTimeout(r, 6000));
      const res = await waProxy("session-status");
      const data = await res.json();
      const resolved = parseWaStatus(data.status);
      setWaStatus(resolved);
      if (data.retries != null) setWaRetries(data.retries);
      if (resolved !== "connected") openQrModal();
    } catch { openQrModal(); }
    finally { setRefreshing(false); }
  };

  const applyStatusData = (data: Record<string, unknown>) => {
    setWaStatus(parseWaStatus(String(data.status ?? "")));
    if (data.retries != null) setWaRetries(data.retries as number);
    if (data.phone)           setWaPhone(data.phone as string);
    if (data.battery != null) setWaBattery(data.battery as number);
    if (data.signal  != null) setWaSignal(data.signal as number);
    if (data.plugged != null) setWaPlugged(data.plugged as boolean);
  };

  // Initial status check once gymId is known
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      try {
        const response = await waProxy("session-status");
        const data = await response.json();
        applyStatusData(data);
      } catch { setWaStatus("disconnected"); }
    })();

    // Background sync every 45s so multiple open tabs/computers stay in agreement
    bgPollRef.current = setInterval(async () => {
      if (pollRef.current) return; // skip if active QR poll is already running
      try {
        const response = await waProxy("session-status");
        const data = await response.json();
        applyStatusData(data);
      } catch {}
    }, 45_000);

    return () => {
      stopPolling();
      stopQrCountdown();
      if (bgPollRef.current) { clearInterval(bgPollRef.current); bgPollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  return {
    waStatus,    setWaStatus,
    waPhone,     waBattery, waSignal, waPlugged, waRetries,
    refreshing,  panicLoading,
    qrModalOpen, qrImage, qrLoading, qrError, qrAttempt, qrSecondsLeft,
    openQrModal, closeQrModal, disconnectWA,
    handlePanicReconnect, handleRefreshSession,
  };
}
