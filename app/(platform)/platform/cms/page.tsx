"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowRight, FileText, FolderOpen, Plus, ShieldAlert } from "lucide-react";

const fd = "var(--font-inter, 'Inter', sans-serif)";
const fb = "var(--font-inter, 'Inter', sans-serif)";

const shellCard: React.CSSProperties = {
  background: "rgba(248,250,252,0.88)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 28,
  boxShadow:
    "0 28px 60px rgba(15,23,42,0.10), 0 6px 16px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.6)",
};

type ResourceStatus = "draft" | "published" | "archived";

type VaultResourceRow = {
  id: string;
  title: string;
  status: string;
  format: string | null;
  updated_at: string;
};

type VaultCategoryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
};

function getErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value && typeof (value as { message?: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return "No se pudo cargar el CMS.";
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (["converted", "registered", "published"].includes(key)) return { bg: "rgba(22,163,74,0.10)", color: "#15803D" };
  if (["trial_active", "contacted", "qualified", "draft"].includes(key)) return { bg: "rgba(37,99,235,0.10)", color: "#2563EB" };
  if (["trial_setup", "new", "open"].includes(key)) return { bg: "rgba(249,115,22,0.10)", color: "#C2410C" };
  if (["trial_risk", "archived"].includes(key)) return { bg: "rgba(234,179,8,0.14)", color: "#A16207" };
  if (["churned"].includes(key)) return { bg: "rgba(100,116,139,0.12)", color: "#475569" };
  return { bg: "rgba(220,38,38,0.10)", color: "#B91C1C" };
}

function emptyState(title: string, body: string) {
  return (
    <div style={{ borderRadius: 20, border: "1px dashed rgba(148,163,184,0.28)", padding: 22, background: "rgba(255,255,255,0.55)" }}>
      <p style={{ marginBottom: 8, font: `700 0.92rem/1 ${fd}`, color: "#111827" }}>{title}</p>
      <p style={{ font: `400 0.88rem/1.65 ${fb}`, color: "#64748B" }}>{body}</p>
    </div>
  );
}

function CmsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [vaultResources, setVaultResources] = useState<VaultResourceRow[]>([]);
  const [vaultCategories, setVaultCategories] = useState<VaultCategoryRow[]>([]);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ title: "", description: "" });
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    category_id: "",
    format: "Tutorial",
    status: "draft" as ResourceStatus,
  });

  const resetFeedbackSoon = useCallback(() => {
    window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  const fetchVaultData = useCallback(async () => {
    const [
      { data: resourceRows, error: resourceRowsError },
      { data: categoryRows, error: categoryRowsError },
    ] = await Promise.all([
      supabase.from("vault_resources").select("id, title, status, format, updated_at").order("updated_at", { ascending: false }).limit(6),
      supabase.from("vault_categories").select("id, slug, title, description, is_active").order("sort_order", { ascending: true }),
    ]);
    if (resourceRowsError || categoryRowsError) return;
    setVaultResources((resourceRows ?? []) as VaultResourceRow[]);
    setVaultCategories((categoryRows ?? []) as VaultCategoryRow[]);
  }, []);

  // Auth check + initial load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { if (active) { setError("Necesitas iniciar sesión."); setLoading(false); } return; }
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("role").eq("id", user.id).limit(1).maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error("No se encontró tu perfil en la tabla profiles.");
        if (profile.role !== "platform_owner") {
          if (active) { setError("Tu usuario no tiene acceso al panel de plataforma."); setLoading(false); }
          return;
        }
        if (active) setAuthorized(true);
        await fetchVaultData();
        if (active) setLoading(false);
      } catch (caughtError) {
        if (active) { setError(getErrorMessage(caughtError)); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [fetchVaultData]);

  // Auto-set first category when categories load
  useEffect(() => {
    if (!resourceForm.category_id && vaultCategories.length > 0) {
      setResourceForm(current => ({ ...current, category_id: vaultCategories[0].id }));
    }
  }, [resourceForm.category_id, vaultCategories]);

  const handleCategorySubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!categoryForm.title.trim()) return;
    try {
      setSavingCategory(true);
      setFeedback(null);
      const res = await fetch("/api/platform/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", title: categoryForm.title.trim(), description: categoryForm.description.trim() || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al crear."); }
      setCategoryForm({ title: "", description: "" });
      await fetchVaultData();
      setFeedback("Categoría creada en el CMS.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingCategory(false);
    }
  }, [fetchVaultData, resetFeedbackSoon, categoryForm]);

  const handleResourceSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceForm.title.trim() || !resourceForm.category_id) return;
    try {
      setSavingResource(true);
      setFeedback(null);
      const res = await fetch("/api/platform/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "resource",
          title: resourceForm.title.trim(),
          description: resourceForm.description.trim() || null,
          category_id: resourceForm.category_id,
          format: resourceForm.format.trim() || null,
          status: resourceForm.status,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al crear."); }
      setResourceForm({ title: "", description: "", category_id: vaultCategories[0]?.id ?? "", format: "Tutorial", status: "draft" });
      await fetchVaultData();
      setFeedback("Recurso creado en la base del CMS.");
      resetFeedbackSoon();
    } catch (caughtError) {
      setFeedback(getErrorMessage(caughtError));
    } finally {
      setSavingResource(false);
    }
  }, [fetchVaultData, resetFeedbackSoon, resourceForm, vaultCategories]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
        <div style={{ ...shellCard, padding: 28 }}>
          <p style={{ font: `500 0.95rem/1.6 ${fb}`, color: "#64748B" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !authorized) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
        <div style={{ ...shellCard, padding: 28 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <ShieldAlert size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ font: `400 0.92rem/1.6 ${fb}`, color: "#64748B" }}>{error ?? "Sin acceso."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 48px" }}>
      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 24 }}>
        <article style={{ ...shellCard, padding: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <FolderOpen size={20} color="#F97316" />
          </div>
          <p style={{ marginBottom: 8, font: `600 0.8rem/1 ${fb}`, color: "#94A3B8" }}>Recursos CMS</p>
          <p style={{ font: `800 2rem/1 ${fd}`, color: "#111827", letterSpacing: "-0.04em" }}>{vaultResources.length}</p>
        </article>
      </section>

      {feedback && (
        <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.06)", color: "#334155", border: "1px solid rgba(148,163,184,0.18)", padding: "12px 14px", font: `600 0.82rem/1.5 ${fb}`, marginBottom: 18 }}>
          {feedback}
        </div>
      )}

      {/* Main grid */}
      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18, marginBottom: 24 }}>
        <article style={{ ...shellCard, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <p style={{ marginBottom: 8, font: `700 0.74rem/1 ${fd}`, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.14em" }}>CMS Bóveda</p>
            <h2 style={{ font: `780 1.45rem/1.1 ${fd}`, color: "#111827", letterSpacing: "-0.03em", marginBottom: 10 }}>
              Base editorial para subir recursos sin tocar código
            </h2>
            <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: "#475569" }}>
              Ya puedes separar categorías y recursos como contenido administrable. El próximo
              paso es conectar la bóveda pública a estas tablas y sumar alta/edición desde UI.
            </p>
          </div>

          <div style={{ marginBottom: 18 }}>
            <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>Categorías cargadas</p>
            {vaultCategories.length === 0
              ? emptyState("Sin categorías en CMS", "La migración crea la estructura. Si no aparecen categorías, revisa que las semillas se hayan aplicado correctamente.")
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {vaultCategories.map((category) => (
                    <span key={category.id} style={{ padding: "9px 12px", borderRadius: 999, background: category.is_active ? "rgba(255,255,255,0.78)" : "rgba(148,163,184,0.16)", border: "1px solid rgba(255,255,255,0.95)", font: `600 0.78rem/1 ${fb}`, color: category.is_active ? "#334155" : "#94A3B8" }}>
                      {category.title}
                    </span>
                  ))}
                </div>
              )}
          </div>

          <div>
            <p style={{ marginBottom: 12, font: `700 0.78rem/1 ${fd}`, color: "#475569" }}>Recursos en base</p>
            {vaultResources.length === 0
              ? emptyState("Todavía no hay recursos en DB", "La siguiente etapa es migrar tus recursos actuales a `vault_resources` y luego crear el editor para la bóveda.")
              : (
                <div style={{ display: "grid", gap: 12 }}>
                  {vaultResources.map((resource) => {
                    const tone = statusTone(resource.status);
                    return (
                      <article key={resource.id} style={{ borderRadius: 18, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <p style={{ marginBottom: 6, font: `700 0.96rem/1.2 ${fd}`, color: "#111827" }}>{resource.title}</p>
                            <p style={{ font: `400 0.82rem/1.5 ${fb}`, color: "#64748B" }}>
                              {resource.format ?? "Sin formato"} · actualizado {new Date(resource.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span style={{ padding: "7px 10px", borderRadius: 999, background: tone.bg, color: tone.color, font: `700 0.7rem/1 ${fd}`, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {resource.status}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
          </div>
        </article>

        <article style={{ ...shellCard, padding: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <p style={{ marginBottom: 8, font: `700 0.74rem/1 ${fd}`, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.14em" }}>Alta rápida CMS</p>
            <h2 style={{ font: `780 1.45rem/1.1 ${fd}`, color: "#111827", letterSpacing: "-0.03em", marginBottom: 10 }}>
              Crea categorías y recursos desde este panel
            </h2>
            <p style={{ font: `400 0.92rem/1.65 ${fb}`, color: "#475569" }}>
              Dejamos una primera capa simple para publicar la estructura editorial sin tocar
              código. Después afinamos editor, portada y contenido enriquecido.
            </p>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <form onSubmit={handleCategorySubmit} style={{ borderRadius: 20, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Plus size={16} color="#F97316" />
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nueva categoría</p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={categoryForm.title}
                  onChange={(event) => setCategoryForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="Ej: Tutoriales de automatización"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", outline: "none", font: `500 0.84rem/1 ${fb}` }}
                />
                <textarea
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm(current => ({ ...current, description: event.target.value }))}
                  placeholder="Descripción breve para la categoría"
                  rows={3}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", outline: "none", font: `500 0.84rem/1.5 ${fb}`, resize: "vertical" }}
                />
              </div>
              <button type="submit" disabled={savingCategory} style={{ marginTop: 14, width: "100%", border: "none", borderRadius: 12, background: "#111827", color: "#FFFFFF", padding: "11px 14px", font: `700 0.84rem/1 ${fd}`, cursor: "pointer", opacity: savingCategory ? 0.7 : 1 }}>
                {savingCategory ? "Guardando..." : "Crear categoría"}
              </button>
            </form>

            <form onSubmit={handleResourceSubmit} style={{ borderRadius: 20, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Plus size={16} color="#2563EB" />
                <p style={{ font: `700 0.9rem/1 ${fd}`, color: "#111827" }}>Nuevo recurso</p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={resourceForm.title}
                  onChange={(event) => setResourceForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="Título del recurso"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", outline: "none", font: `500 0.84rem/1 ${fb}` }}
                />
                <textarea
                  value={resourceForm.description}
                  onChange={(event) => setResourceForm(current => ({ ...current, description: event.target.value }))}
                  placeholder="Resumen corto para la card o listado"
                  rows={3}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", outline: "none", font: `500 0.84rem/1.5 ${fb}`, resize: "vertical" }}
                />
                <select
                  value={resourceForm.category_id}
                  onChange={(event) => setResourceForm(current => ({ ...current, category_id: event.target.value }))}
                  style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", font: `600 0.82rem/1 ${fb}` }}
                >
                  <option value="">Selecciona una categoría</option>
                  {vaultCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.title}</option>
                  ))}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    value={resourceForm.format}
                    onChange={(event) => setResourceForm(current => ({ ...current, format: event.target.value }))}
                    placeholder="Formato"
                    style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", outline: "none", font: `500 0.84rem/1 ${fb}` }}
                  />
                  <select
                    value={resourceForm.status}
                    onChange={(event) => setResourceForm(current => ({ ...current, status: event.target.value as ResourceStatus }))}
                    style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.88)", padding: "11px 12px", color: "#111827", font: `600 0.82rem/1 ${fb}` }}
                  >
                    {["draft", "published", "archived"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={savingResource || vaultCategories.length === 0} style={{ marginTop: 14, width: "100%", border: "none", borderRadius: 12, background: "#111827", color: "#FFFFFF", padding: "11px 14px", font: `700 0.84rem/1 ${fd}`, cursor: "pointer", opacity: savingResource || vaultCategories.length === 0 ? 0.7 : 1 }}>
                {savingResource ? "Guardando..." : "Crear recurso"}
              </button>
            </form>

            <div style={{ display: "grid", gap: 12 }}>
              {[
                "Migrar los recursos actuales desde data.ts a vault_resources.",
                "Permitir alta/edición de objetivo, outcome y contenido enriquecido.",
                "Conectar /dashboard/boveda a la base nueva.",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.95)", padding: 14, font: `500 0.84rem/1.6 ${fb}`, color: "#475569" }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/dashboard/boveda" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 14, background: "#111827", color: "#FFFFFF", textDecoration: "none", font: `700 0.88rem/1 ${fd}`, boxShadow: "0 14px 28px rgba(15,23,42,0.16)" }}>
          Ver bóveda actual
          <ArrowRight size={15} />
        </Link>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.72)", color: "#475569", font: `600 0.86rem/1 ${fb}`, border: "1px solid rgba(255,255,255,0.9)" }}>
          <FileText size={15} />
          Siguiente paso sugerido: conectar la bóveda al CMS nuevo
        </div>
      </div>
    </div>
  );
}

export default memo(CmsPage);
