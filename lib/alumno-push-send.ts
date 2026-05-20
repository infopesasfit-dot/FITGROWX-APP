import { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Configure web-push if VAPID keys are available
let webpushConfigured = false;
if (typeof process !== "undefined" && process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    webpushConfigured = true;
  } catch (err) {
    console.error("[push-send] Failed to configure web-push:", err);
  }
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

/**
 * Send a push notification to a specific alumno
 * @param supabase Supabase client
 * @param alumno_id Student ID
 * @param payload Push notification payload
 * @returns true if sent successfully
 */
export async function sendPushNotification(
  supabase: SupabaseClient,
  alumno_id: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!webpushConfigured) {
    console.log("[push-send] Web-push not configured, skipping for", alumno_id);
    return false;
  }

  try {
    // Get subscription for this alumno
    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("alumno_id", alumno_id)
      .maybeSingle();

    if (subError) {
      console.error("[push-send] Error fetching subscription:", subError);
      return false;
    }

    if (!subscription?.endpoint) {
      console.log("[push-send] No subscription found for", alumno_id);
      return false;
    }

    // Send push notification
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? "/icon-192x192.png",
        badge: payload.badge ?? "/badge-72x72.png",
        tag: payload.tag ?? "notification",
        data: {
          url: payload.url ?? "/alumno/panel",
        },
      })
    );

    console.log("[push-send] Notification sent to", alumno_id);
    return true;
  } catch (err: any) {
    // Clean up expired subscriptions (410 = Gone)
    if (err.statusCode === 410) {
      console.log("[push-send] Cleaning up expired subscription for", alumno_id);
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("alumno_id", alumno_id);
      return false;
    }

    console.error("[push-send] Failed to send notification:", err);
    return false;
  }
}

/**
 * Send push notification to multiple alumnos
 * @param supabase Supabase client
 * @param alumno_ids Array of student IDs
 * @param payload Push notification payload
 * @returns Object with sent and failed counts
 */
export async function sendPushNotificationBatch(
  supabase: SupabaseClient,
  alumno_ids: string[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    alumno_ids.map(id => sendPushNotification(supabase, id, payload))
  );

  const sent = results.filter(r => r.status === "fulfilled" && r.value === true).length;
  const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && r.value === false)).length;

  return { sent, failed };
}

/**
 * Pre-defined push notification templates
 */
export const PushTemplates = {
  classReminder: (className: string, startTime: string): PushNotificationPayload => ({
    title: "¡Tu clase de mañana! 🏋️",
    body: `${className} a las ${startTime}`,
    tag: "class-reminder",
    url: "/alumno/panel?tab=calendario",
  }),

  paymentReminder7Days: (): PushNotificationPayload => ({
    title: "Tu membresía vence en 7 días 📅",
    body: "Renová ahora para seguir entrenando",
    tag: "payment-reminder-7d",
    url: "/alumno/panel?tab=perfil",
  }),

  paymentExpired: (daysOverdue: number = 0): PushNotificationPayload => ({
    title: `⚠️ Tu membresía ${daysOverdue === 0 ? "vence hoy" : "venció"}`,
    body: "Renueva tu membresía para seguir accediendo al gym",
    tag: "payment-expired",
    url: "/alumno/panel?tab=perfil",
  }),

  classCancelled: (className: string, date: string, time: string): PushNotificationPayload => ({
    title: "Clase cancelada 😔",
    body: `${className} del ${date} a las ${time} fue cancelada`,
    tag: "class-cancelled",
    url: "/alumno/panel?tab=calendario",
  }),

  routineAssigned: (routineName: string): PushNotificationPayload => ({
    title: "Nueva rutina asignada 💪",
    body: `Tu profe te asignó: ${routineName}`,
    tag: "routine-assigned",
    url: "/alumno/panel?tab=entrenamiento",
  }),

  customMessage: (title: string, body: string, url?: string): PushNotificationPayload => ({
    title,
    body,
    url,
  }),
};
