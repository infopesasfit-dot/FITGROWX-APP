const CACHE_NAME = "fitgrowx-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/offline.html",
  "/images/logo-192x192.png",
  "/images/logo-192x192-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching assets...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[SW] Some assets failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname === "/offline.html") {
    event.respondWith(caches.match("/offline.html"));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "error") {
            return response;
          }

          const responseToCache = response.clone();
          if (
            request.destination === "image" ||
            request.destination === "style" ||
            request.destination === "script"
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          if (request.destination === "document") {
            return caches.match("/offline.html");
          }
          return new Response("Recurso no disponible offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

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
        icon: data.icon || "/images/logo-192x192.png",
        badge: data.badge || "/images/logo-192x192.png",
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
      for (let client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});
