/* Service Worker：PWA 离线缓存。
   策略：缓存优先（Cache First），命中缓存立即返回，后台静默更新。
   只缓存静态骨架（index.html / echarts / 图标 / manifest），
   不缓存任何 /v1/* 动态数据接口（行情必须实时）。 */
const CACHE = 'pwa-v2';
const STATIC = ['/', '/index.html', '/echarts.min.js', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(STATIC); }).then(function () { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const url = new URL(e.request.url);
  /* 动态数据接口、非 GET、跨域请求，一律不缓存、直接放行 */
  if (e.request.method !== 'GET' || url.pathname.indexOf('/v1/') === 0 || url.origin !== self.location.origin) {
    return;
  }
  /* 页面导航：网络优先，失败回退缓存（保证总是最新，又能在离线时兜底） */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () { return caches.match('/index.html'); })
    );
    return;
  }
  /* 静态资源：缓存优先 + 后台更新 */
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      const fresh = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});
