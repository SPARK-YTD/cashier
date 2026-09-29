// ✅ Service Worker بسيط - غرضه الوحيد إنه يخلي صفحة الديلفري "قابلة للتثبيت"
// على الشاشة الرئيسية (PWA). ما يسوي أي تخزين مؤقت (cache) عشان الصفحة
// تضل تجيب آخر تحديث من السيرفر كل مرة - هذا مشروع حي (Supabase Realtime)
// وما نبي أي نسخة قديمة تنكاش من الكاش.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ✅ لازم نمرر fetch handler (حتى لو ما يسوي شي) عشان المتصفح يعتبر
// الصفحة PWA قابلة للتثبيت فعلياً
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
