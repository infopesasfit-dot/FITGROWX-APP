"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "activo" | "vencido" | "pendiente" | "pausado";

interface Alumno {
  id: string;
  dni: string | null;
  full_name: string;
  phone: string | null;
  plan_id: string | null;
  planes: { nombre: string; accent_color: string | null; precio: number; duracion_dias: number } | null;
  status: Status;
  next_expiration_date: string | null;
  frozen_since: string | null;
  pausa_hasta: string | null;
  deuda_pendiente: number;
}

const statusFromDate = (dateStr: string | null): Status => {
  if (!dateStr) return "activo";
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10)) ? "vencido" : "activo";
};

export function usePagoModal(
  gymId: string | null,
  replaceAlumno: (id: string, updater: (current: Alumno) => Alumno) => void,
  onSuccess: (msg: string) => void,
) {
  const today = new Date().toISOString().slice(0, 10);

  const [pagoModalOpen,     setPagoModalOpen]     = useState(false);
  const [pagoTarget,        setPagoTarget]        = useState<Alumno | null>(null);
  const [pagoMonto,         setPagoMonto]         = useState("");
  const [pagoFecha,         setPagoFecha]         = useState(today);
  const [pagoTipo,          setPagoTipo]          = useState<"cuota" | "otro">("cuota");
  const [pagoMetodo,        setPagoMetodo]        = useState("efectivo");
  const [pagoDetalle,       setPagoDetalle]       = useState("");
  const [pagoDiscountType,  setPagoDiscountType]  = useState<"none" | "monto" | "porcentaje">("none");
  const [pagoDiscountValue, setPagoDiscountValue] = useState("");
  const [pagoDiscountReason,setPagoDiscountReason]= useState("");
  const [pagoPromoId,       setPagoPromoId]       = useState("");
  const [pagoSaving,        setPagoSaving]        = useState(false);
  const [pagoError,         setPagoError]         = useState<string | null>(null);

  const openPagoModal = (a: Alumno) => {
    setPagoTarget(a);
    setPagoMonto(String(a.planes?.precio ?? ""));
    setPagoFecha(today);
    setPagoTipo("cuota");
    setPagoMetodo("efectivo");
    setPagoDetalle("");
    setPagoDiscountType("none");
    setPagoDiscountValue("");
    setPagoDiscountReason("");
    setPagoPromoId("");
    setPagoError(null);
    setPagoModalOpen(true);
  };

  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoTarget) return;

    const montoBase = parseFloat(pagoMonto);
    if (isNaN(montoBase) || montoBase <= 0) { setPagoError("Ingresá un monto válido."); return; }
    if (pagoTipo === "otro" && !pagoDetalle.trim()) { setPagoError("Agregá un detalle para este cobro."); return; }

    const discountValue = parseFloat(pagoDiscountValue || "0");
    if (pagoDiscountType !== "none" && (!discountValue || discountValue <= 0)) {
      setPagoError("Ingresá un descuento válido."); return;
    }
    if (pagoDiscountType !== "none" && !pagoDiscountReason.trim()) {
      setPagoError("Agregá el motivo del descuento."); return;
    }

    setPagoSaving(true);
    setPagoError(null);
    if (!gymId) { setPagoError("Sesión expirada."); setPagoSaving(false); return; }

    const paymentDate     = pagoFecha || today;
    const paymentBaseDate = new Date(`${paymentDate}T12:00:00`);
    const isCuota         = pagoTipo === "cuota";

    const discountAmount = pagoDiscountType === "monto"
      ? discountValue
      : pagoDiscountType === "porcentaje"
        ? (montoBase * discountValue) / 100
        : 0;
    const montoFinal = Math.max(0, montoBase - discountAmount);
    if (montoFinal <= 0) { setPagoError("El total final no puede quedar en $0 o menos."); setPagoSaving(false); return; }

    const duracion       = pagoTarget.planes?.duracion_dias ?? 30;
    const currentExpiry  = pagoTarget.next_expiration_date ? new Date(pagoTarget.next_expiration_date) : null;
    const base           = currentExpiry && currentExpiry > paymentBaseDate ? currentExpiry : paymentBaseDate;
    const newExpiry      = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + duracion);
    const newExpiryStr   = newExpiry.toISOString().slice(0, 10);
    const nextStatus     = statusFromDate(newExpiryStr);

    const discountLabel  = pagoDiscountType === "monto"
      ? `Descuento: -$${discountAmount.toLocaleString("es-AR")}`
      : pagoDiscountType === "porcentaje"
        ? `Descuento: ${discountValue}% (-$${discountAmount.toLocaleString("es-AR")})`
        : null;
    const paymentNote    = isCuota
      ? (pagoDetalle.trim() ? `Cuota · ${pagoDetalle.trim()}` : "Cuota")
      : (pagoDetalle.trim() || "Otro cobro");
    const paymentMeta    = [
      paymentNote,
      discountLabel,
      pagoDiscountReason.trim() ? `Motivo: ${pagoDiscountReason.trim()}` : null,
      discountLabel ? `Base: $${montoBase.toLocaleString("es-AR")} · Final: $${montoFinal.toLocaleString("es-AR")}` : null,
    ].filter(Boolean).join(" · ");

    const snapshot = pagoTarget;

    // Optimistic: close modal and update UI before DB confirms
    if (isCuota) {
      replaceAlumno(snapshot.id, (c) => ({
        ...c,
        status: nextStatus,
        next_expiration_date: newExpiryStr,
      }));
    }
    setPagoSaving(false);
    setPagoModalOpen(false);
    onSuccess(isCuota
      ? `✓ $${montoFinal.toLocaleString("es-AR")} cobrado a ${snapshot.full_name} · membresía hasta ${newExpiryStr}`
      : `✓ $${montoFinal.toLocaleString("es-AR")} cobrado a ${snapshot.full_name}`);
    setPagoTarget(null);

    // Persist in background
    const [{ error: pagoErr }, { error: alumnoErr }] = await Promise.all([
      supabase.from("pagos").insert([{
        gym_id:           gymId,
        alumno_id:        snapshot.id,
        amount:           montoFinal,
        date:             paymentDate,
        notes:            paymentMeta,
        status:           "validado",
        method:           pagoMetodo,
        ...(isCuota ? { resulting_expiry: newExpiryStr } : {}),
      }]),
      isCuota
        ? supabase.from("alumnos").update({
            status:               nextStatus,
            last_payment_date:    paymentDate,
            next_expiration_date: newExpiryStr,
          }).eq("id", snapshot.id)
        : Promise.resolve({ error: null }),
    ]);

    if (pagoErr || alumnoErr) {
      if (isCuota) replaceAlumno(snapshot.id, () => snapshot);
      onSuccess(`⚠️ Error al guardar el pago — reintentá`);
      return;
    }

    if (isCuota && gymId && snapshot.phone) {
      supabase.from("prospectos")
        .update({ clase_gratis_status: "convertido", status: "contactado" })
        .eq("gym_id", gymId)
        .eq("phone", snapshot.phone)
        .not("clase_gratis_date", "is", null)
        .neq("clase_gratis_status", "convertido")
        .then(() => {});
    }

    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym_id: gymId,
        type:   "new_payment",
        title:  `${isCuota ? "Pago de cuota" : "Cobro registrado"}: ${snapshot.full_name}`,
        body:   `$${montoFinal.toLocaleString("es-AR")}${discountLabel ? ` · ${discountLabel}` : ""} · ${paymentNote}`,
      }),
    }).catch(() => {});

    if (isCuota && snapshot.phone) {
      let e164 = snapshot.phone.replace(/\D/g, "");
      if (!e164.startsWith("54"))  e164 = "54"  + e164;
      if (!e164.startsWith("549")) e164 = "549" + e164.slice(2);
      const msgBody = `¡Hola ${snapshot.full_name}! 💪 Confirmamos tu pago de $${montoFinal.toLocaleString("es-AR")}. Tu membresía está al día.`;
      fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_id: gymId, phone: e164, message: msgBody }),
      }).catch(() => {});
    }

    if (isCuota) {
      fetch("/api/alumno/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_id: snapshot.id, type: "renewal" }),
      }).catch(() => {});
    }

    if (gymId) {
      const planNombre = snapshot.planes?.nombre;
      const desc = isCuota
        ? `Pago $${montoFinal.toLocaleString("es-AR")} · ${planNombre ?? "cuota"}${discountLabel ? ` · ${discountLabel}` : ""} · vence ${newExpiryStr ?? "—"}`
        : `Cobro $${montoFinal.toLocaleString("es-AR")} · ${paymentNote}`;
      supabase.from("alumno_activity_log").insert({
        alumno_id: snapshot.id, gym_id: gymId, type: "pago",
        description: desc, actor: "admin",
        metadata: { method: pagoMetodo, amount: montoFinal },
      }).then(() => {});
    }
  };

  return {
    pagoModalOpen, setPagoModalOpen,
    pagoTarget,
    pagoMonto,         setPagoMonto,
    pagoFecha,         setPagoFecha,
    pagoTipo,          setPagoTipo,
    pagoMetodo,        setPagoMetodo,
    pagoDetalle,       setPagoDetalle,
    pagoDiscountType,  setPagoDiscountType,
    pagoDiscountValue, setPagoDiscountValue,
    pagoDiscountReason,setPagoDiscountReason,
    pagoPromoId,       setPagoPromoId,
    pagoSaving,
    pagoError,
    openPagoModal,
    handlePagoSubmit,
  };
}
