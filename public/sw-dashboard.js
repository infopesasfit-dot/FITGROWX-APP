const CACHE = "fitgrowx-owner-v2";

// Endpoints críticos para modo offline
const OFFLINE_API = [
  "/api/admin/alumnos",
  "/api/admin/dashboard",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Cache-first: assets estáticos con hash — nunca se desactualizan
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Cache-first: imágenes e iconos públicos
  if (url.pathname.startsWith("/images/") || url.pathname === "/manifest-dashboard.json") {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Network-first + cache: endpoints críticos de datos (offline fallback)
  if (OFFLINE_API.some(p => url.pathname.startsWith(p))) {
    e.respondWith(networkFirstWithCache(request));
    return;
  }

  // Network-first: navegación dentro del dashboard
  if (request.mode === "navigate" && url.pathname.startsWith("/dashboard")) {
    e.respondWith(networkFirstWithCache(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request.clone());
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const shell = await cache.match("/dashboard/alumnos");
      if (shell) return shell;
    }

    return new Response(
      JSON.stringify({ ok: false, error: "offline", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
