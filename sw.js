// ═══════════════════════════════════════════════════
//  Service Worker — PO Tracker PWA
//  Version: v1.0 — 2026-03-20
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'po-tracker-v1';

// ไฟล์ที่จะ cache ไว้ใช้ offline
const CACHE_FILES = [
  '/po-tracker/po-mobile.html',
  '/po-tracker/manifest.json',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap'
];

// ── Install: cache ไฟล์หลัก ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // cache แค่ไฟล์หลัก — ถ้า font โหลดไม่ได้ก็ไม่ fail
      return cache.addAll(['/po-tracker/po-mobile.html']).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: ลบ cache เก่า ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network First strategy ──
// พยายามดึงจาก network ก่อนเสมอ ถ้าไม่มีเน็ตค่อย fallback cache
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ✅ FIX: รับเฉพาะ http/https เท่านั้น — ข้าม chrome-extension://, data:, blob: ฯลฯ
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  // ไม่ cache GAS API calls (script.google.com)
  if (url.includes('script.google.com')) return;
  // ไม่ cache POST requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ถ้าโหลดสำเร็จ → cache ใหม่ด้วย
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ถ้าไม่มีเน็ต → ใช้จาก cache
        return caches.match(event.request);
      })
  );
});
