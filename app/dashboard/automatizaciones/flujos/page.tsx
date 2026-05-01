"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

/* ─── PALETTE ─── */
const COL_PAL: Record<string, { color: string; label: string; emoji: string; dbKey: string }> = {
  contactos:   { color: "#6366F1", label: "Nuevos Contactos", emoji: "👋", dbKey: "lead_auto_welcome"  },
  bienvenida:  { color: "#8B5CF6", label: "Bienvenida",       emoji: "🎉", dbKey: "bienvenida_activo"  },
  diadia:      { color: "#10B981", label: "Día a Día",         emoji: "🔥", dbKey: "vencimiento_activo" },
  vuelvencasa: { color: "#F59E0B", label: "Vuelven a Casa",    emoji: "💌", dbKey: "inactividad_activo" },
};

/* dbKey → which gym_settings column stores the message body for this card (null = not yet wired) */
const MSG_DB_KEY: Record<string, string | null> = {
  "m-v1": "inactividad_msg",
  "m-d4": "vencimiento_msg",
  "m-b1": "magiclink_msg",
};

const NODE_W = 230;

const INIT_POS = {
  origin:      { x: 420, y: 40  },
  contactos:   { x: 60,  y: 310 },
  bienvenida:  { x: 340, y: 310 },
  diadia:      { x: 620, y: 310 },
  vuelvencasa: { x: 900, y: 310 },
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
    { id: "m-b1", icon: "🎊", title: "¡Bienvenido al equipo!", trigger: "Al confirmar primer pago",     sent: 187, read: 183, msg: "¡Bienvenido/a a Fitgrowx, {nombre}! 🎉 Ya sos parte de nuestra familia.\n\nTu acceso está activo. ¡Te esperamos!" },
    { id: "m-b2", icon: "🔑", title: "Acceso NFC activo",      trigger: "10 minutos después del alta",  sent: 182, read: 178, msg: "Tu chip NFC ya está listo, {nombre} 📱 Apoyá el celular en el lector y listo — sin tarjetas." },
    { id: "m-b3", icon: "📱", title: "Tutorial de la app",     trigger: "1 día después del alta",       sent: 175, read: 159, msg: "¿Ya descargaste la app de Fitgrowx, {nombre}? Reservá clases y llevá tu historial. [link]" },
    { id: "m-b4", icon: "✅", title: "Primera clase agendada", trigger: "Al reservar su primera clase",  sent: 168, read: 165, msg: "¡Ya tenés tu primera clase, {nombre}! 💪 Llegá 5 minutos antes. ¡Vas a romperla!" },
  ],
  diadia: [
    { id: "m-d1", icon: "📍", title: "Presente automático",    trigger: "Al validar NFC en la entrada", sent: 892, read: 892, msg: "¡Entraste, {nombre}! 🙌 Tu presente queda marcado. ¡A romperla hoy!" },
    { id: "m-d2", icon: "💥", title: "Post-entrenamiento",     trigger: "30 min después de la salida",  sent: 741, read: 698, msg: "¡Qué sesión, {nombre}! 🔥 Cada entrenamiento te acerca a tu mejor versión 💪" },
    { id: "m-d3", icon: "🗓️", title: "Recordatorio de clase",  trigger: "2 horas antes de la clase",   sent: 416, read: 389, msg: "Ey {nombre}! Tu clase de {clase} arranca en 2 horas ⏰ ¡No te olvides!" },
    { id: "m-d4", icon: "💳", title: "Cuota por vencer",       trigger: "3 días antes del vencimiento", sent: 143, read: 121, msg: "Hola {nombre} 👋 Tu cuota vence el {fecha}. Renovála para no perder tu acceso 😊" },
    { id: "m-d5", icon: "🏅", title: "Logro del mes",          trigger: "Al completar 12 clases",       sent: 67,  read: 64,  msg: "¡Crack total, {nombre}! 🏅 12 clases este mes. ¡Estamos orgullosos de vos!" },
  ],
  vuelvencasa: [
    { id: "m-v1", icon: "😢", title: "Te extrañamos (10d)",   trigger: "Sin visita hace 10 días",  sent: 78, read: 61, msg: "¡{nombre}, te extrañamos en Fitgrowx! 🥊 Hace 10 días que no te vemos. ¿Todo bien?" },
    { id: "m-v2", icon: "🎁", title: "Oferta especial (15d)", trigger: "Sin visita hace 15 días",  sent: 42, read: 29, msg: "Hola {nombre} 👋 Tenemos un regalo: una clase grupal gratis esta semana 🎁" },
    { id: "m-v3", icon: "🚪", title: "Último aviso (30d)",    trigger: "30 días de inactividad",   sent: 18, read: 11, msg: "{nombre}, llevás un mes sin visitarnos 😔 ¿Querés que hablemos antes de que tu membresía quede inactiva?" },
  ],
};

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
      style={{ width: 34, height: 19, borderRadius: 10, cursor: "pointer", flexShrink: 0, background: checked ? color : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.25s" }}
    >
      <div style={{ position: "absolute", width: 13, height: 13, top: 3, left: checked ? 18 : 3, borderRadius: 7, background: checked ? "#fff" : "rgba(255,255,255,0.5)", transition: "left 0.25s, background 0.25s" }}/>
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
    <Link href="/dashboard/ajustes?tab=conexiones" style={{ display: "flex", alignItems: "center", gap: 6, background: `${col}14`, border: `1px solid ${col}44`, borderRadius: 8, padding: "5px 11px", textDecoration: "none", transition: "all 0.15s" }}>
      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col, animation: ok ? "pulse 2s ease-in-out infinite" : undefined }}/>
      <IcoWA c={col} s={11}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: col }}>{label}</span>
      {!ok && <span style={{ fontSize: 10, color: `${col}99` }}>→ Conectar</span>}
    </Link>
  );
}

/* ─── Origin Node ─── */
interface Channel { id: string; label: string; icon: string; color: string; readonly?: boolean; configHref?: string }

const CHANNELS: Channel[] = [
  { id: "maps", label: "Google Maps", icon: "📍", color: "#10B981" },
  { id: "ig",   label: "Instagram",   icon: "📸", color: "#EC4899", readonly: true, configHref: "/dashboard/ajustes?tab=general" },
  { id: "web",  label: "Página Web",  icon: "🌐", color: "#6366F1", readonly: true, configHref: "/dashboard/landing" },
  { id: "ref",  label: "Recomendado", icon: "⭐", color: "#F59E0B" },
];

function OriginNode({
  pos, channelActive, onChannelToggle, onMouseDown,
}: {
  pos: { x: number; y: number };
  channelActive: Record<string, boolean>;
  onChannelToggle: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
}) {
  const activeCount = Object.values(channelActive).filter(Boolean).length;
  return (
    <div
      onMouseDown={e => onMouseDown(e, "origin")}
      style={{ position: "absolute", left: pos.x, top: pos.y, width: 280, cursor: "move", borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.14)", background: "linear-gradient(135deg,#1f1f3a,#2a2a4a)", boxShadow: "0 0 0 1px rgba(255,107,0,0.2), 0 8px 40px rgba(255,107,0,0.15)" }}
    >
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#FF6B00,#e85d00)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(255,107,0,0.5)", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Origen de Contactos</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{activeCount} de 4 canales activos</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {CHANNELS.map(ch => {
          const on = channelActive[ch.id];
          const isReadonly = ch.readonly;
          const inner = (
            <div
              key={ch.id}
              onClick={e => { e.stopPropagation(); if (!isReadonly) onChannelToggle(ch.id); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, cursor: isReadonly ? "default" : "pointer", background: on ? `${ch.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${on ? ch.color + "44" : "rgba(255,255,255,0.07)"}`, transition: "all 0.2s" }}
            >
              <span style={{ fontSize: 14 }}>{ch.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: on ? ch.color : "rgba(255,255,255,0.35)", flex: 1 }}>{ch.label}</span>
              {isReadonly && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>auto</span>
              )}
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: on ? ch.color : "rgba(255,255,255,0.15)", animation: on ? "pulse 2s ease-in-out infinite" : undefined }}/>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 8, background: on ? ch.color : "rgba(255,255,255,0.08)", color: on ? "#fff" : "rgba(255,255,255,0.3)" }}>{on ? "ON" : "OFF"}</span>
            </div>
          );
          return isReadonly && ch.configHref
            ? <Link key={ch.id} href={ch.configHref} style={{ textDecoration: "none", display: "block" }} onClick={e => e.stopPropagation()}>{inner}</Link>
            : <div key={ch.id}>{inner}</div>;
        })}
      </div>
      <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: "#FF6B00", border: "2px solid #1a1a2e", boxShadow: "0 0 8px rgba(255,107,0,0.6)" }}/>
    </div>
  );
}

/* ─── Flow Node ─── */
function FlowNode({
  nodeId, pos, active, selected, dragging, waConnected,
  onToggle, onCardClick, onMouseDown, selectedMsgId, msgMap,
}: {
  nodeId: string; pos: { x: number; y: number }; active: boolean; selected: boolean; dragging: boolean; waConnected: boolean;
  onToggle: () => void; onCardClick: (nid: string, msg: MsgData) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  selectedMsgId?: string; msgMap: Record<string, string>;
}) {
  const pal = COL_PAL[nodeId];
  const msgs = MESSAGES[nodeId];

  return (
    <div
      onMouseDown={e => onMouseDown(e, nodeId)}
      style={{ position: "absolute", left: pos.x, top: pos.y, width: NODE_W, cursor: "move", borderRadius: 16, border: `1.5px solid ${selected ? pal.color + "88" : (active ? pal.color + "33" : "rgba(255,255,255,0.07)")}`, background: "#242442", boxShadow: active ? `0 0 0 1px ${pal.color}22, 0 8px 36px rgba(0,0,0,0.5)${selected ? `, 0 0 20px ${pal.color}44` : ""}` : "0 4px 20px rgba(0,0,0,0.5)", opacity: dragging ? 0.92 : 1, transition: "box-shadow 0.2s, border-color 0.2s" }}
    >
      <div style={{ height: 3, background: active ? pal.color : "rgba(255,255,255,0.06)", borderRadius: "14px 14px 0 0", transition: "background 0.3s" }}/>
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? `${pal.color}28` : "rgba(255,255,255,0.06)", border: `1px solid ${active ? pal.color + "44" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "all 0.3s" }}>
            {pal.emoji}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: active ? "#f1f5f9" : "rgba(255,255,255,0.3)", lineHeight: 1.2 }}>{pal.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: active ? pal.color : "rgba(255,255,255,0.15)", animation: active ? "pulse 2s ease-in-out infinite" : undefined }}/>
              <span style={{ fontSize: 9, color: active ? pal.color : "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.04em" }}>{active ? "ACTIVO" : "PAUSADO"}</span>
            </div>
          </div>
        </div>
        <Toggle checked={active} onChange={onToggle} color={pal.color}/>
      </div>

      {/* WA not connected warning */}
      {active && !waConnected && (
        <div style={{ margin: "6px 10px 0", padding: "5px 9px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10 }}>⚠️</span>
          <span style={{ fontSize: 10, color: "#FCA5A5", fontWeight: 500 }}>WA desconectado — mensajes no se enviarán</span>
        </div>
      )}

      <div style={{ padding: "8px 10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
        {msgs.map(msg => {
          const isSel = selectedMsgId === msg.id;
          const pct = Math.round(msg.read / msg.sent * 100);
          const hasDbColumn = !!MSG_DB_KEY[msg.id];
          return (
            <div key={msg.id}
              onClick={e => { e.stopPropagation(); active && onCardClick(nodeId, msg); }}
              style={{ borderRadius: 10, padding: "8px 10px", cursor: active ? "pointer" : "default", background: isSel ? `${pal.color}22` : "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? pal.color + "66" : "rgba(255,255,255,0.07)"}`, transition: "all 0.18s", opacity: active ? 1 : 0.4 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{msg.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", flex: 1, lineHeight: 1.3 }}>{msg.title}</span>
                {hasDbColumn && <span style={{ fontSize: 8, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, padding: "1px 4px" }}>ACTIVO</span>}
                <IcoWA c={active ? "#25D366" : "rgba(255,255,255,0.2)"} s={11}/>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pal.color, borderRadius: 1 }}/>
                </div>
                <span style={{ fontSize: 9, color: pal.color, fontWeight: 700, whiteSpace: "nowrap" }}>{msg.sent >= 1000 ? `${(msg.sent / 1000).toFixed(1)}k` : msg.sent} · {pct}%</span>
              </div>
            </div>
          );
        })}
        {active && (
          <div style={{ borderRadius: 10, padding: "7px 10px", border: "1px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 600 }}
            onMouseOver={e => { e.currentTarget.style.background = `${pal.color}10`; e.currentTarget.style.color = pal.color; e.currentTarget.style.borderColor = `${pal.color}44`; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar mensaje
          </div>
        )}
      </div>
      <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: active ? pal.color : "#2a2a4a", border: "2px solid #1a1a2e", boxShadow: active ? `0 0 8px ${pal.color}88` : "none", transition: "all 0.3s" }}/>
    </div>
  );
}

/* ─── Edges ─── */
function Edges({ positions, activeMap }: { positions: typeof INIT_POS; activeMap: Record<string, boolean> }) {
  const nodeIds = Object.keys(COL_PAL);
  const o = positions.origin;
  const ox = o.x + 140, oy = o.y + 160;
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
      <defs>
        {nodeIds.map(id => (
          <linearGradient key={id} id={`eg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.8"/>
            <stop offset="100%" stopColor={COL_PAL[id].color} stopOpacity="0.8"/>
          </linearGradient>
        ))}
      </defs>
      {nodeIds.map(id => {
        const pos = positions[id as keyof typeof positions];
        if (!pos) return null;
        const active = activeMap[id];
        const pal = COL_PAL[id];
        const tx = pos.x + NODE_W / 2, ty = pos.y;
        const cp1y = oy + (ty - oy) * 0.45, cp2y = oy + (ty - oy) * 0.72;
        const d = `M ${ox},${oy} C ${ox},${cp1y} ${tx},${cp2y} ${tx},${ty}`;
        return (
          <g key={id}>
            {active && <path d={d} fill="none" stroke={pal.color} strokeWidth="8" opacity="0.06"/>}
            <path d={d} fill="none" stroke={active ? `url(#eg-${id})` : "rgba(255,255,255,0.08)"} strokeWidth="2" opacity={active ? 0.25 : 0.6}/>
            <path d={d} fill="none" stroke={active ? `url(#eg-${id})` : "rgba(255,255,255,0.06)"} strokeWidth={active ? 2.5 : 1.5} strokeDasharray={active ? "10 8" : "3 10"} style={{ animation: active ? "flow 1.8s linear infinite" : undefined, filter: active ? `drop-shadow(0 0 4px ${pal.color}88)` : "none" }}/>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Side Panel ─── */
function SidePanel({
  nodeId, msg, open, onClose, gymId, msgMap, onSave,
}: {
  nodeId: string | null; msg: MsgData | null; open: boolean; onClose: () => void;
  gymId: string | null; msgMap: Record<string, string>; onSave: (id: string, text: string) => void;
}) {
  const pal = nodeId ? COL_PAL[nodeId] : null;
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tone, setTone] = useState("amigable");
  const vars = ["{nombre}", "{dias}", "{fecha}", "{clase}"];
  const dbCol = msg ? MSG_DB_KEY[msg.id] : null;

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

  const preview = (text || "").replace(/{nombre}/g, "Valentina").replace(/{dias}/g, "11").replace(/{fecha}/g, "el lunes").replace(/{clase}/g, "CrossFit");
  const sec: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "13px 20px" };

  return (
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 370, background: "#1e1e36", borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "-16px 0 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", zIndex: 300 }}>
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

            <div style={{ ...sec, display: "flex", gap: 10 }}>
              {[{ l: "Enviados", v: msg.sent, c: "#6366F1" }, { l: "Leídos", v: msg.read, c: "#10B981" }, { l: "Tasa", v: `${Math.round(msg.read / msg.sent * 100)}%`, c: pal.color }].map(s => (
                <div key={s.l} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{typeof s.v === "number" && s.v >= 1000 ? `${(s.v / 1000).toFixed(1)}k` : s.v}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={sec}>
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

            {/* Tone selector — cosmetic, no API call */}
            <div style={sec}>
              <div style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.15))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 13, padding: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg,#7C3AED,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <div><div style={{ fontSize: 12, fontWeight: 700, color: "#c4b5fd" }}>Tono del mensaje</div><div style={{ fontSize: 10, color: "rgba(167,139,250,0.7)" }}>Ajustá el estilo</div></div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {["amigable", "motivador", "urgente", "serio"].map(t => (
                    <button key={t} onClick={() => setTone(t)} style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${tone === t ? "#7C3AED" : "rgba(139,92,246,0.3)"}`, background: tone === t ? "#7C3AED" : "rgba(124,58,237,0.15)", color: tone === t ? "#fff" : "#a78bfa", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "13px 20px" }}>
              {dbCol ? (
                <button onClick={handleSave} disabled={saving} style={{ width: "100%", background: saved ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg,${pal.color},${pal.color}cc)`, border: "none", borderRadius: 11, padding: "11px 0", fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "wait" : "pointer", boxShadow: `0 4px 16px ${pal.color}44`, transition: "all 0.2s" }}>
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
  const [gymId, setGymId] = useState<string | null>(null);
  const [positions, setPositions]   = useState(INIT_POS);
  const [activeMap, setActiveMap]   = useState<Record<string, boolean>>({ contactos: true, bienvenida: true, diadia: false, vuelvencasa: false });
  const [channelActive, setChannelActive] = useState<Record<string, boolean>>({ maps: false, ig: false, web: false, ref: false });
  const [waStatus, setWaStatus]     = useState<string>("unknown");
  const [waPhone, setWaPhone]       = useState<string | undefined>();
  const [selected, setSelected]     = useState<{ nodeId: string; msg: MsgData } | null>(null);
  const [msgMap, setMsgMap]         = useState<Record<string, string>>(
    () => Object.fromEntries(Object.values(MESSAGES).flat().map(m => [m.id, m.msg]))
  );
  const [zoom, setZoom]     = useState(0.85);
  const [pan, setPan]       = useState({ x: 40, y: 20 });
  const [panActive, setPanActive]   = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  const outerRef       = useRef<HTMLDivElement>(null);
  const isPanning      = useRef(false);
  const isDraggingNode = useRef(false);
  const draggingNodeId = useRef<string | null>(null);
  const dragOffset     = useRef({ x: 0, y: 0 });
  const lastMouse      = useRef({ x: 0, y: 0 });

  /* ── Load gym data ── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const id = user.id;
      setGymId(id);

      const { data: s } = await supabase
        .from("gym_settings")
        .select("lead_auto_welcome, bienvenida_activo, vencimiento_activo, inactividad_activo, canal_maps_activo, canal_ref_activo, instagram_url, slug, inactividad_msg, vencimiento_msg, magiclink_msg, wa_status, wa_phone")
        .eq("gym_id", id)
        .maybeSingle();

      if (s) {
        setActiveMap({
          contactos:   s.lead_auto_welcome   ?? false,
          bienvenida:  s.bienvenida_activo   ?? true,
          diadia:      s.vencimiento_activo  ?? false,
          vuelvencasa: s.inactividad_activo  ?? false,
        });
        setChannelActive({
          maps: s.canal_maps_activo ?? false,
          ig:   !!(s.instagram_url),
          web:  !!(s.slug),
          ref:  s.canal_ref_activo ?? false,
        });
        // Pre-fill message map with DB values where available
        const updates: Record<string, string> = {};
        if (s.inactividad_msg) updates["m-v1"] = s.inactividad_msg;
        if (s.vencimiento_msg) updates["m-d4"] = s.vencimiento_msg;
        if (s.magiclink_msg)   updates["m-b1"] = s.magiclink_msg;
        if (Object.keys(updates).length) setMsgMap(prev => ({ ...prev, ...updates }));

        if (s.wa_status) { setWaStatus(s.wa_status); setWaPhone(s.wa_phone ?? undefined); }
      }
      setLoading(false);
    })();
  }, []);

  /* ── Persist phase toggle ── */
  async function togglePhase(nodeId: string) {
    const pal = COL_PAL[nodeId];
    const next = !activeMap[nodeId];
    setActiveMap(m => ({ ...m, [nodeId]: next }));
    if (gymId) await supabase.from("gym_settings").update({ [pal.dbKey]: next }).eq("gym_id", gymId);
  }

  /* ── Persist channel toggle (only for non-readonly channels) ── */
  async function toggleChannel(id: string) {
    const ch = CHANNELS.find(c => c.id === id);
    if (!ch || ch.readonly) return;
    const col = id === "maps" ? "canal_maps_activo" : "canal_ref_activo";
    const next = !channelActive[id];
    setChannelActive(m => ({ ...m, [id]: next }));
    if (gymId) await supabase.from("gym_settings").update({ [col]: next }).eq("gym_id", gymId);
  }

  /* ── Zoom ── */
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(pz => {
        const nz = Math.min(2, Math.max(0.25, pz + delta));
        const r = nz / pz;
        setPan(pp => ({ x: mx - r * (mx - pp.x), y: my - r * (my - pp.y) }));
        return nz;
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDraggingNode.current = true;
    draggingNodeId.current = nodeId;
    setDraggingId(nodeId);
    const pos = positions[nodeId as keyof typeof positions];
    dragOffset.current = { x: (e.clientX - pan.x) / zoom - pos.x, y: (e.clientY - pan.y) / zoom - pos.y };
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [positions, pan, zoom]);

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPanActive(true);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (isDraggingNode.current && draggingNodeId.current) {
      const nx = (e.clientX - pan.x) / zoom - dragOffset.current.x;
      const ny = (e.clientY - pan.y) / zoom - dragOffset.current.y;
      setPositions(prev => ({ ...prev, [draggingNodeId.current!]: { x: nx, y: ny } }));
    } else if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  function onMouseUp() {
    isDraggingNode.current = false; draggingNodeId.current = null; setDraggingId(null);
    isPanning.current = false; setPanActive(false);
  }

  function handleZoomBtn(delta: number) {
    const el = outerRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    setZoom(pz => {
      const nz = Math.min(2, Math.max(0.25, pz + delta));
      const r = nz / pz;
      setPan(pp => ({ x: cx - r * (cx - pp.x), y: cy - r * (cy - pp.y) }));
      return nz;
    });
  }

  const waConnected = waStatus === "active";
  const totalActive = Object.values(activeMap).filter(Boolean).length;

  return (
    <>
      <style>{`
        @keyframes flow  { to { stroke-dashoffset: -30; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
      `}</style>

      {/* Stats bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <WABadge status={waStatus} phone={waPhone}/>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "5px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
          {loading ? "Cargando…" : `${totalActive}/4 fases activas`}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Scroll para zoom · Arrastrá los nodos</span>
      </div>

      {/* Canvas */}
      <div
        ref={outerRef}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => setSelected(null)}
        style={{ flex: 1, position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 0, backgroundColor: "#1a1a2e", backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "28px 28px", cursor: panActive ? "grabbing" : "grab", userSelect: "none", boxShadow: "0 0 0 1px rgba(255,255,255,0.05)" }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          <Edges positions={positions} activeMap={activeMap}/>
          <OriginNode
            pos={positions.origin}
            channelActive={channelActive}
            onChannelToggle={toggleChannel}
            onMouseDown={onNodeMouseDown}
          />
          {Object.keys(COL_PAL).map(nodeId => (
            <FlowNode key={nodeId}
              nodeId={nodeId}
              pos={positions[nodeId as keyof typeof positions]}
              active={activeMap[nodeId]}
              selected={selected?.nodeId === nodeId}
              dragging={draggingId === nodeId}
              waConnected={waConnected}
              onToggle={() => togglePhase(nodeId)}
              onCardClick={(nid, msg) => setSelected({ nodeId: nid, msg })}
              onMouseDown={onNodeMouseDown}
              selectedMsgId={selected?.msg?.id}
              msgMap={msgMap}
            />
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 50, display: "flex", flexDirection: "column", gap: 5 }}>
          {[{ label: "+", action: () => handleZoomBtn(0.15) }, { label: `${Math.round(zoom * 100)}%`, action: undefined, pct: true }, { label: "−", action: () => handleZoomBtn(-0.15) }].map((item, i) =>
            item.pct
              ? <div key={i} style={{ width: 32, fontSize: 9, fontWeight: 700, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>{item.label}</div>
              : <div key={i} onClick={item.action} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#242442", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>{item.label}</div>
          )}
          <div onClick={() => { setZoom(0.85); setPan({ x: 40, y: 20 }); }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#242442", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </div>
        </div>

        <SidePanel
          nodeId={selected?.nodeId ?? null}
          msg={selected?.msg ?? null}
          open={!!selected}
          onClose={() => setSelected(null)}
          gymId={gymId}
          msgMap={msgMap}
          onSave={(id, text) => setMsgMap(m => ({ ...m, [id]: text }))}
        />
      </div>
    </>
  );
}
