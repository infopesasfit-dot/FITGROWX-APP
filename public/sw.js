const CACHE = "fitgrowx-alumno-v1";

// Cache static shell on install
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

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Cache-first for Next.js static assets (hashed filenames — never stale)
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Cache-first for public images/icons
  if (url.pathname.startsWith("/images/") || url.pathname === "/manifest.json") {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Network-first + cache for alumno API endpoints (bootstrap, me, pesos, rutina, workout-log)
  if (
    url.pathname.startsWith("/api/alumno/bootstrap") ||
    url.pathname.startsWith("/api/alumno/me") ||
    url.pathname.startsWith("/api/alumno/pesos") ||
    url.pathname.startsWith("/api/alumno/rutina") ||
    (url.pathname.startsWith("/api/alumno/workout-log") && request.method === "GET")
  ) {
    e.respondWith(networkFirstWithCache(request));
    return;
  }

  // Network-first for alumno panel navigation
  if (request.mode === "navigate" && url.pathname.startsWith("/alumno/")) {
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
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // For navigate requests return cached panel shell if available
    if (request.mode === "navigate") {
      const shell = await cache.match("/alumno/panel");
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
