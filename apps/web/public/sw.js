// Service worker (one app: the member app at /app and the admin at /admin).
// - The member app's built files are kept, so it opens instantly and offline.
// - Admin pages and data are private to each person: never stored. Offline,
//   a short notice shows instead of the browser's error page.
const CACHE = "gos-v2";
const APP_SHELL = "/app/index.html";
const OFFLINE_HTML =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
  '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#1f2a10;color:#fff;text-align:center">' +
  '<div><h1>You are offline</h1><p>Reconnect and try again.</p><button onclick="location.reload()" style="padding:10px 18px;border-radius:10px;border:0;background:#a3e635;color:#1f2a10;font-size:16px">Retry</button></div>';

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/icons/icon-192.png"]))
      // The icon is a nice-to-have: a storage hiccup mustn't stop the worker (and alerts) installing.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Built files never change under the same name, so the cache can answer first.
const IMMUTABLE = /^\/(app\/(_expo|assets)|icons)\/|\.(wasm|ttf|woff2?)$/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const inMemberApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (inMemberApp && res.ok) caches.open(CACHE).then((c) => c.put(APP_SHELL, res.clone()));
          return res;
        })
        .catch(async () =>
          (inMemberApp && (await caches.match(APP_SHELL))) ||
          new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
        ),
    );
    return;
  }

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// Phone alerts for the gym team (lib/push.ts): show it, and open its page when tapped.
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { title: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "Squatpress", {
      body: msg.body || "",
      tag: msg.tag,
      icon: "/icons/icon-192.png",
      data: { url: msg.url || "/go" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/go", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((w) => (w || open).focus());
      return self.clients.openWindow(target);
    }),
  );
});
