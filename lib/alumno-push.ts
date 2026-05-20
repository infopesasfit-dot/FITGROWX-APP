"use client";

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class AlumnoPushManager {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[Push] Service Worker or Push Manager not supported");
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("[Push] Service Worker registered");
      return true;
    } catch (err) {
      console.error("[Push] Failed to register Service Worker:", err);
      return false;
    }
  }

  async requestPermission() {
    const permission = Notification.permission;

    if (permission === "denied") {
      console.log("[Push] User denied notification permission");
      return false;
    }

    if (permission === "granted") {
      return true;
    }

    // Request permission
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  async subscribe(alumnoId: string) {
    if (!this.registration) {
      const initialized = await this.init();
      if (!initialized) return false;
    }

    try {
      const permission = await this.requestPermission();
      if (!permission) return false;

      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Send subscription to server
      const res = await fetch("/api/alumno/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          alumno_id: alumnoId,
          subscription: subscription.toJSON(),
        }),
      });

      return res.ok;
    } catch (err) {
      console.error("[Push] Failed to subscribe:", err);
      return false;
    }
  }

  async unsubscribe(alumnoId: string) {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (!subscription) return true;

      await subscription.unsubscribe();

      // Notify server
      await fetch("/api/alumno/push-unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alumno_id: alumnoId }),
      });

      return true;
    } catch (err) {
      console.error("[Push] Failed to unsubscribe:", err);
      return false;
    }
  }

  async isSubscribed() {
    if (!this.registration) {
      const initialized = await this.init();
      if (!initialized) return false;
    }

    try {
      const subscription = await this.registration!.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }
}

export const pushManager = new AlumnoPushManager();
