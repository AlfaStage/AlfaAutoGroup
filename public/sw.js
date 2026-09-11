/**
 * Service worker do AlfaAltoGrup.
 *
 * A versao anterior tentava cachear '/' e '/login' na instalacao. Como '/'
 * responde com redirecionamento, o addAll rejeitava e a instalacao falhava —
 * era a origem do erro de registro no console.
 *
 * Tres estrategias, conforme o tipo de pedido:
 *  - assets do Next (/_next/static): cache primeiro, porque tem hash no nome
 *    e o conteudo nunca muda;
 *  - navegacao: rede primeiro, caindo no cache sem conexao e, por ultimo,
 *    numa pagina de aviso;
 *  - /api, /l e /g: nunca passam pelo cache — sao dados vivos e redirecoes.
 */

const VERSAO = 'alfaaltogrup-v2';
const CACHE_ESTATICO = VERSAO + '-static';
const CACHE_PAGINAS = VERSAO + '-paginas';

const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {
        /* sem a pagina de aviso o worker ainda serve para o resto */
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves.filter((k) => k.indexOf(VERSAO) !== 0).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function ehAssetComHash(url) {
  return url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/');
}

function naoDeveCachear(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/l/') ||
    url.pathname.startsWith('/g/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (naoDeveCachear(url)) return;

  // Assets com hash no nome: cache primeiro.
  if (ehAssetComHash(url)) {
    event.respondWith(
      caches.match(req).then((cacheado) => {
        if (cacheado) return cacheado;
        return fetch(req).then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Navegacao: rede primeiro, para o painel nunca mostrar dado velho.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(CACHE_PAGINAS).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cacheado) => cacheado || caches.match(OFFLINE_URL))
        )
    );
  }
});
