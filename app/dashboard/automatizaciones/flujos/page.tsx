"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ─── PALETTE ─── */
const COL_PAL: Record<string, { color: string; label: string; emoji: string; dbKey: string; desc: string }> = {
  contactos:    { color: "#6366F1", label: "Nuevos Contactos", emoji: "👋", dbKey: "lead_auto_welcome",   desc: "Responde automáticamente a quien deja sus datos" },
  bienvenida:   { color: "#8B5CF6", label: "Bienvenida",       emoji: "🎉", dbKey: "bienvenida_activo",   desc: "Le da la bienvenida al nuevo socio y le explica la app" },
  claseGratis:  { color: "#EC4899", label: "Clase de Prueba",  emoji: "🎯", dbKey: "clase_gratis_activo", desc: "Hace seguimiento del prospecto después de su clase" },
  diadia:       { color: "#10B981", label: "Día a Día",         emoji: "🔥", dbKey: "vencimiento_activo",  desc: "Marca presentes, recuerda clases y avisa antes del vencimiento" },
  vuelvencasa:  { color: "#F59E0B", label: "Vuelven a Casa",   emoji: "💌", dbKey: "inactividad_activo",  desc: "Reengacha socios que llevan días sin aparecer" },
};

const MSG_DB_KEY: Record<string, string | null> = {
  "m-v1":    "inactividad_msg",
  "m-v3":    "inactividad_msg_3",
  "m-d1":    "diadia_presente_msg",
  "m-d2":    "diadia_post_msg",
  "m-d3":    "diadia_recordatorio_msg",
  "m-d4":    "vencimiento_msg",
  "m-d5":    "diadia_logro_msg",
  "m-b1":    "magiclink_msg",
  "m-b2":    "bienvenida_app_msg",
  "m-cg0":   "clase_gratis_msg_0",
  "m-cg2":   "clase_gratis_msg_2",
  "m-cg5":   "clase_gratis_msg_5",
  "m-cg-ns": "clase_gratis_msg_noshow",
  "m-c1":    "contactos_msg_0",
  "m-c3":    "contactos_msg_1",
  "m-c4":    "contactos_msg_3",
};

interface MsgData {
  id: string; icon: string; title: string; trigger: string;
  sent: number; read: number; msg: string;
}

const MESSAGES: Record<string, MsgData[]> = {
  contactos: [
    { id: "m-c1", icon: "💬", title: "Saludo inicial",   trigger: "Al dejar datos en landing page",    sent: 234, read: 198, msg: "¡Hola {nombre}! 👋 Vi que te interesó Fitgrowx. Somos un espacio donde entrenás y crecés rodeado de buena gente.\n\n¿Querés que te cuente cómo funciona?" },
    { id: "m-c2", icon: "📋", title: "Info de planes",   trigger: "Si responde con interés",           sent: 187, read: 164, msg: "Acá van nuestros planes, {nombre} 💪\n\n🟢 Básico — 3x semana\n🔵 Full — acceso ilimitado\n⭐ VIP — clases + nutrición\n\n¿Cuál se adapta mejor a vos?" },
    { id: "m-c3", icon: "🔁", title: "Seguimiento 24hs", trigger: "Sin respuesta a las 24 horas",      sent: 89,  read: 71,  msg: "¡Hola {nombre}! ¿Pudiste ver la info que te mandé? Cualquier pregunta, acá estoy 😊" },
    { id: "m-c4", icon: "🎯", title: "Último intento",   trigger: "3 días sin respuesta",              sent: 34,  read: 22,  msg: "Hola {nombre}, último mensajito 🙌 Si en algún momento querés arrancar, la puerta está abierta. ¡Éxitos!" },
  ],
  bienvenida: [
    { id: "m-b1", icon: "🎊", title: "¡Bienvenido!",    trigger: "Al confirmar primer pago — inmediato", sent: 187, read: 183, msg: "¡Hola {nombre}! 👋 Te registramos en *{gym}*. 🎉\n\nDesde acá podés ver tu membresía, tu QR y más 👇\n\n{link}\n\n_El acceso dura 30 días._" },
    { id: "m-b2", icon: "📱", title: "Tu app explicada", trigger: "3 minutos después",                   sent: 182, read: 171, msg: "En la app también encontrás 📱\n\n🏋️ Tu rutina personalizada\n📊 Registros de cargas\n📅 Tus clases y reservas\n✅ Historial de asistencias\n\n¡Cualquier consulta estamos acá!" },
  ],
  diadia: [
    { id: "m-d1", icon: "📍", title: "Presente automático",   trigger: "Al validar NFC en la entrada", sent: 892, read: 892, msg: "¡Entraste, {nombre}! 🙌 Tu presente queda marcado. ¡A romperla hoy!" },
    { id: "m-d2", icon: "💥", title: "Post-entrenamiento",    trigger: "30 min después de la salida",  sent: 741, read: 698, msg: "¡Qué sesión, {nombre}! 🔥 Cada entrenamiento te acerca a tu mejor versión 💪" },
    { id: "m-d3", icon: "🗓️", title: "Recordatorio de clase", trigger: "2 horas antes de la clase",   sent: 416, read: 389, msg: "Ey {nombre}! Tu clase de {clase} arranca en 2 horas ⏰ ¡No te olvides!" },
    { id: "m-d4", icon: "💳", title: "Cuota por vencer",      trigger: "3 días antes del vencimiento", sent: 143, read: 121, msg: "Hola {nombre} 👋 Tu cuota vence el {fecha}. Renovála para no perder tu acceso 😊" },
    { id: "m-d5", icon: "🏅", title: "Logro del mes",         trigger: "Al completar 12 clases",       sent: 67,  read: 64,  msg: "¡Crack total, {nombre}! 🏅 12 clases este mes. ¡Estamos orgullosos de vos!" },
  ],
  claseGratis: [
    { id: "m-cg0",  icon: "🎯", title: "Día de la clase",      trigger: "Al marcar 'Asistió' en Prospectos",       sent: 0, read: 0, msg: "¡Hola {nombre}! 💪 ¿Cómo te fue en la clase de hoy en *{gym}*? ¡Esperamos que la hayas disfrutado! Cualquier pregunta, escribinos." },
    { id: "m-cg2",  icon: "💡", title: "Seguimiento (día 2)",  trigger: "2 días después, si todavía no pagó",      sent: 0, read: 0, msg: "¡Hola {nombre}! 👋 Ya pasaron un par de días desde tu clase de prueba en *{gym}*. ¿Qué te pareció? Te contamos nuestros planes para que puedas arrancar cuando quieras 💥" },
    { id: "m-cg5",  icon: "🚀", title: "Último empuje (día 5)", trigger: "5 días después, si todavía no pagó",     sent: 0, read: 0, msg: "{nombre}, ¡tu clase de prueba en *{gym}* fue hace 5 días! 🎯 Si estás listo para arrancar de verdad, este es el momento. ¿Arrancamos?" },
    { id: "m-cg-ns",icon: "👻", title: "No asistió",           trigger: "Al día siguiente si marcaste 'No vino'",  sent: 0, read: 0, msg: "Hola {nombre} 👋 Vimos que no pudiste venir a tu clase de prueba en *{gym}*. ¿Querés reagendar para esta semana?" },
  ],
  vuelvencasa: [
    { id: "m-v1", icon: "😢", title: "Te extrañamos (10d)", trigger: "Sin visita hace 10 días",  sent: 78, read: 61, msg: "¡{nombre}, te extrañamos en *{gym}*! 🥊 Hace 10 días que no te vemos. ¿Todo bien? Cuando quieras, acá te esperamos 💪" },
    { id: "m-v3", icon: "🚪", title: "Último aviso (30d)",  trigger: "30 días sin visitas",      sent: 18, read: 11, msg: "Hola {nombre} 👋 Hace un mes que no nos vemos en *{gym}*. Si en algún momento querés retomar, la puerta está abierta. ¡Éxitos!" },
  ],
};

interface Channel { id: string; label: string; icon: string; color: string; readonly?: boolean; configHref?: string }
const CHANNELS: Channel[] = [
  { id: "maps", label: "Google Maps", icon: "📍", color: "#10B981" },
  { id: "ig",   label: "Instagram",   icon: "📸", color: "#EC4899", readonly: true, configHref: "/dashboard/ajustes?tab=general" },
  { id: "web",  label: "Página Web",  icon: "🌐", color: "#6366F1", readonly: true, configHref: "/dashboard/landing" },
  { id: "ref",  label: "Recomendado", icon: "⭐", color: "#F59E0B" },
];

/* ─── WA Icon ─── */
function IcoWA({ c = "#25D366", s = 13 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

/* ─── Toggle ─── */
function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      style={{ width: 38, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0, background: checked ? color : "rgba(255,255,255,0.12)", position: "relative", transition: "background 0.25s" }}
    >
      <div style={{ position: "absolute", width: 16, height: 16, top: 3, left: checked ? 19 : 3, borderRadius: 8, background: checked ? "#fff" : "rgba(255,255,255,0.5)", transition: "left 0.25s, background 0.25s" }}/>
    </div>
  );
}

/* ─── WA Status Badge ─── */
function WABadge({ status, phone }: { status: string; phone?: string }) {
  const ok  = status === "active";
  const qr  = status === "qr";
  const col = ok ? "#10B981" : qr ? "#F59E0B" : "#EF4444";
  const label = ok ? (phone ? `WA · ${phone.replace(/(\d{2})(\d+)(\d{2})$/, "$1···$3")}` : "WhatsApp conectado") : qr ? "Esperando QR" : "WhatsApp desconectado";
  return (
    <Link href="/dashboard/ajustes?tab=conexiones" style={{ display: "flex", alignItems: "center", gap: 6, background: `${col}14`, border: `1px solid ${col}44`, borderRadius: 8, padding: "5px 11px", textDecoration: "none" }}>
      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col, animation: ok ? "pulse 2s ease-in-out infinite" : undefined }}/>
      <IcoWA c={col} s={11}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: col }}>{label}</span>
      {!ok && <span style={{ fontSize: 10, color: `${col}99` }}>→ Conectar</span>}
    </Link>
  );
}

/* ─── Origin Card ─── */
function OriginCard({ channelActive, onChannelToggle }: { channelActive: Record<string, boolean>; onChannelToggle: (id: string) => void }) {
  const activeCount = Object.values(channelActive).filter(Boolean).length;
  return (
    <div style={{ borderRadius: 16, border: "1.5px solid rgba(255,107,0,0.25)", background: "linear-gradient(135deg,#1f1f3a,#2a2a4a)", overflow: "hidden" }}>
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#FF6B00,#e85d00)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 12px rgba(255,107,0,0.45)" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Origen de Contactos</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{activeCount} de 4 canales activos</div>
        </div>
      </div>
      <div style={{ padding: "12px 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {CHANNELS.map(ch => {
          const on = channelActive[ch.id];
          const inner = (
            <div
              key={ch.id}
              onClick={() => { if (!ch.readonly) onChannelToggle(ch.id); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 11, cursor: ch.readonly ? "default" : "pointer", background: on ? `${ch.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${on ? ch.color + "44" : "rgba(255,255,255,0.07)"}` }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ch.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: on ? ch.color : "rgba(255,255,255,0.35)", flex: 1 }}>{ch.label}</span>
              {ch.readonly && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>auto</span>}
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 8, background: on ? ch.color : "rgba(255,255,255,0.08)", color: on ? "#fff" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>{on ? "ON" : "OFF"}</span>
            </div>
          );
          return ch.readonly && ch.configHref
            ? <Link key={ch.id} href={ch.configHref} style={{ textDecoration: "none", display: "block" }}>{inner}</Link>
            : <div key={ch.id}>{inner}</div>;
        })}
      </div>
    </div>
  );
}

/* ─── Flow Card ─── */
function FlowCard({
  nodeId, active, onToggle, msgMap, msgActiveMap, onSelectMsg, todayCount,
}: {
  nodeId: string; active: boolean; todayCount?: number;
  onToggle: () => void;
  msgMap: Record<string, string>;
  msgActiveMap: Record<string, boolean>;
  onSelectMsg: (nodeId: string, msg: MsgData) => void;
}) {
  const pal = COL_PAL[nodeId];
  const msgs = MESSAGES[nodeId];
  const [expanded, setExpanded] = useState(false);
  const activeSteps = msgs.filter(m => msgActiveMap[m.id] !== false).length;

  return (
    <div style={{ borderRadius: 16, background: "#242442", border: `1.5px solid ${active ? pal.color + "44" : "rgba(255,255,255,0.07)"}`, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div style={{ height: 3, background: active ? pal.color : "rgba(255,255,255,0.06)", transition: "background 0.3s" }}/>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
      >
        <div style={{ width: 46, height: 46, borderRadius: 12, background: active ? `${pal.color}28` : "rgba(255,255,255,0.06)", border: `1px solid ${active ? pal.color + "44" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, transition: "all 0.3s" }}>
          {pal.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: active ? "#f1f5f9" : "rgba(255,255,255,0.4)" }}>{pal.label}</span>
            {active && !!todayCount && <span style={{ fontSize: 9, fontWeight: 800, color: pal.color, background: `${pal.color}20`, border: `1px solid ${pal.color}55`, borderRadius: 8, padding: "1px 7px" }}>{todayCount} hoy</span>}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3, lineHeight: 1.4 }}>{pal.desc}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: active ? pal.color : "rgba(255,255,255,0.15)", animation: active ? "pulse 2s ease-in-out infinite" : undefined }}/>
            <span style={{ fontSize: 10, color: active ? pal.color : "rgba(255,255,255,0.2)", fontWeight: 700, letterSpacing: "0.04em" }}>{active ? "ACTIVO" : "PAUSADO"}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>· {activeSteps}/{msgs.length} pasos</span>
          </div>
        </div>
        <div onClick={e => { e.stopPropagation(); onToggle(); }} style={{ padding: 8, margin: -4, flexShrink: 0 }}>
          <Toggle checked={active} onChange={onToggle} color={pal.color}/>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          {msgs.map(msg => {
            const isMsgActive = msgActiveMap[msg.id] !== false;
            return (
              <div
                key={msg.id}
                onClick={() => onSelectMsg(nodeId, msg)}
                style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${isMsgActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", opacity: isMsgActive ? (active ? 1 : 0.5) : 0.3 }}
              >
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{msg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{msg.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3, lineHeight: 1.4 }}>{msg.trigger}</div>
                </div>
                {!isMsgActive && <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "2px 6px", flexShrink: 0, alignSelf: "center" }}>OFF</span>}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={`${pal.color}88`} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Side Panel ─── */
function SidePanel({
  nodeId, msg, open, onClose, gymId, msgMap, msgActiveMap, onSave, onToggleMsgActive, isMobile,
}: {
  nodeId: string | null; msg: MsgData | null; open: boolean; onClose: () => void;
  gymId: string | null; msgMap: Record<string, string>; msgActiveMap: Record<string, boolean>;
  onSave: (id: string, text: string) => void;
  onToggleMsgActive: (msgId: string) => void;
  isMobile?: boolean;
}) {
  const pal = nodeId ? COL_PAL[nodeId] : null;
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dbCol = msg ? MSG_DB_KEY[msg.id] : null;
  const isMsgActive = msg ? (msgActiveMap[msg.id] !== false) : true;

  const SIMPLE_VARS_SET = new Set(["bienvenida_app_msg", "diadia_presente_msg", "diadia_post_msg", "diadia_logro_msg"]);
  const vars = dbCol === "magiclink_msg"
    ? ["{nombre}", "{gym}", "{link}"]
    : dbCol === "diadia_recordatorio_msg"
    ? ["{nombre}", "{gym}", "{clase}"]
    : (dbCol && (SIMPLE_VARS_SET.has(dbCol) || dbCol.startsWith("clase_gratis") || dbCol.startsWith("contactos_msg")))
    ? ["{nombre}", "{gym}"]
    : ["{nombre}", "{gym}", "{dias}", "{fecha}", "{clase}"];

  useEffect(() => {
    if (msg) { setText(msgMap[msg.id] || msg.msg || ""); setSaved(false); }
  }, [msg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function insertVar(v: string) {
    const ta = document.getElementById("sp-ta") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    setText(prev => prev.slice(0, s) + v + prev.slice(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
  }

  async function handleSave() {
    if (!msg || !gymId) return;
    setSaving(true);
    if (dbCol) {
      await supabase.from("gym_settings").update({ [dbCol]: text.trim() }).eq("gym_id", gymId);
    }
    onSave(msg.id, text);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  }

  const preview = (text || "")
    .replace(/{nombre}/g, "Valentina")
    .replace(/{dias}/g, "11")
    .replace(/{fecha}/g, "el lunes")
    .replace(/{clase}/g, "CrossFit")
    .replace(/{gym}/g, "Mi Gimnasio")
    .replace(/{link}/g, "https://fitgrowx.com/acceso/demo");

  const sec: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "13px 20px" };

  return (
    <div style={isMobile
      ? { position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "90dvh", background: "#1e1e36", borderTop: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 -16px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", transform: open ? "translateY(0)" : "translateY(110%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", zIndex: 600, borderRadius: "20px 20px 0 0" }
      : { position: "fixed", right: 0, top: 0, bottom: 0, width: 390, background: "#1e1e36", borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "-16px 0 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", zIndex: 500 }
    }>
      {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", margin: "12px auto 0", flexShrink: 0 }}/>}
      <div style={{ ...sec, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            {pal && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${pal.color}18`, border: `1px solid ${pal.color}44`, borderRadius: 20, padding: "2px 10px", marginBottom: 7 }}>
                <span style={{ fontSize: 10 }}>{pal.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: pal.color, letterSpacing: "0.04em" }}>{pal.label.toUpperCase()}</span>
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>{msg?.title || "—"}</div>
            {dbCol && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                <IcoWA c="#25D366" s={10}/>
                <span style={{ fontSize: 10, color: "#34D399", fontWeight: 600 }}>Se envía por tu WhatsApp conectado</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {pal && <div style={{ height: 3, borderRadius: 2, marginTop: 11, background: `linear-gradient(90deg,#FF6B00,${pal.color})`, opacity: 0.7 }}/>}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {msg && pal && (
          <>
            <div style={sec}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>¿Cuándo se envía?</div>
              <div style={{ background: `${pal.color}12`, border: `1px solid ${pal.color}33`, borderRadius: 10, padding: "9px 13px" }}>
                <p style={{ fontSize: 12, color: pal.color, fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{msg.trigger}</p>
              </div>
            </div>

            {/* Enable/disable this step */}
            {dbCol && (
              <div style={{ ...sec, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Enviar este mensaje</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{isMsgActive ? "Este paso está activo" : "Este paso está desactivado"}</div>
                </div>
                <Toggle checked={isMsgActive} onChange={() => onToggleMsgActive(msg.id)} color={pal.color}/>
              </div>
            )}

            <div style={{ ...sec, opacity: isMsgActive ? 1 : 0.4, pointerEvents: isMsgActive ? "auto" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                <IcoWA c="#25D366" s={13}/>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Texto del mensaje</div>
                {!dbCol && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontStyle: "italic", marginLeft: "auto" }}>Vista previa (próximamente)</span>}
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}>
                {vars.map(v => (
                  <span key={v} onClick={() => insertVar(v)} style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>{v}</span>
                ))}
              </div>
              <textarea id="sp-ta" rows={5} value={text} onChange={e => setText(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "11px 13px", fontFamily: "inherit", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, resize: "none", outline: "none", boxSizing: "border-box" }}/>
              <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 7 }}>VISTA PREVIA</div>
                <div style={{ background: "#1B3A1B", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "0 10px 10px 10px", padding: "9px 12px", display: "inline-block", maxWidth: "100%" }}>
                  <p style={{ fontSize: 12, color: "#d1fae5", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{preview}</p>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "right", marginTop: 3 }}>09:41 ✓✓</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "13px 20px" }}>
              {dbCol ? (
                <button onClick={handleSave} disabled={saving || !isMsgActive} style={{ width: "100%", background: saved ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg,${pal.color},${pal.color}cc)`, border: "none", borderRadius: 11, padding: "11px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: (saving || !isMsgActive) ? "not-allowed" : "pointer", opacity: isMsgActive ? 1 : 0.4, boxShadow: `0 4px 16px ${pal.color}44`, transition: "all 0.2s" }}>
                  {saved ? "✓ Guardado" : saving ? "Guardando…" : "Guardar mensaje"}
                </button>
              ) : (
                <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>Este mensaje se configurará en la próxima versión</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function FlujosPage() {
  const [gymId, setGymId]       = useState<string | null>(null);
  const [activeMap, setActiveMap]   = useState<Record<string, boolean>>({ contactos: false, bienvenida: true, diadia: false, vuelvencasa: false, claseGratis: false });
  const [channelActive, setChannelActive] = useState<Record<string, boolean>>({ maps: false, ig: false, web: false, ref: false });
  const [waStatus, setWaStatus] = useState<string>("unknown");
  const [waPhone, setWaPhone]   = useState<string | undefined>();
  const [selected, setSelected] = useState<{ nodeId: string; msg: MsgData } | null>(null);
  const [msgMap, setMsgMap]     = useState<Record<string, string>>(
    () => Object.fromEntries(Object.values(MESSAGES).flat().map(m => [m.id, m.msg]))
  );
  const [msgActiveMap, setMsgActiveMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(Object.values(MESSAGES).flat().map(m => [m.id, true]))
  );
  const [loading, setLoading]       = useState(true);
  const [todayStats, setTodayStats] = useState<Record<string, number>>({});
  const [isMobile, setIsMobile]     = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const id = user.id;
      setGymId(id);

      const { data: s } = await supabase
        .from("gym_settings")
        .select("lead_auto_welcome, bienvenida_activo, vencimiento_activo, inactividad_activo, clase_gratis_activo, canal_maps_activo, canal_ref_activo, instagram_url, slug, inactividad_msg, inactividad_msg_3, vencimiento_msg, magiclink_msg, bienvenida_app_msg, clase_gratis_msg_0, clase_gratis_msg_2, clase_gratis_msg_5, clase_gratis_msg_noshow, contactos_msg_0, contactos_msg_1, contactos_msg_3, diadia_presente_msg, diadia_post_msg, diadia_recordatorio_msg, diadia_logro_msg, wa_status, wa_phone")
        .eq("gym_id", id)
        .maybeSingle();

      if (s) {
        setActiveMap({
          contactos:   s.lead_auto_welcome   ?? false,
          bienvenida:  s.bienvenida_activo   ?? true,
          claseGratis: s.clase_gratis_activo ?? false,
          diadia:      s.vencimiento_activo  ?? false,
          vuelvencasa: s.inactividad_activo  ?? false,
        });
        setChannelActive({
          maps: s.canal_maps_activo ?? false,
          ig:   !!(s.instagram_url),
          web:  !!(s.slug),
          ref:  s.canal_ref_activo ?? false,
        });
        const updates: Record<string, string> = {};
        const actives: Record<string, boolean> = {};
        function loadCol(val: string | null | undefined, msgId: string) {
          if (val === "") { actives[msgId] = false; }
          else if (val)   { updates[msgId] = val; }
        }
        loadCol(s.inactividad_msg,         "m-v1");
        loadCol(s.inactividad_msg_3,       "m-v3");
        loadCol(s.vencimiento_msg,         "m-d4");
        loadCol(s.diadia_presente_msg,     "m-d1");
        loadCol(s.diadia_post_msg,         "m-d2");
        loadCol(s.diadia_recordatorio_msg, "m-d3");
        loadCol(s.diadia_logro_msg,        "m-d5");
        loadCol(s.magiclink_msg,           "m-b1");
        loadCol(s.bienvenida_app_msg,      "m-b2");
        loadCol(s.clase_gratis_msg_0,      "m-cg0");
        loadCol(s.clase_gratis_msg_2,      "m-cg2");
        loadCol(s.clase_gratis_msg_5,      "m-cg5");
        loadCol(s.clase_gratis_msg_noshow, "m-cg-ns");
        loadCol(s.contactos_msg_0,         "m-c1");
        loadCol(s.contactos_msg_1,         "m-c3");
        loadCol(s.contactos_msg_3,         "m-c4");
        if (Object.keys(updates).length) setMsgMap(prev => ({ ...prev, ...updates }));
        if (Object.keys(actives).length) setMsgActiveMap(prev => ({ ...prev, ...actives }));
        if (s.wa_status) { setWaStatus(s.wa_status); setWaPhone(s.wa_phone ?? undefined); }
      }

      const todayStr  = new Date().toISOString().slice(0, 10);
      const mañanaStr = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const [{ count: cC }, { count: cB }, { count: cCG }, { count: cD }] = await Promise.all([
        supabase.from("prospectos").select("*", { count: "exact", head: true }).eq("gym_id", id).gte("created_at", todayStr).lt("created_at", mañanaStr),
        supabase.from("alumnos").select("*",    { count: "exact", head: true }).eq("gym_id", id).gte("created_at", todayStr).lt("created_at", mañanaStr),
        supabase.from("prospectos").select("*", { count: "exact", head: true }).eq("gym_id", id).eq("clase_gratis_date", todayStr),
        supabase.from("asistencias").select("*",{ count: "exact", head: true }).eq("gym_id", id).eq("fecha", todayStr),
      ]);
      setTodayStats({ contactos: cC ?? 0, bienvenida: cB ?? 0, claseGratis: cCG ?? 0, diadia: cD ?? 0 });
      setLoading(false);
    })();
  }, []);

  async function togglePhase(nodeId: string) {
    const pal = COL_PAL[nodeId];
    const next = !activeMap[nodeId];
    setActiveMap(m => ({ ...m, [nodeId]: next }));
    if (gymId) await supabase.from("gym_settings").update({ [pal.dbKey]: next }).eq("gym_id", gymId);
  }

  async function toggleChannel(id: string) {
    const ch = CHANNELS.find(c => c.id === id);
    if (!ch || ch.readonly) return;
    const col = id === "maps" ? "canal_maps_activo" : "canal_ref_activo";
    const next = !channelActive[id];
    setChannelActive(m => ({ ...m, [id]: next }));
    if (gymId) await supabase.from("gym_settings").update({ [col]: next }).eq("gym_id", gymId);
  }

  async function handleToggleMsgActive(msgId: string) {
    const dbCol = MSG_DB_KEY[msgId];
    const next = !(msgActiveMap[msgId] ?? true);
    setMsgActiveMap(prev => ({ ...prev, [msgId]: next }));
    if (dbCol && gymId) {
      const val = next ? (msgMap[msgId] || null) : "";
      await supabase.from("gym_settings").update({ [dbCol]: val }).eq("gym_id", gymId);
    }
  }

  const totalActive = Object.values(activeMap).filter(Boolean).length;

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }`}</style>

      {/* Stats bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <WABadge status={waStatus} phone={waPhone}/>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "5px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
          {loading ? "Cargando…" : `${totalActive}/5 flujos activos`}
        </span>
      </div>

      {/* WA alerts */}
      {waStatus === "qr" && (
        <Link href="/dashboard/ajustes?tab=conexiones" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)", flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📱</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D", display: "block" }}>WhatsApp sin conectar — ningún mensaje se enviará</span>
            <span style={{ fontSize: 11, color: "rgba(252,211,77,0.65)" }}>Todos los flujos dependen de WhatsApp. Escaneá el QR en Ajustes → Conexiones para activarlos.</span>
          </div>
          <span style={{ fontSize: 11, color: "#FCD34D", fontWeight: 600, whiteSpace: "nowrap" }}>Conectar →</span>
        </Link>
      )}
      {waStatus !== "active" && waStatus !== "qr" && waStatus !== "unknown" && (
        <Link href="/dashboard/ajustes?tab=conexiones" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)", flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FCA5A5", display: "block" }}>WhatsApp desconectado — ningún mensaje se está enviando</span>
            <span style={{ fontSize: 11, color: "rgba(252,165,165,0.65)" }}>Todos los flujos están pausados. Reconectá el celular en Ajustes → Conexiones para reanudarlos.</span>
          </div>
          <span style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 600, whiteSpace: "nowrap" }}>Reconectar →</span>
        </Link>
      )}

      {/* Cards */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 32 }}>
        <OriginCard channelActive={channelActive} onChannelToggle={toggleChannel}/>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          {Object.keys(COL_PAL).map(nodeId => (
            <FlowCard
              key={nodeId}
              nodeId={nodeId}
              active={activeMap[nodeId] ?? false}
              todayCount={todayStats[nodeId]}
              onToggle={() => togglePhase(nodeId)}
              msgMap={msgMap}
              msgActiveMap={msgActiveMap}
              onSelectMsg={(nid, msg) => setSelected({ nodeId: nid, msg })}
            />
          ))}
        </div>
      </div>

      {/* Backdrop for bottom sheet on mobile */}
      {isMobile && selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 599, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}/>
      )}

      <SidePanel
        nodeId={selected?.nodeId ?? null}
        msg={selected?.msg ?? null}
        open={!!selected}
        onClose={() => setSelected(null)}
        gymId={gymId}
        msgMap={msgMap}
        msgActiveMap={msgActiveMap}
        onSave={(id, text) => setMsgMap(m => ({ ...m, [id]: text }))}
        onToggleMsgActive={handleToggleMsgActive}
        isMobile={isMobile}
      />
    </>
  );
}
