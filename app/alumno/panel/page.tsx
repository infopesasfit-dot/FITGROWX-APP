"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Dumbbell, User, Target, Lock, Eye, Bell } from "lucide-react";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { SessionExpiredModal } from "../components/SessionExpiredModal";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PanelTabCalendario } from "../components/PanelTabCalendario";
import { PanelTabEntrenamiento } from "../components/PanelTabEntrenamiento";
import { PanelTabMetas } from "../components/PanelTabMetas";
import { PanelTabPerfil } from "../components/PanelTabPerfil";
import { QrModal } from "../components/QrModal";
import { analytics } from "@/lib/alumno-analytics";
import { useBrandConfirm } from "@/components/brand-confirm";

const fd = "'Inter', sans-serif";
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Session {
  alumno_id:       string;
  gym_id:          string;
  full_name:       string;
  status:          string;
  plan:            string | null;
  expiration:      string | null;
  dni:             string | null;
  deuda_pendiente?: number;
}

interface GymClass {
  id:           string;
  class_name:   string;
  day_of_week:  number;
  start_time:   string;
  max_capacity: number;
  event_type:   "regular" | "especial";
  notes:        string | null;
  coach_name:   string | null;
}

interface Reserva { clase_id: string; fecha: string; }

interface Ejercicio {
  nombre:        string;
  series:        number;
  repeticiones:  number;
  peso_sugerido: string;
  // WOD fields
  _meta?:        boolean;
  modalidad?:    string;
  time_cap?:     string;
  reps?:         string;
}

interface Peso { id: string; ejercicio: string; peso: number; fecha: string; notas: string | null; }
interface Medida { id: string; peso_kg: number; grasa_pct: number | null; cintura_cm: number | null; fecha: string; }

function getNext7Days() {
  const days: { date: Date; label: string; iso: string; dow: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({ date: d, label: i === 0 ? "Hoy" : DAYS[d.getDay()], iso: d.toISOString().slice(0, 10), dow: d.getDay() });
  }
  return days;
}

// Glass card — subtle, clean
const gc: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
};

async function fetchAsObjectUrl(url: string): Promise<string> {
  const r = await fetch(url);
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

async function loadImgFromUrl(url: string): Promise<HTMLImageElement> {
  const objUrl = await fetchAsObjectUrl(url);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(objUrl); res(img); };
    img.onerror = () => { URL.revokeObjectURL(objUrl); rej(); };
    img.src = objUrl;
  });
}

function drawCropped(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iA = img.width / img.height, cA = w / h;
  let sx, sy, sw, sh;
  if (iA > cA) { sh = img.height; sw = sh * cA; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / cA; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function generateComparadorImage(
  f1: { foto_url: string; fecha: string },
  f2: { foto_url: string; fecha: string },
  gymName: string | null,
  logoUrl: string | null,
): Promise<string> {
  const W = 1080, H = 1080, PH = 920, SH = H - PH;

  const [img1, img2] = await Promise.all([loadImgFromUrl(f1.foto_url), loadImgFromUrl(f2.foto_url)]);
  let logoImg: HTMLImageElement | null = null;
  if (logoUrl) { try { logoImg = await loadImgFromUrl(logoUrl); } catch {} }

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Photos (center-crop each half)
  drawCropped(ctx, img1, 0,     0, W / 2, PH);
  drawCropped(ctx, img2, W / 2, 0, W / 2, PH);

  // Orange center divider
  ctx.save();
  ctx.strokeStyle = "#F97316"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, PH); ctx.stroke();
  ctx.restore();

  // Date badge helper
  const dateBadge = (text: string, side: "left" | "right") => {
    ctx.save();
    ctx.font = `500 22px ${fd}`;
    const tw = ctx.measureText(text).width;
    const bw = tw + 16, bh = 28, by = PH - 38;
    const bx = side === "left" ? 10 : W - bw - 10;
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(text, bx + 8, by + 20);
    ctx.restore();
  };
  dateBadge(f1.fecha, "left");
  dateBadge(f2.fecha, "right");

  // Bottom strip
  ctx.fillStyle = "#0D0F14";
  ctx.fillRect(0, PH, W, SH);

  // Gym logo or name
  ctx.textAlign = "center";
  if (logoImg) {
    const lh = 52, lw = logoImg.width * (lh / logoImg.height);
    ctx.drawImage(logoImg, (W - lw) / 2, PH + 18, lw, lh);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `400 20px ${fd}`;
    ctx.fillText("via FitGrowX", W / 2, PH + SH - 18);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 34px ${fd}`;
    ctx.fillText(gymName ?? "FitGrowX", W / 2, PH + 58);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = `400 22px ${fd}`;
    ctx.fillText("via FitGrowX", W / 2, PH + SH - 18);
  }

  return canvas.toDataURL("image/png");
}

async function compressImage(file: File, maxPx = 1080, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("No se pudo leer la imagen")); };
    img.src = objectUrl;
  });
}

function AlumnoPanelInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useBrandConfirm();

  const [session,      setSession]      = useState<Session | null>(null);
  const [tab,          setTab]          = useState<"calendario" | "entrenamiento" | "metas" | "perfil">("calendario");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [clases,       setClases]       = useState<GymClass[]>([]);
  const [reservas,     setReservas]     = useState<Reserva[]>([]);
  const [countsMap,    setCountsMap]    = useState<Record<string, number>>({});
  const [rutina,       setRutina]       = useState<{ nombre: string; ejercicios: Ejercicio[] } | null>(null);
  const [pesos,        setPesos]        = useState<Peso[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [apiDown,      setApiDown]      = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [reservando,   setReservando]   = useState<string | null>(null);
  const [gymInfo,      setGymInfo]      = useState<{ gym_name: string | null; logo_url: string | null; accent_color: string | null; has_mp: boolean; plan_type: string | null; payment_info: string | null; gym_whatsapp: string | null; cancel_window_hours: number | null; is_subscription_active: boolean; trial_expires_at: string | null } | null>(null);
  const [loadingPago,  setLoadingPago]  = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [inlineKg,     setInlineKg]     = useState<Record<string, string>>({});
  const [inlineSaving, setInlineSaving] = useState<Record<string, boolean>>({});
  const [showQR,        setShowQR]        = useState(false);
  const [checkinMode,   setCheckinMode]   = useState<"qr" | "scan">("qr");
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinResult, setCheckinResult] = useState<{ ok: boolean; already?: boolean; full_name?: string; hora?: string; error?: string } | null>(null);
  const [scanActive,    setScanActive]    = useState(false);
  const [scanError,     setScanError]     = useState<string | null>(null);
  const scanVideoRef   = useRef<HTMLVideoElement>(null);
  const scanStreamRef  = useRef<MediaStream | null>(null);
  const scanAnimRef    = useRef<number | null>(null);
  const scanCooldown   = useRef(false);
  const [asistFechas,  setAsistFechas]  = useState<string[]>([]);
  const [asistCount,   setAsistCount]   = useState(0);
  const [isCompactScreen, setIsCompactScreen] = useState(false);
  const [isOffline,      setIsOffline]      = useState(false);
  const [medidas,    setMedidas]    = useState<Medida[]>([]);
  const [medLoading, setMedLoading] = useState(false);
  const [medPeso,    setMedPeso]    = useState("");
  const [medGrasa,   setMedGrasa]   = useState("");
  const [medCintura, setMedCintura] = useState("");
  const [asistTotal,  setAsistTotal]  = useState(0);
  const [ranking,     setRanking]     = useState<{ pos: number; name: string; count: number; isMe: boolean }[]>([]);
  const [myRankPos,   setMyRankPos]   = useState(0);
  const [rankLoaded,  setRankLoaded]  = useState(false);
  const [guestPassUrl,     setGuestPassUrl]     = useState<string | null>(null);
  const [guestPassLoading, setGuestPassLoading] = useState(false);
  const [guestPassCopied,  setGuestPassCopied]  = useState(false);
  const [pendingHitos, setPendingHitos] = useState<{ key: string; label: string; cardUrl: string }[]>([]);
  const [hitosChecked, setHitosChecked] = useState(false);
  const [hitoSharing,  setHitoSharing]  = useState(false);
  const [ejSeleccionado, setEjSeleccionado] = useState<string | null>(null);
  const [fotos,        setFotos]        = useState<{ id: string; foto_url: string; fecha: string; notas: string | null; privada: boolean }[]>([]);
  const [fotosLoading,   setFotosLoading]   = useState(false);
  const [fotoUploading,  setFotoUploading]  = useState(false);
  const [nuevaFotoPrivada, setNuevaFotoPrivada] = useState(true);
  const [comparadorMode,     setComparadorMode]     = useState(false);
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState<string[]>([]);
  const [comparadorUrl,      setComparadorUrl]      = useState<string | null>(null);
  const [generandoComp,      setGenerandoComp]      = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifs,       setNotifs]       = useState<{ id: string; type: string; title: string; body: string | null; link: string | null; leida: boolean; created_at: string }[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  const [deudaDismissed, setDeudaDismissed] = useState(false);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restTotal,   setRestTotal]   = useState(60);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const { workoutSession, wsSyncing, initSession, markSerie, setSerieKg, finalizeWorkout, flushWorkoutSession, enqueueKg, flushKgQueue } =
    useWorkoutSession(session?.alumno_id ?? null, session?.gym_id ?? null, null);

  // Group pesos by exercise in chronological order
  const pesosPorEjercicio = useMemo(() => {
    const map = new Map<string, { peso: number; fecha: string }[]>();
    [...pesos].reverse().forEach(p => {
      if (!map.has(p.ejercicio)) map.set(p.ejercicio, []);
      map.get(p.ejercicio)!.push({ peso: p.peso, fecha: p.fecha });
    });
    return map;
  }, [pesos]);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online",  update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  // Flush offline workout + kg queue when connection is restored
  useEffect(() => {
    const handler = () => { void flushWorkoutSession(); void flushKgQueue(); };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [flushWorkoutSession, flushKgQueue]);

  // Cleanup rest timer on unmount
  useEffect(() => () => { if (restRef.current) clearInterval(restRef.current); }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTabChange = (newTab: "calendario" | "entrenamiento" | "metas" | "perfil") => {
    setTab(newTab);
    if (session?.alumno_id) {
      analytics.trackTabView(session.alumno_id, newTab);
    }
  };

  // Load session from secure cookie
  useEffect(() => {
    fetch("/api/alumno/session", { credentials: "include" })
      .then(async r => {
        if (r.status === 401) { router.replace("/alumno/login"); return; }
        if (r.status === 403) {
          const errData = await r.json().catch(() => null);
          if (errData?.gym_blocked) {
            router.replace("/alumno/gym-pausado");
            return;
          }
        }
        if (!r.ok) { setApiDown(true); return; }
        const d = await r.json();
        const dismissKey = `fitgrowx_deuda_ok_${d.alumno_id}`;
        if (sessionStorage.getItem(dismissKey) === "1") setDeudaDismissed(true);
        setSession(d as Session);
        analytics.trackLogin(d.alumno_id, d.gym_id);
        const pagoParam = searchParams.get("pago");
        if (pagoParam === "ok") showToast("✅ ¡Pago recibido! Tu membresía fue renovada.", true);
        if (pagoParam === "error") showToast("El pago no se completó. Intentá de nuevo.", false);
        if (pagoParam === "pendiente") showToast("Pago pendiente de acreditación.", true);
        if (pagoParam) router.replace("/alumno/panel");
      })
      .catch(() => { setApiDown(true); });
  }, [router, searchParams]);

  // Determinar si mostrar footer
  const showFooter = useMemo(() => {
    if (!gymInfo) return false;
    if (gymInfo.is_subscription_active) return true;
    if (gymInfo.trial_expires_at) {
      const trialEnd = new Date(gymInfo.trial_expires_at).getTime();
      const now = Date.now();
      const diasDesdeVencimiento = Math.floor((now - trialEnd) / 86_400_000);
      return diasDesdeVencimiento <= 2;
    }
    return false;
  }, [gymInfo]);

  useEffect(() => {
    const check = () => setIsCompactScreen(window.innerWidth <= 430);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchBootstrap = useCallback(async (s: Session, includeTraining = false) => {
    const suffix = includeTraining ? "&include=training" : "";
    let r: Response;
    try {
      r = await fetch(`/api/alumno/bootstrap?${suffix}`, {
        credentials: "include",
      });
    } catch {
      setApiDown(true);
      return;
    }
    if (r.status === 401) {
      setSessionExpired(true);
      return;
    }
    if (r.status >= 500) { setApiDown(true); return; }
    setApiDown(false);
    const d = await r.json();
    if (d.clases) setClases(d.clases);
    if (d.reservas) setReservas(d.reservas);
    if (d.counts_map) setCountsMap(d.counts_map);
    if (d.gym_info) {
      setGymInfo({
        gym_name: d.gym_info.gym_name,
        logo_url: d.gym_info.logo_url,
        accent_color: d.gym_info.accent_color,
        has_mp: Boolean(d.gym_info.has_mp),
        plan_type: d.gym_info.plan_type ?? null,
        payment_info: d.gym_info.payment_info ?? null,
        gym_whatsapp: d.gym_info.gym_whatsapp ?? null,
        cancel_window_hours: d.gym_info.cancel_window_hours ?? null,
        is_subscription_active: Boolean(d.gym_info.is_subscription_active ?? false),
        trial_expires_at: d.gym_info.trial_expires_at ?? null,
      });
    }
    if (d.asistencias) {
      setAsistFechas(d.asistencias.fechas ?? []);
      setAsistCount(d.asistencias.count ?? 0);
      setAsistTotal(prev => Math.max(prev, d.asistencias.total ?? 0));
    }
    if (includeTraining) {
      setRutina(d.rutina ?? null);
      setPesos(d.pesos ?? []);
    }
  }, []);

  const handleSyncComplete = useCallback(async () => {
    if (session) {
      await fetchBootstrap(session, false);
    }
  }, [session, fetchBootstrap]);

  const { isSyncing, syncedCount } = useOfflineSync(handleSyncComplete);

  const fetchPesos = useCallback(async (s: Session) => {
    const r = await fetch(`/api/alumno/pesos`, {
      credentials: "include",
    });
    const d = await r.json();
    setPesos(d.pesos ?? []);
  }, []);

  const fetchMedidas = useCallback(async (s: Session) => {
    setMedLoading(true);
    const r = await fetch(`/api/alumno/medidas`, {
      credentials: "include",
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setMedidas(d.medidas ?? []);
    }
    setMedLoading(false);
  }, []);

  const fetchRanking = useCallback(async (s: Session) => {
    const r = await fetch(`/api/alumno/ranking`, {
      credentials: "include",
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setRanking(d.top ?? []);
      setMyRankPos(d.myPos ?? 0);
    }
    setRankLoaded(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchBootstrap(session).finally(() => setLoading(false));
  }, [session, fetchBootstrap]);

  useEffect(() => {
    if (!session) return;
    if (tab !== "entrenamiento" || rutina) return;
    void fetchBootstrap(session, true);
  }, [session, tab, rutina, fetchBootstrap]);

  // Init workout session when routine loads and user is on the entrenamiento tab
  useEffect(() => {
    if (tab !== "entrenamiento" || !rutina || !session) return;
    const isWod = !!(rutina.ejercicios[0] as { _meta?: boolean })?._meta;
    if (isWod) return; // WOD doesn't use series tracking
    initSession(rutina.nombre, rutina.ejercicios.map(e => ({ nombre: e.nombre, series: e.series })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rutina?.nombre, session?.alumno_id]);

  useEffect(() => {
    if (!session) return;
    if ((tab !== "entrenamiento" && tab !== "metas" && tab !== "perfil") || pesos.length > 0) return;
    void fetchBootstrap(session, true);
  }, [session, tab, pesos.length, fetchBootstrap]);

  useEffect(() => {
    if (!session || tab !== "metas" || medidas.length > 0 || medLoading) return;
    void fetchMedidas(session);
  }, [session, tab, medidas.length, medLoading, fetchMedidas]);

  useEffect(() => {
    if (!session || tab !== "metas" || rankLoaded) return;
    void fetchRanking(session);
  }, [session, tab, rankLoaded, fetchRanking]);

  useEffect(() => {
    if (!session || hitosChecked) return;
    setHitosChecked(true);
    fetch("/api/alumno/hitos", { credentials: "include" })
      .then(r => r.ok ? r.json() : { hitos: [] })
      .then(d => { if (d.hitos?.length) setPendingHitos(d.hitos); })
      .catch(() => {});
  }, [session, hitosChecked]);

  useEffect(() => {
    if (tab !== "metas" || !session || fotos.length > 0 || fotosLoading) return;
    setFotosLoading(true);
    fetch(`/api/alumno/fotos`, {
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : { fotos: [] })
      .then(d => setFotos(d.fotos ?? []))
      .catch(() => {})
      .finally(() => setFotosLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchNotifications = useCallback(async (s: Session) => {
    const r = await fetch("/api/alumno/notificaciones", {
      credentials: "include",
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setNotifs(d.notifications ?? []);
    }
    setNotifsLoaded(true);
  }, []);

  useEffect(() => {
    if (!session || notifsLoaded) return;
    void fetchNotifications(session);
  }, [session, notifsLoaded, fetchNotifications]);

  const handleOpenNotifs = () => {
    setNotifOpen(true);
    if (!session || notifs.every(n => n.leida)) return;
    fetch("/api/alumno/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json",
    },
      body: JSON.stringify({ all: true }),
    }).then(() => setNotifs(prev => prev.map(n => ({ ...n, leida: true })))).catch(() => {});
  };

  const startRest = (seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestTotal(seconds);
    setRestSeconds(seconds);
    restRef.current = setInterval(() => {
      setRestSeconds(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(restRef.current!);
          restRef.current = null;
          if (prev === 1) {
            try { navigator.vibrate([180, 80, 180, 80, 360]); } catch {}
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelRest = () => {
    if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    setRestSeconds(null);
  };

  const handleSaveMedida = async () => {
    if (!session || !medPeso.trim()) return;
    const body: Record<string, unknown> = {
      peso_kg: parseFloat(medPeso),
    };
    if (medGrasa.trim()) body.grasa_pct = parseFloat(medGrasa);
    if (medCintura.trim()) body.cintura_cm = parseFloat(medCintura);
    const r = await fetch("/api/alumno/medidas", {
      method: "POST",
      headers: { "Content-Type": "application/json",
    },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (r.ok && d.medida) {
      setMedidas(prev => [d.medida as Medida, ...prev]);
      setMedPeso(""); setMedGrasa(""); setMedCintura("");
      showToast("Medición guardada");
    } else {
      showToast("Error al guardar", false);
    }
  };

  const handleReservar = async (clase_id: string, fecha: string) => {
    if (!session) return;
    const key = `${clase_id}|${fecha}`;
    setReservando(key);
    try {
      const isReserved = reservas.some(r => r.clase_id === clase_id && r.fecha === fecha);
      if (isReserved) {
        const windowHours = gymInfo?.cancel_window_hours ?? null;
        if (windowHours != null && windowHours > 0) {
          const claseData = clases.find(c => c.id === clase_id);
          if (claseData?.start_time) {
            const claseDatetime = new Date(`${fecha}T${claseData.start_time}-03:00`);
            const diffHours = (claseDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
            if (diffHours >= 0 && diffHours < windowHours) {
              const ok = await confirm({
                eyebrow: "Cancelación tardía",
                title: `Estás cancelando a menos de ${windowHours}h de la clase`,
                message: "Esta cancelación se registrará como tardía y contará en tu cuota semanal.",
                confirmLabel: "Continuar",
                variant: "danger",
              });
              if (!ok) { setReservando(null); return; }
            }
          }
        }
        const res = await fetch("/api/alumno/reservar", { method: "DELETE", headers: { "Content-Type": "application/json",
    }, body: JSON.stringify({ clase_id, fecha }) });
        const d = await res.json();
        if (d.ok) {
          setReservas(prev => prev.filter(r => !(r.clase_id === clase_id && r.fecha === fecha)));
          showToast(d.late_cancel ? (d.message ?? "Cancelación tardía registrada.") : "Reserva cancelada.");
        }
        else showToast(d.error ?? "Error.", false);
      } else {
        const res = await fetch("/api/alumno/reservar", { method: "POST", headers: { "Content-Type": "application/json",
    }, body: JSON.stringify({ clase_id, fecha }) });
        const d = await res.json();
        if (d.ok) { setReservas(prev => [...prev, { clase_id, fecha }]); showToast("Reserva confirmada!"); }
        else showToast(d.error ?? "Error.", false);
      }
    } catch {
      showToast("Error de conexion. Intentá de nuevo.", false);
    } finally {
      setReservando(null);
    }
  };

  const handleInlineKgSave = async (ejercicio: string) => {
    if (!session) return;
    const val = inlineKg[ejercicio];
    if (!val || isNaN(parseFloat(val))) return;
    const kgNum = parseFloat(val);
    setInlineSaving(prev => ({ ...prev, [ejercicio]: true }));
    try {
      const res = await fetch("/api/alumno/pesos", {
        method: "POST",
        headers: { "Content-Type": "application/json",
    },
        body: JSON.stringify({ ejercicio, peso: kgNum, notas: null }),
      });
      const d = await res.json();
      if (d.ok) {
        setInlineKg(prev => ({ ...prev, [ejercicio]: "" }));
        setSerieKg(ejercicio, kgNum);
        if (d.peso) {
          setPesos(prev => [d.peso as Peso, ...prev].slice(0, 50));
        } else {
          void fetchPesos(session);
        }
        showToast("Peso registrado!");
      } else {
        showToast(d.error ?? "Error.", false);
      }
    } catch {
      if (!navigator.onLine) {
        enqueueKg({ alumno_id: session.alumno_id, gym_id: session.gym_id, ejercicio, peso: kgNum });
        setSerieKg(ejercicio, kgNum);
        setInlineKg(prev => ({ ...prev, [ejercicio]: "" }));
        showToast("Sin señal — el peso se guardará cuando recuperes conexión.", true);
      } else {
        showToast("Error de conexion.", false);
      }
    }
    setInlineSaving(prev => ({ ...prev, [ejercicio]: false }));
  };

  const handleFinalize = async () => {
    const ok = await finalizeWorkout();
    if (!navigator.onLine) {
      showToast("Guardado offline. Se sincronizará automáticamente.", true);
    } else {
      showToast(ok ? "¡Entrenamiento completado!" : "Error al guardar.", ok);
    }
  };

  const handleFotoUpload = async (file: File) => {
    if (!session) return;
    setFotoUploading(true);
    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch {
      compressed = file;
    }
    const fd = new FormData();
    fd.append("file", compressed);
    fd.append("privada", String(nuevaFotoPrivada));
    try {
      const res = await fetch("/api/alumno/fotos", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = await res.json();
      if (d.ok && d.foto) { setFotos(prev => [d.foto, ...prev]); showToast("Foto guardada!"); }
      else showToast(d.error ?? "Error al subir.", false);
    } catch {
      showToast("Error de conexión.", false);
    }
    setFotoUploading(false);
  };

  const handleTogglePrivada = async (fotoId: string, privadaActual: boolean) => {
    if (!session) return;
    const next = !privadaActual;
    setFotos(prev => prev.map(f => f.id === fotoId ? { ...f, privada: next } : f));
    try {
      const res = await fetch("/api/alumno/fotos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json",
    },
        body: JSON.stringify({ foto_id: fotoId, privada: next }),
      });
      if (!res.ok) setFotos(prev => prev.map(f => f.id === fotoId ? { ...f, privada: privadaActual } : f));
    } catch {
      setFotos(prev => prev.map(f => f.id === fotoId ? { ...f, privada: privadaActual } : f));
    }
  };

  const toggleFotoSeleccionada = (id: string) =>
    setFotosSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );

  const handleGenerarComparador = async () => {
    if (fotosSeleccionadas.length !== 2) return;
    const [f1, f2] = fotosSeleccionadas.map(id => fotos.find(f => f.id === id));
    if (!f1 || !f2) return;
    setGenerandoComp(true);
    try {
      const url = await generateComparadorImage(f1, f2, gymInfo?.gym_name ?? null, gymInfo?.logo_url ?? null);
      setComparadorUrl(url);
    } catch { showToast("Error al generar la comparación.", false); }
    setGenerandoComp(false);
  };

  const handleShareComparador = async () => {
    if (!comparadorUrl) return;
    try {
      const resp = await fetch(comparadorUrl);
      const blob = await resp.blob();
      const file = new File([blob], "mi-progreso.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi progreso", text: `Mi progreso en ${gymInfo?.gym_name ?? "el gym"} 💪` });
      } else {
        const a = document.createElement("a"); a.href = comparadorUrl; a.download = "mi-progreso.png"; a.click();
      }
    } catch {}
  };

  const doCheckin = async () => {
    if (!session) return;
    setCheckinLoading(true);
    setCheckinResult(null);
    try {
      const res = await fetch("/api/alumno/checkin-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json",
    },
        body: JSON.stringify({ gym_id: session.gym_id }),
      });
      const d = await res.json();
      setCheckinResult({ ok: d.ok, already: d.already, full_name: d.alumno?.full_name, hora: d.hora, error: d.error });
    } catch {
      setCheckinResult({ ok: false, error: "Error de conexión." });
    }
    setCheckinLoading(false);
  };

  const stopScan = useCallback(() => {
    if (scanAnimRef.current) { cancelAnimationFrame(scanAnimRef.current); scanAnimRef.current = null; }
    if (scanStreamRef.current) { scanStreamRef.current.getTracks().forEach(t => t.stop()); scanStreamRef.current = null; }
    setScanActive(false);
  }, []);

  const startScan = useCallback(async () => {
    if (!session) return;
    setScanError(null);
    setCheckinResult(null);
    scanCooldown.current = false;

    const BarcodeDetector = (window as Window & { BarcodeDetector?: new (o?: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BarcodeDetector) {
      setScanError("Tu navegador no soporta cámara QR. Usá Chrome o Safari actualizado.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      setScanError("No se pudo acceder a la cámara. Verificá los permisos.");
      return;
    }

    scanStreamRef.current = stream;
    setScanActive(true);

    // Wait for videoRef to mount
    await new Promise<void>(res => setTimeout(res, 80));
    if (!scanVideoRef.current) { stopScan(); return; }
    scanVideoRef.current.srcObject = stream;
    await scanVideoRef.current.play().catch(() => {});

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    const tick = async () => {
      if (!scanVideoRef.current || scanVideoRef.current.readyState < 2 || scanCooldown.current) {
        scanAnimRef.current = requestAnimationFrame(tick);
        return;
      }
      try {
        const codes = await detector.detect(scanVideoRef.current);
        const val = codes[0]?.rawValue;
        if (val) {
          scanCooldown.current = true;
          // Extract gymId from URL like https://fitgrowx.com/checkin/{gymId}
          const match = val.match(/\/checkin\/([a-f0-9-]{36})/i);
          const gymIdFromQR = match?.[1] ?? null;
          if (!gymIdFromQR) {
            setScanError("QR no válido. Asegurate de escanear el QR del gym.");
            scanCooldown.current = false;
            scanAnimRef.current = requestAnimationFrame(tick);
            return;
          }
          stopScan();
          setCheckinLoading(true);
          try {
            const res = await fetch("/api/alumno/checkin-publico", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ gym_id: gymIdFromQR }),
            });
            const d = await res.json();
            setCheckinResult({ ok: d.ok, already: d.already, full_name: d.alumno?.full_name, hora: d.hora, error: d.error });
          } catch {
            setCheckinResult({ ok: false, error: "Error de conexión." });
          }
          setCheckinLoading(false);
          return;
        }
      } catch { /* ignore */ }
      scanAnimRef.current = requestAnimationFrame(tick);
    };
    scanAnimRef.current = requestAnimationFrame(tick);
  }, [session, stopScan]);

  // Stop camera when modal closes or mode changes
  useEffect(() => {
    if (!showQR || checkinMode !== "scan") stopScan();
  }, [showQR, checkinMode, stopScan]);

  const logout = async () => { await fetch("/api/alumno/logout", { method: "POST", credentials: "include" }); router.replace("/alumno/login"); };

  const days7 = useMemo(() => getNext7Days(), []);
  const latestPesoByExercise = useMemo(() => {
    const map = new Map<string, Peso>();
    for (const peso of pesos) {
      if (!map.has(peso.ejercicio)) {
        map.set(peso.ejercicio, peso);
      }
    }
    return map;
  }, [pesos]);

  const handlePagar = async () => {
    if (!session || loadingPago) return;
    setLoadingPago(true);
    try {
      const res = await fetch("/api/alumno/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json",
    },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (d.init_point) {
        window.open(d.init_point, "_blank", "noopener,noreferrer");
      } else {
        showToast(d.error ?? "No se pudo generar el link de pago.", false);
      }
    } catch {
      showToast("Error de conexión. Intentá de nuevo.", false);
    } finally {
      setLoadingPago(false);
    }
  };

  const handleGuestPass = async () => {
    if (!session || guestPassLoading) return;
    if (guestPassUrl) {
      if (navigator.share) {
        navigator.share({ title: `Pase libre para ${gymInfo?.gym_name ?? "el gym"}`, url: guestPassUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(guestPassUrl);
        setGuestPassCopied(true);
        setTimeout(() => setGuestPassCopied(false), 2000);
      }
      return;
    }
    setGuestPassLoading(true);
    try {
      const r = await fetch("/api/alumno/guest-pass", {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json();
      if (r.ok && d.passUrl) {
        setGuestPassUrl(d.passUrl);
        if (navigator.share) {
          navigator.share({ title: `Pase libre para ${gymInfo?.gym_name ?? "el gym"}`, url: d.passUrl }).catch(() => {});
        } else {
          navigator.clipboard.writeText(d.passUrl);
          setGuestPassCopied(true);
          setTimeout(() => setGuestPassCopied(false), 2000);
        }
      } else {
        showToast("No se pudo generar el pase", false);
      }
    } catch {
      showToast("Error de conexión", false);
    } finally {
      setGuestPassLoading(false);
    }
  };

  if (!session) return null;

  if (apiDown) {
    return (
      <div style={{ minHeight: "100svh", background: "#0A0A0F", fontFamily: fd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ animation: "fadeUp 0.35s ease", maxWidth: 340 }}>
          <div style={{ width: 72, height: 72, borderRadius: 24, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 style={{ font: `700 1.5rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 10 }}>
            Estamos con mucha demanda
          </h2>
          <p style={{ font: `400 0.82rem/1.6 ${fd}`, color: "rgba(255,255,255,0.38)", marginBottom: 32 }}>
            No pudimos conectar al servidor. Esto es temporal — reintentá en un minuto.
          </p>
          <button
            onClick={() => { setApiDown(false); setLoading(true); fetchBootstrap(session).finally(() => setLoading(false)); }}
            style={{ padding: "13px 32px", background: "linear-gradient(135deg,#F97316,#EA580C)", border: "none", borderRadius: 14, font: `700 0.88rem/1 ${fd}`, color: "#fff", cursor: "pointer", letterSpacing: "0.02em" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const showDeudaBanner = (session.deuda_pendiente ?? 0) > 0 && !deudaDismissed && session.status === "activo";

  // Lock screen
  if (session.status !== "activo") {
    const gymName = gymInfo?.gym_name ?? "tu gimnasio";
    return (
      <div style={{ minHeight: "100svh", background: "#020202", fontFamily: fd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 65%)", filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 360, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ width: 80, height: 80, borderRadius: 28, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          {gymInfo?.plan_type === "crecimiento" && gymInfo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gymInfo.logo_url} alt={gymName} style={{ height: 28, maxWidth: 140, objectFit: "contain", margin: "0 auto 24px", display: "block", opacity: 0.4, filter: "grayscale(1)" }} />
          ) : (
            <p style={{ font: `300 0.58rem/1 ${fd}`, color: "rgba(255,255,255,0.18)", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 24 }}>{gymName}</p>
          )}
          <h1 style={{ font: `700 1.9rem/1.1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 6 }}>Acceso suspendido</h1>
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, padding: "20px 22px", marginBottom: 20, marginTop: 20 }}>
            <p style={{ font: `400 0.85rem/1.65 ${fd}`, color: "rgba(255,255,255,0.5)", marginBottom: gymInfo?.gym_whatsapp ? 14 : 0 }}>
              Tu membresia ha expirado. Comunicate con la recepcion de{" "}
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{gymName}</span>{" "}
              para regularizar tu estado.
            </p>
            {gymInfo?.gym_whatsapp && (
              <a
                href={`https://wa.me/${gymInfo.gym_whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 10, padding: "9px 14px", textDecoration: "none" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.549 4.104 1.508 5.836L0 24l6.335-1.652A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.728.977.994-3.63-.234-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
                <span style={{ font: `600 0.78rem/1 ${fd}`, color: "#25D366" }}>Escribir al gym por WhatsApp</span>
              </a>
            )}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9999, padding: "7px 14px", marginBottom: (gymInfo?.has_mp || gymInfo?.payment_info) ? 16 : 36 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ font: `500 0.65rem/1 ${fd}`, color: "#EF4444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {session.status === "vencido" ? "Membresia vencida" : "Membresia inactiva"}
            </span>
          </div>
          {gymInfo?.has_mp && (
            <button
              onClick={handlePagar}
              disabled={loadingPago}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "14px 0", background: loadingPago ? "rgba(0,158,227,0.5)" : "#009EE3", border: "none", borderRadius: 14, font: `700 0.9rem/1 ${fd}`, color: "white", cursor: loadingPago ? "not-allowed" : "pointer", marginBottom: 12, boxShadow: "0 4px 20px rgba(0,158,227,0.35)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="rgba(255,255,255,0.2)"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              {loadingPago ? "Generando link..." : "Pagar membresía con MercadoPago"}
            </button>
          )}
          {gymInfo?.payment_info && (
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ font: `600 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Datos de pago</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(gymInfo.payment_info!); setCopiedPayment(true); setTimeout(() => setCopiedPayment(false), 2000); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", gap: 4, color: copiedPayment ? "#4ADE80" : "rgba(255,255,255,0.35)" }}
                >
                  {copiedPayment
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  }
                  <span style={{ font: `500 0.65rem/1 ${fd}` }}>{copiedPayment ? "Copiado" : "Copiar"}</span>
                </button>
              </div>
              <p style={{ font: `400 0.82rem/1.6 ${fd}`, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap", margin: 0 }}>{gymInfo.payment_info}</p>
            </div>
          )}
          <button onClick={logout} style={{ display: "block", width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.25)", cursor: "pointer", letterSpacing: "0.08em" }}>
            CERRAR SESION
          </button>
        </div>
      </div>
    );
  }

  const initials = session.full_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const misReservas = days7.flatMap(day =>
    clases
      .filter(c => c.day_of_week === day.dow && reservas.some(r => r.clase_id === c.id && r.fecha === day.iso))
      .map(c => ({ ...c, day }))
  );

  const selectedDay = days7[selectedDayIdx] ?? days7[0];

  return (
    <div style={{ minHeight: "100svh", background: "#0A0A0F", fontFamily: fd, paddingBottom: 110, position: "relative", overflowX: "hidden" }}>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tap-active       { transition: opacity 0.12s; }
        .tap-active:active { opacity: 0.6; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

      {isOffline && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "#78350F", color: "#FDE68A", font: `600 0.78rem/1 ${fd}`, textAlign: "center", padding: "10px 16px", letterSpacing: "0.01em" }}>
          📵 Sin conexión · Mostrando datos guardados
        </div>
      )}

      {/* Subtle top glow only */}
      {!isCompactScreen && (
        <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(255,255,255,0.03) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
      )}

      {/* Grid */}
      {!isCompactScreen && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: isCompactScreen ? "blur(18px)" : "blur(32px)", WebkitBackdropFilter: isCompactScreen ? "blur(18px)" : "blur(32px)", background: "rgba(10,10,15,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isCompactScreen ? "12px 16px" : "13px 20px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {gymInfo?.plan_type === "crecimiento" && gymInfo?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gymInfo.logo_url} alt={gymInfo.gym_name ?? "Logo"} style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 6 }} />
          ) : (
            <span style={{ font: `800 0.95rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", fontStyle: "italic" }}>
              {(() => { const parts = (gymInfo?.gym_name ?? "FitGrowX").split(" "); return <>{parts.slice(0, -1).join(" ")}{parts.length > 1 ? " " : ""}<span style={{ color: gymInfo?.accent_color ?? "#F97316" }}>{parts.slice(-1)[0]}</span></>; })()}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Bell icon */}
            <button onClick={handleOpenNotifs} style={{ position: "relative", minHeight: 44, minWidth: 44, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Bell size={17} color="rgba(255,255,255,0.55)" />
              {notifs.some(n => !n.leida) && (
                <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: "#F97316", border: "1.5px solid #0A0A0F" }} />
              )}
            </button>
            <button onClick={logout} style={{ minHeight: 44, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0 14px", font: `500 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", cursor: "pointer", letterSpacing: "0.05em" }}>
              SALIR
            </button>
          </div>
        </div>
      </div>

      {/* Hero greeting */}
      <div style={{ position: "relative", zIndex: 1, padding: tab === "entrenamiento" && isCompactScreen ? "18px 16px 10px" : "28px 20px 16px", maxWidth: 520, margin: "0 auto" }}>
        {tab === "entrenamiento" && isCompactScreen ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ font: `500 0.7rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Entrenamiento
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <h1 style={{ font: `700 1.7rem/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em" }}>
                {session.full_name.split(" ")[0]}
              </h1>
              {session.plan && (
                <span style={{ font: `500 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.42)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "6px 10px", borderRadius: 9999, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.plan}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 8 }}>
              Bienvenido
            </p>
            <h1 style={{ font: `700 ${isCompactScreen ? "1.9rem" : "2.2rem"}/1 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.04em", marginBottom: 14 }}>
              {session.full_name.split(" ")[0]}
            </h1>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ font: `500 0.65rem/1 ${fd}`, color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.06em" }}>
                ACTIVO
              </span>
              {session.plan && (
                <span style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.04em" }}>
                  {session.plan}
                </span>
              )}
              {asistCount > 0 && (
                <span style={{ font: `600 0.65rem/1 ${fd}`, color: "#F97316", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", padding: "4px 10px", borderRadius: 9999, letterSpacing: "0.02em" }}>
                  {asistCount} asistencia{asistCount !== 1 ? "s" : ""} este mes 💪
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, padding: tab === "entrenamiento" && isCompactScreen ? "6px 12px 0" : "8px 16px 0", maxWidth: 520, margin: "0 auto" }}>

        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.5)", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>CARGANDO</p>
          </div>
        ) : (
          <>
            {/* TAB — CALENDARIO */}
            {tab === "calendario" && (
              <PanelTabCalendario
                days7={days7}
                selectedDayIdx={selectedDayIdx}
                setSelectedDayIdx={setSelectedDayIdx}
                clases={clases}
                reservas={reservas}
                countsMap={countsMap}
                misReservas={misReservas}
                reservando={reservando}
                handleReservar={handleReservar}
              />
            )}

            {/* TAB — ENTRENAMIENTO */}
            {tab === "entrenamiento" && (
              <PanelTabEntrenamiento
                rutina={rutina}
                workoutSession={workoutSession}
                wsSyncing={wsSyncing}
                isCompactScreen={isCompactScreen}
                restSeconds={restSeconds}
                restTotal={restTotal}
                inlineKg={inlineKg}
                inlineSaving={inlineSaving}
                latestPesoByExercise={latestPesoByExercise}
                markSerie={markSerie}
                handleInlineKgSave={handleInlineKgSave}
                setInlineKg={setInlineKg}
                startRest={startRest}
                handleFinalize={handleFinalize}
              />
            )}

            {/* TAB ENTRENAMIENTO MOVED TO EXTRACTED COMPONENT */}
            {/* TAB — METAS */}
            {tab === "metas" && (
              <PanelTabMetas
                asistTotal={asistTotal}
                asistCount={asistCount}
                medidas={medidas}
                pesos={pesos}
                ranking={ranking}
                myRankPos={myRankPos}
                rankLoaded={rankLoaded}
              />
            )}

            {/* TAB — PERFIL */}
            {tab === "perfil" && (
              <PanelTabPerfil
                session={session}
                fotos={fotos}
                fotosLoading={fotosLoading}
                handleShare={async () => {
                  // Share foto handling
                  const firstFoto = fotos[0];
                  if (firstFoto && navigator.share) {
                    await navigator.share({ title: "Mi progreso en FitGrowX", url: firstFoto.foto_url });
                  } else if (firstFoto) {
                    await navigator.clipboard.writeText(firstFoto.foto_url);
                    showToast("Link copiado 📋");
                  }
                }}
                handleDeleteFoto={async (fotoId: string) => {
                  // Delete foto handling
                  setFotosLoading(true);
                  try {
                    await fetch(`/api/alumno/fotos/${fotoId}`, { method: "DELETE", credentials: "include" });
                    setFotos(prev => prev.filter(f => f.id !== fotoId));
                    showToast("Foto eliminada");
                  } catch {
                    showToast("Error al eliminar foto", false);
                  } finally {
                    setFotosLoading(false);
                  }
                }}
                showComparador={() => setComparadorMode(true)}
                logout={logout}
              />
            )}
          </>
        )}
      </div>

      {/* Branding footer */}
      {showFooter && (
        <div style={{ position: "fixed", bottom: isCompactScreen ? 72 : "calc(72px + 20px)", left: 0, right: 0, zIndex: 99, textAlign: "center", padding: "16px 16px 12px", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ font: `400 0.66rem/1.5 ${fd}`, color: "rgba(255,255,255,0.18)", margin: 0 }}>
            Potenciado por <strong style={{ color: "rgba(255,255,255,0.32)" }}>FitGrowX</strong>
          </p>
          <a
            href="/reseller"
            style={{ font: `500 0.64rem/1 ${fd}`, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.03em" }}
          >
            Sumá un ingreso recomendando FitGrowX. Conocé más →
          </a>
        </div>
      )}

      {/* Hito celebration modal */}
      {pendingHitos.length > 0 && (() => {
        const hito = pendingHitos[0];
        const dismiss = () => setPendingHitos(prev => prev.slice(1));
        const handleShare = async () => {
          setHitoSharing(true);
          try {
            if (navigator.share) {
              await navigator.share({ title: `¡Logré ${hito.label}!`, url: hito.cardUrl });
            } else {
              await navigator.clipboard.writeText(hito.cardUrl);
              showToast("Link copiado 📋");
            }
          } catch {
            window.open(hito.cardUrl, "_blank");
          }
          setHitoSharing(false);
        };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <div style={{ width: "100%", maxWidth: 480, background: "#0D0D14", borderRadius: "28px 28px 0 0", padding: "28px 24px 40px", animation: "fadeUp 0.35s cubic-bezier(.22,.99,.44,1) both" }}>
              {/* Pill handle */}
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", margin: "0 auto 24px" }} />

              {/* Card preview */}
              <div style={{ borderRadius: 18, overflow: "hidden", marginBottom: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                <img src={hito.cardUrl} alt={hito.label} style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }} />
              </div>

              {/* Text */}
              <p style={{ font: `800 1.3rem/1.2 ${fd}`, color: "#FFFFFF", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
                ¡Lograste {hito.label}!
              </p>
              <p style={{ font: `400 0.8rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)", margin: "0 0 22px" }}>
                Compartí tu logro en Stories 📸
              </p>

              {/* Share button */}
              <button
                onClick={handleShare}
                disabled={hitoSharing}
                style={{ width: "100%", padding: "15px 0", background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)", border: "none", borderRadius: 16, font: `700 0.9rem/1 ${fd}`, color: "#FFFFFF", cursor: "pointer", marginBottom: 10, letterSpacing: "0.01em" }}
              >
                {hitoSharing ? "Abriendo..." : "Compartir en Stories ✨"}
              </button>
              <button
                onClick={dismiss}
                style={{ width: "100%", padding: "13px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, font: `500 0.78rem/1 ${fd}`, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
              >
                Ahora no
              </button>
            </div>
          </div>
        );
      })()}

      {/* Comparador modal */}
      {comparadorUrl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 450, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={comparadorUrl} alt="Comparación de progreso" style={{ width: "100%", maxWidth: 440, borderRadius: 14, display: "block" }} />
          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 440 }}>
            <button onClick={handleShareComparador} style={{ flex: 1, minHeight: 52, background: "linear-gradient(135deg,#F97316,#EA580C)", border: "none", borderRadius: 14, font: `700 0.9rem/1 ${fd}`, color: "#fff", cursor: "pointer" }}>
              Compartir
            </button>
            <button onClick={() => { setComparadorUrl(null); setComparadorMode(false); setFotosSeleccionadas([]); }}
              style={{ minHeight: 52, padding: "0 20px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, font: `600 0.82rem/1 ${fd}`, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
          <p style={{ font: `400 0.62rem/1.5 ${fd}`, color: "rgba(255,255,255,0.22)", textAlign: "center", maxWidth: 280 }}>
            Guardá la imagen o compartila directo a Instagram Stories
          </p>
        </div>
      )}

      {/* Rest timer bar */}
      {restSeconds !== null && (() => {
        const pct = restSeconds / restTotal;
        const r = 22;
        const circ = 2 * Math.PI * r;
        const dash = circ * pct;
        const urgent = restSeconds <= 10;
        return (
          <div style={{ position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", alignItems: "center", gap: 14, background: "rgba(15,15,20,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${urgent ? "rgba(239,68,68,0.35)" : "rgba(249,115,22,0.3)"}`, borderRadius: 9999, padding: "10px 16px 10px 12px", boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${urgent ? "rgba(239,68,68,0.1)" : "rgba(249,115,22,0.08)"}` }}>
            {/* Arc progress */}
            <svg width={52} height={52} style={{ flexShrink: 0 }}>
              <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
              <circle cx={26} cy={26} r={r} fill="none" stroke={urgent ? "#EF4444" : "#F97316"} strokeWidth={3}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 26 26)" style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.3s" }} />
              <text x={26} y={26} textAnchor="middle" dominantBaseline="central"
                style={{ font: `700 0.88rem/1 ${fd}`, fill: urgent ? "#EF4444" : "#FFFFFF" }}>
                {restSeconds}
              </text>
            </svg>
            <div>
              <p style={{ font: `600 0.82rem/1 ${fd}`, color: "#FFFFFF", marginBottom: 2 }}>Descansando…</p>
              <p style={{ font: `400 0.65rem/1 ${fd}`, color: "rgba(255,255,255,0.35)" }}>{restTotal}s · {urgent ? "¡Ya casi!" : "Preparate"}</p>
            </div>
            <button onClick={cancelRest} style={{ marginLeft: 4, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", flexShrink: 0 }}>✕</button>
          </div>
        );
      })()}

      {/* Deuda overlay */}
      {showDeudaBanner && (
        <div style={{ position: "fixed", inset: 0, zIndex: 480, background: "rgba(8,4,4,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", fontFamily: fd }}>
          <style>{`@keyframes deudaPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 60% { box-shadow: 0 0 0 18px rgba(239,68,68,0.08); } }`}</style>
          {/* Glow */}
          <div style={{ position: "fixed", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 65%)", filter: "blur(80px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            {/* Icon */}
            <div style={{ width: 76, height: 76, borderRadius: 26, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", display: "flex", alignItems: "center", justifyContent: "center", animation: "deudaPulse 2.4s ease-in-out infinite" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            {/* Gym logo or name */}
            {gymInfo?.plan_type === "crecimiento" && gymInfo?.logo_url
              ? <img src={gymInfo.logo_url} alt="" style={{ height: 24, maxWidth: 120, objectFit: "contain", opacity: 0.5, filter: "grayscale(1)" }} />
              : <p style={{ font: `300 0.6rem/1 ${fd}`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.28em", textTransform: "uppercase" }}>{gymInfo?.gym_name ?? ""}</p>
            }
            {/* Main copy */}
            <div style={{ textAlign: "center" }}>
              <h2 style={{ font: `700 1.75rem/1.1 ${fd}`, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 }}>Tenés una deuda pendiente</h2>
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "10px 20px", marginBottom: 12 }}>
                <span style={{ font: `400 0.9rem/1 ${fd}`, color: "rgba(239,68,68,0.7)" }}>$</span>
                <span style={{ font: `700 2.2rem/1 ${fd}`, color: "#EF4444", letterSpacing: "-0.04em" }}>
                  {(session.deuda_pendiente ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span style={{ font: `400 0.78rem/1 ${fd}`, color: "rgba(239,68,68,0.5)" }}>ARS</span>
              </div>
              <p style={{ font: `400 0.82rem/1.5 ${fd}`, color: "rgba(255,255,255,0.4)", maxWidth: 280, margin: "0 auto" }}>
                Regularizá tu cuota para seguir disfrutando de todos los beneficios.
              </p>
            </div>
            {/* Payment CTA */}
            {gymInfo?.has_mp && (
              <button
                onClick={handlePagar}
                disabled={loadingPago}
                style={{ width: "100%", padding: "15px 0", background: loadingPago ? "rgba(0,158,227,0.5)" : "#009EE3", border: "none", borderRadius: 14, font: `700 0.92rem/1 ${fd}`, color: "#fff", cursor: loadingPago ? "not-allowed" : "pointer", boxShadow: "0 4px 24px rgba(0,158,227,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="rgba(255,255,255,0.2)"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                {loadingPago ? "Generando link..." : "Pagar ahora con MercadoPago"}
              </button>
            )}
            {gymInfo?.gym_whatsapp && (
              <a
                href={`https://wa.me/${gymInfo.gym_whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent("Hola, quiero regularizar mi deuda de $" + (session.deuda_pendiente ?? 0).toLocaleString("es-AR") + " ARS.")}`}
                target="_blank" rel="noopener noreferrer"
                style={{ width: "100%", padding: "14px 0", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.22)", borderRadius: 14, font: `600 0.88rem/1 ${fd}`, color: "#25D366", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.116.549 4.104 1.508 5.836L0 24l6.335-1.652A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.728.977.994-3.63-.234-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
                Avisar al gym por WhatsApp
              </a>
            )}
            {/* Escape hatch — small and guilty-looking */}
            <button
              onClick={() => {
                sessionStorage.setItem(`fitgrowx_deuda_ok_${session.alumno_id}`, "1");
                setDeudaDismissed(true);
              }}
              style={{ background: "none", border: "none", font: `400 0.72rem/1 ${fd}`, color: "rgba(255,255,255,0.18)", cursor: "pointer", padding: "8px 12px", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Entrar de todos modos
            </button>
          </div>
        </div>
      )}

      {/* Notifications inbox */}
      {notifOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 460, display: "flex", flexDirection: "column" }} onClick={() => setNotifOpen(false)}>
          {/* Backdrop */}
          <div style={{ flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
          {/* Sheet */}
          <div onClick={e => e.stopPropagation()} style={{ background: "#111118", borderTop: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "0 0 env(safe-area-inset-bottom,16px)", maxHeight: "72svh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ font: `700 1rem/1 ${fd}`, color: "#fff", letterSpacing: "-0.02em" }}>Notificaciones</span>
              <button onClick={() => setNotifOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", font: `500 0.82rem/1 ${fd}`, cursor: "pointer", padding: "4px 0" }}>Cerrar</button>
            </div>
            <div style={{ overflowY: "auto", padding: "8px 0" }}>
              {notifs.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255,255,255,0.25)", font: `400 0.85rem/1.5 ${fd}` }}>
                  <Bell size={28} color="rgba(255,255,255,0.12)" style={{ marginBottom: 10 }} />
                  <p>Sin notificaciones</p>
                </div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.leida ? "transparent" : "rgba(249,115,22,0.04)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.leida ? "transparent" : "#F97316", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 0.85rem/1.3 ${fd}`, color: n.leida ? "rgba(255,255,255,0.55)" : "#fff", margin: 0, marginBottom: 3 }}>{n.title}</p>
                      {n.body && <p style={{ font: `400 0.78rem/1.4 ${fd}`, color: "rgba(255,255,255,0.38)", margin: 0, marginBottom: 4 }}>{n.body}</p>}
                      <p style={{ font: `400 0.68rem/1 ${fd}`, color: "rgba(255,255,255,0.22)", margin: 0 }}>
                        {new Date(n.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 106, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: toast.ok ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: toast.ok ? "#34D399" : "#EF4444", padding: "10px 18px", borderRadius: 10, font: `500 0.78rem/1 ${fd}`, letterSpacing: "0.02em", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap", pointerEvents: "none", border: `1px solid ${toast.ok ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {toast.msg}
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: isCompactScreen ? 0 : 20,
        left: isCompactScreen ? 0 : "50%",
        right: isCompactScreen ? 0 : "auto",
        transform: isCompactScreen ? "none" : "translateX(-50%)",
        zIndex: 100,
        width: isCompactScreen ? "100%" : "92%",
        maxWidth: 520,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        background: "rgba(18,18,24,0.92)",
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: isCompactScreen ? "0" : "28px",
        padding: isCompactScreen ? "8px 0 env(safe-area-inset-bottom)" : "6px 6px 8px",
        boxShadow: isCompactScreen ? "none" : "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        gap: 0,
      }}>
        {/* Left tabs */}
        {([
          { key: "calendario", label: "Clases", Icon: Calendar },
          { key: "entrenamiento", label: "Entrena", Icon: Dumbbell },
        ] as const).map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className="tap-active"
              style={{
                flex: 1,
                minHeight: 52,
                background: "transparent",
                border: "none",
                borderRadius: 20,
                padding: "8px 6px 5px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <Icon size={20} color={active ? "#FFFFFF" : "rgba(255,255,255,0.25)"} strokeWidth={active ? 2 : 1.5} />
              <span style={{ font: `${active ? "600" : "400"} 0.6rem/1 ${fd}`, color: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", letterSpacing: "0.03em" }}>
                {label}
              </span>
              <div style={{ width: active ? 12 : 0, height: 1.5, background: "#F97316", borderRadius: 99, transition: "width 0.2s ease", marginTop: 1 }} />
            </button>
          );
        })}

        {/* QR center */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", margin: "0 3px" }}>
          <button
            onClick={() => { setCheckinMode("qr"); setCheckinResult(null); setShowQR(true); }}
            className="tap-active"
            style={{
              position: "relative",
              bottom: isCompactScreen ? 8 : 16,
              width: isCompactScreen ? 54 : 62,
              height: isCompactScreen ? 54 : 62,
              background: "rgba(12,12,18,0.98)",
              border: "1px solid rgba(249,115,22,0.4)",
              borderRadius: 20,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              animation: "qrPulse 3s ease-in-out infinite",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M4 11V5a1 1 0 0 1 1-1h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M17 4h6a1 1 0 0 1 1 1v6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 17v6a1 1 0 0 0 1 1h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M17 24h6a1 1 0 0 0 1-1v-6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="14" cy="14" r="2" fill="#F97316" />
            </svg>
            <span style={{ font: `700 0.4rem/1 ${fd}`, color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em" }}>
              SCAN
            </span>
          </button>
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#F97316", opacity: 0.5, marginTop: isCompactScreen ? -12 : -18 }} />
        </div>

        {/* Right tabs */}
        {([
          { key: "metas", label: "Metas", Icon: Target },
          { key: "perfil", label: "Perfil", Icon: User },
        ] as const).map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className="tap-active"
              style={{
                flex: 1,
                minHeight: 52,
                background: "transparent",
                border: "none",
                borderRadius: 20,
                padding: "8px 6px 5px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <Icon size={20} color={active ? "#FFFFFF" : "rgba(255,255,255,0.25)"} strokeWidth={active ? 2 : 1.5} />
              <span style={{ font: `${active ? "600" : "400"} 0.6rem/1 ${fd}`, color: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", letterSpacing: "0.03em" }}>
                {label}
              </span>
              <div style={{ width: active ? 12 : 0, height: 1.5, background: "#F97316", borderRadius: 99, transition: "width 0.2s ease", marginTop: 1 }} />
            </button>
          );
        })}
      </div>

      {/* QR Modal */}
      <QrModal
        showQR={showQR}
        setShowQR={setShowQR}
        session={session}
        checkinMode={checkinMode}
        setCheckinMode={setCheckinMode}
        checkinLoading={checkinLoading}
        setCheckinLoading={setCheckinLoading}
        checkinResult={checkinResult}
        setCheckinResult={setCheckinResult}
        scanActive={scanActive}
        setScanActive={setScanActive}
        scanError={scanError}
        setScanError={setScanError}
        scanVideoRef={scanVideoRef}
        scanAnimRef={scanAnimRef}
        scanCooldown={scanCooldown}
        fd={fd}
        startScan={startScan}
        stopScan={stopScan}
      />

      {/* Session Expired Modal */}
      <SessionExpiredModal show={sessionExpired} />

      {/* Offline Indicator */}
      <OfflineIndicator isSyncing={isSyncing} syncedCount={syncedCount} />
    </div>
  );
}

export default function AlumnoPanelPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <AlumnoPanelInner />
      </Suspense>
    </ErrorBoundary>
  );
}
