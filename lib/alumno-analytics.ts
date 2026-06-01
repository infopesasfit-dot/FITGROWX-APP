"use client";

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  alumno_id?: string;
}

class AlumnoAnalytics {
  private enabled = typeof window !== "undefined";

  identify(alumnoId: string, properties?: Record<string, unknown>) {
    if (!this.enabled) return;

    // Guardar en localStorage para sesión
    try {
      const session = JSON.parse(localStorage.getItem("fitgrowx_alumno") || "{}");
      session.analytics_id = alumnoId;
      localStorage.setItem("fitgrowx_alumno", JSON.stringify(session));
    } catch {}

    // Aquí iría Mixpanel.identify(alumnoId, properties)
    console.debug("[analytics] identify", alumnoId, properties);
  }

  track(event: AnalyticsEvent) {
    if (!this.enabled) return;

    const payload = {
      ...event.properties,
      timestamp: new Date().toISOString(),
      alumno_id: event.alumno_id,
      url: window.location.pathname,
    };

    // Aquí iría Mixpanel.track(event.event, payload)
    console.debug("[analytics]", event.event, payload);
  }

  // Eventos predefinidos
  trackLogin(alumnoId: string, gymId: string) {
    this.track({
      event: "alumno_login",
      alumno_id: alumnoId,
      properties: { gym_id: gymId },
    });
  }

  trackReserva(alumnoId: string, claseId: string, accion: "created" | "cancelled") {
    this.track({
      event: `alumno_reserva_${accion}`,
      alumno_id: alumnoId,
      properties: { clase_id: claseId },
    });
  }

  trackPago(alumnoId: string, plan: string, precio: number) {
    this.track({
      event: "alumno_pago_initiated",
      alumno_id: alumnoId,
      properties: { plan, precio },
    });
  }

  trackTabView(alumnoId: string, tab: "inicio" | "calendario" | "entrenamiento" | "metas" | "perfil") {
    this.track({
      event: "alumno_tab_view",
      alumno_id: alumnoId,
      properties: { tab },
    });
  }

  trackFotoUpload(alumnoId: string, success: boolean, size: number) {
    this.track({
      event: "alumno_foto_upload",
      alumno_id: alumnoId,
      properties: { success, size },
    });
  }

  trackWorkoutComplete(alumnoId: string, rutinaNombre: string, duration: number) {
    this.track({
      event: "alumno_workout_complete",
      alumno_id: alumnoId,
      properties: { rutina: rutinaNombre, duration },
    });
  }

  trackError(error: string, context?: Record<string, unknown>) {
    this.track({
      event: "alumno_error",
      properties: { error, ...context },
    });
  }
}

export const analytics = new AlumnoAnalytics();
