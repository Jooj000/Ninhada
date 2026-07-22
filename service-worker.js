/* =====================================================================
 * service-worker.js — PWA offline + ATUALIZAÇÃO AUTOMÁTICA
 * ---------------------------------------------------------------------
 * Como o cache se renova quando você sobe código novo:
 *   - Arquivos do próprio app (html/css/js) usam "network-first":
 *     quando online, sempre busca a versão mais nova no servidor e
 *     atualiza o cache. Offline, cai no cache. => você não precisa
 *     bumpar versão a cada deploy; o novo código chega sozinho.
 *   - Ao ativar, caches antigos (de CACHE_VERSION anteriores) são
 *     apagados. Bumpe o número abaixo se quiser forçar limpeza total.
 * ===================================================================== */

const CACHE_VERSION = "bebe-v21";           // troque (v3, v4…) p/ limpar tudo
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/register-sw.js",
  "./js/game.js",
  "./js/state.js",
  "./js/config.js",
  "./js/assets-map.js",
  "./js/firebase-sync.js",
  "./js/shop.js",
  "./js/minigame.js",
  "./js/board.js",
  "./js/circuit.js",
  "./js/session.js",
  "./js/touch.js",
  "./js/render-utils.js",
  "./js/recipes.js",
  "./js/rooms.js",
  "./js/weather.js",
  "./js/nightmares.js",
  "./js/streak.js",
  "./js/push.js",
  "./js/dino.js",
  "./js/photos.js",
  "./js/homework.js",
  "./js/fishing.js",
  "./js/identity.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();                       // novo SW assume na hora
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Só cuidamos dos arquivos do próprio site. Firebase, Google Fonts etc.
  // passam direto para a rede (não devem ser interceptados).
  if (url.origin !== self.location.origin) return;

  // network-first: pega o mais novo quando online, cache como reserva.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

/* =====================================================================
 * PUSH (Web Push nativo) — entrega mesmo com o app fechado
 * ===================================================================== */
self.addEventListener("push", (event) => {
  let data = { title: "Nosso Bebê", body: "Alguém precisa de você!", url: "./index.html" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "assets/icons/icon-192.png",
      badge: "assets/icons/icon-192.png",
      tag: data.tag || "bebe",
      renotify: true,
      data: { url: data.url || "./index.html" },
    })
  );
});

/* Toque na notificação: abre (ou foca) o app. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
