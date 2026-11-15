import { ProjectFile, PwaAuditItem, PwaManifestConfig } from '../types/ide';

export function buildPreviewHtml(files: ProjectFile[], simulateOffline: boolean): string {
  const htmlFile = files.find((f) => f.path === 'index.html')?.content || '<h1>index.html mancante</h1>';
  const cssFile = files.find((f) => f.path === 'styles.css')?.content || '';
  const jsFile = files.find((f) => f.path === 'app.js')?.content || '';

  const consoleBridge = `
    <script>
      (function() {
        const origLog = console.log;
        const origErr = console.error;
        const origWarn = console.warn;
        function send(level, args) {
          try {
            window.parent.postMessage({
              source: 'codefid-preview',
              level,
              message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            }, '*');
          } catch (e) {}
        }
        console.log = function(...args) { send('info', args); origLog.apply(console, args); };
        console.warn = function(...args) { send('warn', args); origWarn.apply(console, args); };
        console.error = function(...args) { send('error', args); origErr.apply(console, args); };
        window.addEventListener('error', function(e) {
          send('error', [e.message + ' (line ' + e.lineno + ')']);
        });
      })();
    </script>
  `;

  const offlineBanner = simulateOffline
    ? `<div style="background:#f59e0b;color:#111827;font-family:sans-serif;font-size:12px;font-weight:700;padding:6px 12px;text-align:center;">
         ⚡ MODALITÀ OFFLINE SIMULATA — Risorse servite da Service Worker Cache (sw.js)
       </div>`
    : '';

  let compiled = htmlFile;

  // Replace external stylesheet link with inline style
  if (compiled.includes('href="styles.css"')) {
    compiled = compiled.replace(
      /<link[^>]*href="styles\.css"[^>]*>/i,
      `<style>\n${cssFile}\n</style>`
    );
  } else {
    compiled = compiled.replace('</head>', `<style>\n${cssFile}\n</style>\n</head>`);
  }

  // Inject console bridge and offline banner
  compiled = compiled.replace('<body>', `<body>\n${offlineBanner}\n${consoleBridge}`);

  // Replace external app.js script with inline script
  if (compiled.includes('src="app.js"')) {
    compiled = compiled.replace(
      /<script[^>]*src="app\.js"[^>]*><\/script>/i,
      `<script>\n${jsFile}\n</script>`
    );
  } else {
    compiled = compiled.replace('</body>', `<script>\n${jsFile}\n</script>\n</body>`);
  }

  return compiled;
}

export function auditPwaProject(files: ProjectFile[]): { score: number; items: PwaAuditItem[] } {
  const html = files.find((f) => f.path === 'index.html')?.content || '';
  const manifestRaw = files.find((f) => f.path === 'manifest.json')?.content || '';
  const sw = files.find((f) => f.path === 'sw.js')?.content || '';
  const js = files.find((f) => f.path === 'app.js')?.content || '';

  let parsedManifest: Record<string, any> | null = null;
  try {
    parsedManifest = JSON.parse(manifestRaw);
  } catch {
    parsedManifest = null;
  }

  const hasValidManifest = Boolean(
    parsedManifest && parsedManifest.name && parsedManifest.short_name && parsedManifest.start_url
  );
  const hasIcons = Boolean(
    parsedManifest && Array.isArray(parsedManifest.icons) && parsedManifest.icons.length >= 2
  );
  const hasStandaloneDisplay = Boolean(
    parsedManifest && ['standalone', 'fullscreen'].includes(parsedManifest.display)
  );
  const hasServiceWorkerFetch =
    sw.includes("addEventListener('fetch'") || sw.includes('addEventListener("fetch"');
  const hasServiceWorkerRegistration =
    js.includes('serviceWorker') || html.includes('serviceWorker');
  const hasViewportMeta = html.includes('name="viewport"');
  const hasThemeColor = html.includes('name="theme-color"');

  const items: PwaAuditItem[] = [
    {
      id: 'manifest-valid',
      title: 'Web App Manifest valido (manifest.json)',
      category: 'manifest',
      passed: hasValidManifest,
      detail: hasValidManifest
        ? `Configurato per "${parsedManifest?.name}" (${parsedManifest?.short_name})`
        : 'manifest.json assente o incompleto di name, short_name e start_url.',
      fixPrompt: 'Rigenera manifest.json completo e valido per PWA tablet'
    },
    {
      id: 'manifest-icons',
      title: 'Set Icone 192x192 & 512x512 Maskable',
      category: 'manifest',
      passed: hasIcons,
      detail: hasIcons
        ? `${parsedManifest?.icons.length} icone dichiarate nel manifest.`
        : 'Servono almeno due icone (192x192 e 512x512) per installazione iOS/Android.',
      fixPrompt: 'Aggiungi le icone 192x192 e 512x512 maskable in manifest.json'
    },
    {
      id: 'display-mode',
      title: 'Display Mode Standalone / Fullscreen per Tablet',
      category: 'responsive',
      passed: hasStandaloneDisplay,
      detail: hasStandaloneDisplay
        ? `Display impostato su "${parsedManifest?.display}".`
        : 'Imposta display su "standalone" o "fullscreen" per esperienza nativa su tablet.',
      fixPrompt: 'Imposta display standalone in manifest.json'
    },
    {
      id: 'sw-fetch',
      title: 'Service Worker con strategia di Caching Offline (sw.js)',
      category: 'service-worker',
      passed: hasServiceWorkerFetch,
      detail: hasServiceWorkerFetch
        ? 'Listener fetch attivo in sw.js con supporto cache offline.'
        : 'sw.js non intercetta gli eventi fetch per il funzionamento offline.',
      fixPrompt: 'Implementa un Service Worker completo con caching offline in sw.js'
    },
    {
      id: 'sw-register',
      title: 'Registrazione Service Worker in app.js / index.html',
      category: 'offline',
      passed: hasServiceWorkerRegistration,
      detail: hasServiceWorkerRegistration
        ? 'navigator.serviceWorker.register rilevato nel codice.'
        : 'Aggiungi navigator.serviceWorker.register("sw.js") in app.js.',
      fixPrompt: 'Registra il service worker sw.js dentro app.js'
    },
    {
      id: 'viewport-meta',
      title: 'Meta Viewport Touch-First & Theme Color',
      category: 'responsive',
      passed: hasViewportMeta && hasThemeColor,
      detail:
        hasViewportMeta && hasThemeColor
          ? 'Meta tag viewport e theme-color presenti in index.html.'
          : 'Mancano i meta tag viewport o theme-color in index.html.',
      fixPrompt: 'Aggiungi meta viewport e theme-color ottimizzati per iPad e Android in index.html'
    }
  ];

  const passedCount = items.filter((i) => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);

  return { score, items };
}

export function generateManifestJson(config: PwaManifestConfig): string {
  return JSON.stringify(
    {
      name: config.name,
      short_name: config.short_name,
      description: config.description,
      start_url: config.start_url,
      display: config.display,
      orientation: config.orientation,
      background_color: config.background_color,
      theme_color: config.theme_color,
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    null,
    2
  );
}

export function generateServiceWorkerJs(config: PwaManifestConfig): string {
  return `// Auto-generated by CodeFID PWA Studio (${config.cacheStrategy})
const CACHE_NAME = '${config.short_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  ${
    config.cacheStrategy === 'CacheFirst'
      ? `event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );`
      : config.cacheStrategy === 'NetworkFirst'
      ? `event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );`
      : `event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );`
  }
});
`;
}
