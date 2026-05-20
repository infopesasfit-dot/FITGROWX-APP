import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure web-push only if VAPID keys are set
let webpushConfigured = false;
if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    webpushConfigured = true;
  } catch (err) {
    console.error("[push-cron] Failed to configure web-push:", err);
  }
}

export async function POST(req: Request) {
  // Verify cron secret
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!webpushConfigured) {
    console.log("[push-cron] Web-push not configured, skipping");
    return Response.json({ ok: true, message: "Web-push not configured" });
  }

  try {
    let sentCount = 0;
    let failedCount = 0;

    // Get all push subscriptions with relevant alumno data
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select(`
        alumno_id,
        endpoint,
        p256dh,
        auth,
        alumnos:alumno_id (
          full_name,
          expiration
        )
      `)
      .not("endpoint", "is", null);

    if (subError) {
      console.error("[push-cron] Error fetching subscriptions:", subError);
      return Response.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    // Send class reminders (24 hours before)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().slice(0, 10);

    const { data: classes } = await supabase
      .from("gym_classes")
      .select(`
        clase_id,
        class_name,
        day_of_week,
        start_time,
        reservas:gym_reservas!clase_id (
          alumno_id
        )
      `);

    // Get tomorrow's classes and notify reserved alumnos
    if (classes) {
      for (const cls of classes) {
        // Check if class is tomorrow
        const tomorrowDow = tomorrow.getDay();
        if (cls.day_of_week !== tomorrowDow) continue;

        // Notify each alumno with a reservation
        for (const reserva of cls.reservas || []) {
          const sub = subscriptions?.find(s => s.alumno_id === reserva.alumno_id);
          if (!sub) continue;

          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              JSON.stringify({
                title: `¡Tu clase de mañana! 🏋️`,
                body: `${cls.class_name} a las ${cls.start_time}`,
                icon: "/icon-192x192.png",
                badge: "/badge-72x72.png",
                tag: `class-${cls.clase_id}`,
                data: {
                  url: "/alumno/panel?tab=calendario",
                },
              })
            );
            sentCount++;
          } catch (err: any) {
            if (err.statusCode === 410) {
              // Subscription expired, delete it
              await supabase
                .from("push_subscriptions")
                .delete()
                .eq("alumno_id", reserva.alumno_id);
            }
            failedCount++;
          }
        }
      }
    }

    // Send payment reminders (7 days before expiration)
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    for (const sub of subscriptions || []) {
      const alumno = Array.isArray(sub.alumnos) ? sub.alumnos[0] : sub.alumnos;
      if (!alumno?.expiration) continue;

      const expirationDate = new Date(alumno.expiration);
      const diffDays = Math.ceil(
        (expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays !== 7) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: `Tu membresía vence en 7 días 📅`,
            body: `Renová ahora para seguir entrenando`,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
            tag: "payment-reminder",
            data: {
              url: "/alumno/panel?tab=perfil",
            },
          })
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("alumno_id", sub.alumno_id);
        }
        failedCount++;
      }
    }

    return Response.json({
      ok: true,
      sentCount,
      failedCount,
      total: (subscriptions || []).length,
    });
  } catch (err) {
    console.error("[push-cron] Error:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
