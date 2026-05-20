// Service Worker for push notifications

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("[SW] Push received but no data");
    return;
  }

  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || "/icon-192x192.png",
        badge: data.badge || "/badge-72x72.png",
        tag: data.tag || "notification",
        data: data.data || {},
      })
    );
  } catch (err) {
    console.error("[SW] Error processing push:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/alumno/panel";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if window is already open
      for (let client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});
