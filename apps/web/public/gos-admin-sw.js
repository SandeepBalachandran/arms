// GOS Admin service worker. Admin pages are per-person and private, so they are
// never stored: the network always answers. Offline, a short notice is shown
// instead of the browser's error page.
const OFFLINE = new Response(
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>GOS Admin</title>' +
    '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#a3e635;color:#18181b;text-align:center">' +
    '<div><h1>GOS Admin</h1><p>You are offline. Reconnect and try again.</p><button onclick="location.reload()" style="padding:10px 18px;border-radius:10px;border:0;background:#18181b;color:#a3e635;font-size:16px">Retry</button></div>',
  { headers: { "Content-Type": "text/html; charset=utf-8" } },
);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => OFFLINE.clone()));
});
