/* 업무일지 서비스워커
   목적: 앱 화면과 글꼴·라이브러리를 캐시해 두어
        인터넷이 없어도 앱이 열리게 합니다.
   주의: 일지 데이터 자체는 Firebase가 담당하므로 여기서 캐시하지 않습니다. */

const VERSION = 'diary-v1';
const SHELL = [
  './diary.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
];

/* 설치: 앱 껍데기를 미리 담아둠 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => {}))   // 일부 실패해도 설치는 진행
      .then(() => self.skipWaiting())
  );
});

/* 활성화: 예전 버전 캐시 정리 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 데이터·인증 요청은 절대 가로채지 않음 (항상 실시간) */
  const LIVE = ['firebaseio.com','firebasedatabase.app','googleapis.com','google.com',
                'gstatic.com/firebasejs','firebaseapp.com','open-meteo.com','accounts.google.com'];
  if(LIVE.some(h => url.hostname.includes(h) || url.href.includes(h))) return;

  /* 앱 화면: 네트워크 우선 → 실패하면 캐시 (항상 최신을 쓰되 오프라인에서도 열림) */
  if(req.mode === 'navigate' || url.pathname.endsWith('diary.html')){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./diary.html')))
    );
    return;
  }

  /* 글꼴·라이브러리 등: 캐시 우선 → 없으면 받아서 저장 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')){
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => hit))
  );
});
