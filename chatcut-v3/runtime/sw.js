// ChatCut v3 mirror service worker.
//
// The frozen runtime keeps chatcut.io's own asset paths byte-identical, and
// many of them are built at runtime (assetRoot + '/poster.jpg'). Rewriting
// them statically breaks that concatenation, so instead every same-origin GET
// that 404s here is redirected to the same path on chatcut.io. Scripts, CSS,
// fonts and data are served locally and never reach the fallback.
const ORIGIN = 'https://chatcut.io';
const SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function upstreamFor(url) {
  const inScope = url.pathname.startsWith(SCOPE_PATH);
  const path = inScope ? `/${url.pathname.slice(SCOPE_PATH.length)}` : url.pathname;
  return `${ORIGIN}${path}${url.search}`;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode === 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // chatcut.io proxies PostHog under /ingest/. The mirror must never report
  // experiment exposure or analytics upstream: answer with empty flags.
  if (/\/ingest\//.test(url.pathname)) {
    event.respondWith(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    return;
  }
  event.respondWith((async () => {
    const response = await fetch(request);
    if (response.status !== 404) return response;
    return Response.redirect(upstreamFor(url), 302);
  })());
});
