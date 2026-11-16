/* 사장랩 — 오프라인 앱 껍데기 캐시 (가벼운 서비스워커)
   · 앱 파일만 캐시하고 서버로 보내는 데이터는 없습니다 (입력값은 브라우저 localStorage에만 저장).
   · 새 버전을 올리면 아래 버전 문자열만 올리면 됩니다. */
const VERSION = 'sajanglab-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/mascot-128.png',
  './privacy.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // 하나가 404여도 설치 자체는 실패하지 않게 개별로 담는다
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 폰트 CDN 등 외부 요청은 그대로

  // 페이지 열기: 네트워크 우선(새 버전 반영), 실패하면 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); }).catch(function () {});
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 그 밖의 앱 파일: 캐시 우선 + 뒤에서 조용히 갱신
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
