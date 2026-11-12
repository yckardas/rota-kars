// Rota Kars yönetim uygulaması (tarayıcıdan yüklenen sürüm): bildirimler ve
// bağlantı yokken gösterilen sayfa. Kapsamı yalnız /yonetim; site etkilenmez.
// Hiçbir şey önbelleğe alınmaz: panel her açılışta güncel sürümle gelir.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#24201D">
<title>Bağlantı yok · Rota Kars Yönetim</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#24201D;color:#ece6dc;
font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#aaa093}
button{font:inherit;font-weight:600;border:0;border-radius:6px;padding:11px 20px;background:#9C3B2E;color:#fff}</style>
</head><body><main><h1>İnternet bağlantısı yok</h1><p>Bağlantı gelince panel kaldığı yerden açılır.</p>
<button onclick="location.reload()">Yeniden dene</button></main></body></html>`;

// Yönetim sayfası her zaman ağdan gelir; yalnız bağlantı yoksa uyarı sayfası döner.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});

// Bildirime dokununca yalnız panel içi bir yola gidilir.
const internalPath = (url) =>
  typeof url === "string" && /^\/yonetim(?:[?#][\w\-/?=&.%#]*)?$/.test(url) ? url : "/yonetim";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(String(data.title || "Rota Kars Yönetim").slice(0, 120), {
      body: String(data.body || "").slice(0, 300),
      icon: "/images/app/icon-192.png",
      badge: "/images/app/badge-96.png",
      lang: "tr",
      data: { url: internalPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = internalPath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).pathname === "/yonetim");
      if (open) {
        // Açık panel sayfayı yenilemeden ilgili sekmeye geçer.
        await open.focus();
        open.postMessage({ type: "rota-open", path });
        return;
      }
      await self.clients.openWindow(path);
    })(),
  );
});
