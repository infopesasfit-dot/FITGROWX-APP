"use client";

import { useState, useRef, useEffect } from "react";

export interface Foto {
  id: string;
  foto_url: string;
  fecha: string;
  notas: string | null;
  privada: boolean;
}

interface Session {
  alumno_id: string;
  gym_id: string;
  avatar_url?: string | null;
}

const fd = "'Inter', sans-serif";

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

export function useAlumnoFotos(
  session: Session | null,
  showToast: (msg: string, ok?: boolean) => void,
  gymName: string | null,
  logoUrl: string | null,
) {
  const [fotos,              setFotos]              = useState<Foto[]>([]);
  const [fotosLoading,       setFotosLoading]       = useState(false);
  const [fotoUploading,      setFotoUploading]      = useState(false);
  const [nuevaFotoPrivada,   setNuevaFotoPrivada]   = useState(true);
  const [comparadorMode,     setComparadorMode]     = useState(false);
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState<string[]>([]);
  const [comparadorUrl,      setComparadorUrl]      = useState<string | null>(null);
  const [generandoComp,      setGenerandoComp]      = useState(false);
  const [avatarUrl,          setAvatarUrl]          = useState<string | null>(session?.avatar_url ?? null);
  const [avatarUploading,    setAvatarUploading]    = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(session?.avatar_url ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.avatar_url]);

  useEffect(() => {
    if (!session || fotos.length > 0 || fotosLoading) return;
    setFotosLoading(true);
    fetch("/api/alumno/fotos", { credentials: "include" })
      .then(r => r.ok ? r.json() : { fotos: [] })
      .then(d => setFotos(d.fotos ?? []))
      .catch(() => {})
      .finally(() => setFotosLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleFotoUpload = async (file: File) => {
    if (!session) return;
    setFotoUploading(true);
    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch {
      compressed = file;
    }
    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("privada", String(nuevaFotoPrivada));
    try {
      const res = await fetch("/api/alumno/fotos", {
        method: "POST",
        credentials: "include",
        body: formData,
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
        headers: { "Content-Type": "application/json" },
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
      const url = await generateComparadorImage(f1, f2, gymName, logoUrl);
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
        await navigator.share({ files: [file], title: "Mi progreso", text: `Mi progreso en ${gymName ?? "el gym"} 💪` });
      } else {
        const a = document.createElement("a"); a.href = comparadorUrl; a.download = "mi-progreso.png"; a.click();
      }
    } catch {}
  };

  const handleAvatarUpload = async (file: File) => {
    if (!session) return;
    setAvatarUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/alumno/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const d = await res.json();
      if (d.ok && d.avatar_url) {
        setAvatarUrl(d.avatar_url);
        showToast("Avatar actualizado!");
      } else {
        showToast(d.error ?? "Error al subir.", false);
      }
    } catch {
      showToast("Error de conexión.", false);
    }
    setAvatarUploading(false);
  };

  const handleShareFoto = async () => {
    const firstFoto = fotos[0];
    if (firstFoto && navigator.share) {
      await navigator.share({ title: "Mi progreso en FitGrowX", url: firstFoto.foto_url });
    } else if (firstFoto) {
      await navigator.clipboard.writeText(firstFoto.foto_url);
      showToast("Link copiado 📋");
    }
  };

  const handleDeleteFoto = async (fotoId: string) => {
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
  };

  return {
    fotos,
    setFotos,
    fotosLoading,
    fotoUploading,
    nuevaFotoPrivada,
    setNuevaFotoPrivada,
    comparadorMode,
    setComparadorMode,
    fotosSeleccionadas,
    setFotosSeleccionadas,
    comparadorUrl,
    setComparadorUrl,
    generandoComp,
    fotoInputRef,
    handleFotoUpload,
    handleTogglePrivada,
    toggleFotoSeleccionada,
    handleGenerarComparador,
    handleShareComparador,
    handleShareFoto,
    handleDeleteFoto,
    avatarUrl,
    avatarUploading,
    handleAvatarUpload,
  };
}
