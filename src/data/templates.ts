import { PwaProject } from '../types/ide';

export const STARTER_PROJECTS: PwaProject[] = [
  {
    id: 'taskflow-pwa',
    name: 'TaskFlow Tablet PWA',
    description: 'Kanban & Note Offline-First con Service Worker, statistiche real-time e sincronizzazione cloud.',
    updatedAt: new Date().toISOString(),
    manifestConfig: {
      name: 'TaskFlow Tablet Workspace',
      short_name: 'TaskFlow',
      description: 'Offline-first tablet task & sprint manager PWA',
      theme_color: '#6366f1',
      background_color: '#0f172a',
      display: 'standalone',
      orientation: 'any',
      start_url: '/index.html',
      cacheStrategy: 'StaleWhileRevalidate',
      offlineFallback: true
    },
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#6366f1" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <link rel="manifest" href="manifest.json" />
  <link rel="stylesheet" href="styles.css" />
  <title>TaskFlow Tablet PWA</title>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo-dot"></span>
        <div>
          <h1>TaskFlow PWA</h1>
          <p class="subtitle">Offline-First Tablet Sprint Board</p>
        </div>
      </div>
      <div class="actions">
        <span id="network-badge" class="badge online">● Online Ready</span>
        <button id="install-btn" class="btn-secondary">+ Installa PWA</button>
        <button id="add-task-btn" class="btn-primary">+ Nuovo Task</button>
      </div>
    </header>

    <section class="stats-row">
      <div class="stat-card">
        <span class="stat-label">Totale Task</span>
        <strong id="stat-total" class="stat-value">0</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">In Corso</span>
        <strong id="stat-progress" class="stat-value accent">0</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Completati</span>
        <strong id="stat-done" class="stat-value success">0</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Storage Offline</span>
        <strong class="stat-value">IndexedDB / Local</strong>
      </div>
    </section>

    <main class="board" id="kanban-board">
      <div class="column" data-col="todo">
        <div class="col-header">
          <h2>Da Fare</h2>
          <span class="count" id="count-todo">0</span>
        </div>
        <div class="task-list" id="list-todo"></div>
      </div>

      <div class="column" data-col="doing">
        <div class="col-header">
          <h2>In Sviluppo</h2>
          <span class="count" id="count-doing">0</span>
        </div>
        <div class="task-list" id="list-doing"></div>
      </div>

      <div class="column" data-col="done">
        <div class="col-header">
          <h2>Completati</h2>
          <span class="count" id="count-done">0</span>
        </div>
        <div class="task-list" id="list-done"></div>
      </div>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>`
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `:root {
  --bg: #0f172a;
  --panel: #1e293b;
  --panel-border: rgba(255, 255, 255, 0.08);
  --accent: #6366f1;
  --accent-glow: rgba(99, 102, 241, 0.25);
  --text: #f8fafc;
  --muted: #94a3b8;
  --success: #10b981;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background: radial-gradient(circle at top right, #1e1b4b, #0f172a 60%);
  color: var(--text);
  min-height: 100vh;
  padding: 20px;
}

.app-shell {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(30, 41, 59, 0.78);
  backdrop-filter: blur(12px);
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid var(--panel-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 14px var(--accent);
}

.brand h1 {
  font-size: 1.2rem;
  font-weight: 700;
}

.subtitle {
  font-size: 0.78rem;
  color: var(--muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 0.75rem;
  padding: 6px 12px;
  border-radius: 999px;
  font-weight: 600;
}

.badge.online {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.btn-primary, .btn-secondary {
  border: none;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 4px 16px var(--accent-glow);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
  border: 1px solid var(--panel-border);
}

.btn-primary:active, .btn-secondary:active {
  transform: scale(0.96);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.stat-value {
  font-size: 1.35rem;
}

.stat-value.accent { color: #818cf8; }
.stat-value.success { color: #34d399; }

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.column {
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  padding: 14px;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--panel-border);
}

.col-header h2 {
  font-size: 0.92rem;
  color: #e2e8f0;
}

.count {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  padding: 2px 9px;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 700;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}

.task-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.task-tag {
  align-self: flex-start;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.2);
  color: #c7d2fe;
}

.task-title {
  font-size: 0.9rem;
  font-weight: 600;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--muted);
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .board { grid-template-columns: 1fr; }
}`
      },
      {
        path: 'app.js',
        language: 'javascript',
        content: `// TaskFlow Tablet PWA Logic
const initialTasks = [
  { id: '1', title: 'Configurare Service Worker Offline', tag: 'PWA Core', status: 'done' },
  { id: '2', title: 'Integrare Claude & Antigravity Agent', tag: 'AI Agent', status: 'doing' },
  { id: '3', title: 'Sincronizzare Firestore Cloud DB', tag: 'Firebase', status: 'doing' },
  { id: '4', title: 'Ottimizzare Gesture Touch su iPad Pro', tag: 'Tablet UI', status: 'todo' },
  { id: '5', title: 'Deploy automatico su GitHub Pages', tag: 'GitHub CI', status: 'todo' }
];

let tasks = JSON.parse(localStorage.getItem('taskflow_tasks') || 'null') || initialTasks;

function saveTasks() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

function cycleStatus(id) {
  const order = ['todo', 'doing', 'done'];
  tasks = tasks.map(t => {
    if (t.id !== id) return t;
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    return { ...t, status: next };
  });
  saveTasks();
  renderBoard();
}

function renderBoard() {
  const cols = { todo: [], doing: [], done: [] };
  tasks.forEach(t => cols[t.status]?.push(t));

  ['todo', 'doing', 'done'].forEach(col => {
    const container = document.getElementById('list-' + col);
    const countEl = document.getElementById('count-' + col);
    if (!container || !countEl) return;
    countEl.textContent = String(cols[col].length);
    container.innerHTML = cols[col]
      .map(
        t => \`
        <div class="task-card" onclick="cycleStatus('\${t.id}')">
          <span class="task-tag">\${t.tag}</span>
          <div class="task-title">\${t.title}</div>
          <div class="task-footer">
            <span>Tocca per spostare →</span>
            <span>#\${t.id}</span>
          </div>
        </div>
      \`
      )
      .join('');
  });

  document.getElementById('stat-total').textContent = String(tasks.length);
  document.getElementById('stat-progress').textContent = String(cols.doing.length);
  document.getElementById('stat-done').textContent = String(cols.done.length);
}

document.getElementById('add-task-btn')?.addEventListener('click', () => {
  const title = prompt('Titolo del nuovo task PWA:', 'Nuova feature touch tablet');
  if (!title) return;
  tasks.unshift({
    id: String(Date.now()).slice(-4),
    title,
    tag: 'AI Generated',
    status: 'todo'
  });
  saveTasks();
  renderBoard();
});

document.getElementById('install-btn')?.addEventListener('click', () => {
  alert('PWA pronta per installazione su Home Screen Tablet (manifest.json + sw.js attivi)!');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

renderBoard();
console.log('[TaskFlow PWA] App avviata con', tasks.length, 'task.');`
      },
      {
        path: 'manifest.json',
        language: 'json',
        content: `{
  "name": "TaskFlow Tablet Workspace",
  "short_name": "TaskFlow",
  "description": "Offline-first tablet task & sprint manager PWA",
  "start_url": "/index.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}`
      },
      {
        path: 'sw.js',
        language: 'javascript',
        content: `const CACHE_NAME = 'taskflow-pwa-v1';
const OFFLINE_ASSETS = ['/index.html', '/styles.css', '/app.js', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});`
      }
    ]
  },
  {
    id: 'pulsefit-pwa',
    name: 'PulseFit Biometrics Tablet PWA',
    description: 'Dashboard fitness e telemetria per tablet con grafici SVG live, timer HIIT touch e supporto offline.',
    updatedAt: new Date().toISOString(),
    manifestConfig: {
      name: 'PulseFit Tablet Coach',
      short_name: 'PulseFit',
      description: 'Biometric & HIIT Workout Tablet PWA',
      theme_color: '#10b981',
      background_color: '#061311',
      display: 'standalone',
      orientation: 'landscape',
      start_url: '/index.html',
      cacheStrategy: 'CacheFirst',
      offlineFallback: true
    },
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#10b981" />
  <link rel="manifest" href="manifest.json" />
  <link rel="stylesheet" href="styles.css" />
  <title>PulseFit Tablet Coach</title>
</head>
<body>
  <div class="dashboard">
    <header class="header">
      <div>
        <h1>PulseFit Studio PWA</h1>
        <p>Telemetria Biometrica & HIIT Tablet Console</p>
      </div>
      <button id="toggle-workout" class="cta">▶ Avvia Sessione Live</button>
    </header>
    <div class="metrics">
      <div class="card">
        <span>Frequenza Cardiaca</span>
        <strong id="bpm-val">128 BPM</strong>
        <small>Zona Aerobica Ottimale</small>
      </div>
      <div class="card">
        <span>Calorie Attive</span>
        <strong id="kcal-val">412 kcal</strong>
        <small>+18% rispetto a ieri</small>
      </div>
      <div class="card">
        <span>Timer HIIT</span>
        <strong id="timer-val">00:45</strong>
        <small>Round 4 / 8</small>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>`
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `body {
  background: #061311;
  color: #ecfdf5;
  font-family: system-ui, sans-serif;
  padding: 24px;
}
.dashboard { max-width: 960px; margin: 0 auto; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 18px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 16px;
}
.cta {
  background: #10b981;
  color: #042f2e;
  border: none;
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card strong { font-size: 2rem; color: #34d399; }
.card small { color: #6ee7b7; }`
      },
      {
        path: 'app.js',
        language: 'javascript',
        content: `let running = false;
let sec = 45;
const btn = document.getElementById('toggle-workout');
btn?.addEventListener('click', () => {
  running = !running;
  btn.textContent = running ? '⏸ Pausa Sessione' : '▶ Avvia Sessione Live';
});
setInterval(() => {
  if (!running) return;
  sec = sec > 0 ? sec - 1 : 45;
  const bpm = 125 + Math.floor(Math.random() * 18);
  document.getElementById('bpm-val').textContent = bpm + ' BPM';
  document.getElementById('timer-val').textContent = '00:' + String(sec).padStart(2, '0');
}, 1000);`
      },
      {
        path: 'manifest.json',
        language: 'json',
        content: `{
  "name": "PulseFit Tablet Coach",
  "short_name": "PulseFit",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#061311",
  "theme_color": "#10b981",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`
      },
      {
        path: 'sw.js',
        language: 'javascript',
        content: `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));`
      }
    ]
  },
  {
    id: 'orderpad-pos-pwa',
    name: 'OrderPad POS Tablet PWA',
    description: 'Cassa touch per ristorazione e retail con carrello istantaneo, ricevute offline e sync Firebase.',
    updatedAt: new Date().toISOString(),
    manifestConfig: {
      name: 'OrderPad Tablet POS',
      short_name: 'OrderPad',
      description: 'Touch Point-of-Sale PWA for iPad & Android Tablets',
      theme_color: '#f59e0b',
      background_color: '#18181b',
      display: 'fullscreen',
      orientation: 'landscape',
      start_url: '/index.html',
      cacheStrategy: 'NetworkFirst',
      offlineFallback: true
    },
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#f59e0b" />
  <link rel="manifest" href="manifest.json" />
  <link rel="stylesheet" href="styles.css" />
  <title>OrderPad Tablet POS</title>
</head>
<body>
  <div class="pos-grid">
    <section class="catalog">
      <h2>Menu Touch Rapido</h2>
      <div class="products" id="products-grid"></div>
    </section>
    <aside class="cart">
      <h2>Conto Tavolo #12</h2>
      <div id="cart-items" class="cart-items"></div>
      <div class="cart-total">
        <span>Totale</span>
        <strong id="cart-total-val">€0.00</strong>
      </div>
      <button id="checkout-btn" class="pay-btn">Invia Ordine (Offline-Safe)</button>
    </aside>
  </div>
  <script src="app.js"></script>
</body>
</html>`
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `body { background: #18181b; color: #fafafa; font-family: system-ui, sans-serif; padding: 18px; }
.pos-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; }
.products { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
.prod-btn {
  background: #27272a;
  border: 1px solid #3f3f46;
  color: white;
  padding: 18px;
  border-radius: 14px;
  text-align: left;
  cursor: pointer;
}
.prod-btn strong { display: block; font-size: 1rem; margin-bottom: 4px; }
.prod-btn span { color: #fbbf24; font-weight: 700; }
.cart {
  background: #27272a;
  padding: 18px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cart-items { flex: 1; min-height: 220px; display: flex; flex-direction: column; gap: 8px; }
.cart-row { display: flex; justify-content: space-between; font-size: 0.9rem; border-bottom: 1px solid #3f3f46; padding-bottom: 6px; }
.cart-total { display: flex; justify-content: space-between; font-size: 1.25rem; padding-top: 8px; }
.pay-btn { background: #f59e0b; color: #18181b; border: none; padding: 14px; border-radius: 12px; font-weight: 800; cursor: pointer; }`
      },
      {
        path: 'app.js',
        language: 'javascript',
        content: `const catalog = [
  { name: 'Espresso Specialty', price: 2.5 },
  { name: 'Cappuccino Avena', price: 3.8 },
  { name: 'Croissant Artigianale', price: 2.8 },
  { name: 'Club Sandwich Tablet', price: 9.5 },
  { name: 'Smoothie Mango & Matcha', price: 6.0 },
  { name: 'Cheesecake Basca', price: 5.5 }
];
const cart = [];
const grid = document.getElementById('products-grid');
grid.innerHTML = catalog.map((p, i) => \`
  <button class="prod-btn" onclick="addItem(\${i})">
    <strong>\${p.name}</strong>
    <span>€\${p.price.toFixed(2)}</span>
  </button>
\`).join('');

window.addItem = (idx) => {
  cart.push(catalog[idx]);
  renderCart();
};

function renderCart() {
  const el = document.getElementById('cart-items');
  el.innerHTML = cart.map(c => \`<div class="cart-row"><span>\${c.name}</span><span>€\${c.price.toFixed(2)}</span></div>\`).join('');
  const sum = cart.reduce((acc, c) => acc + c.price, 0);
  document.getElementById('cart-total-val').textContent = '€' + sum.toFixed(2);
}

document.getElementById('checkout-btn').addEventListener('click', () => {
  if (!cart.length) return alert('Seleziona almeno un prodotto!');
  alert('Ordine salvato in coda locale e sincronizzato con Firebase!');
  cart.length = 0;
  renderCart();
});`
      },
      {
        path: 'manifest.json',
        language: 'json',
        content: `{
  "name": "OrderPad Tablet POS",
  "short_name": "OrderPad",
  "start_url": "/index.html",
  "display": "fullscreen",
  "background_color": "#18181b",
  "theme_color": "#f59e0b",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`
      },
      {
        path: 'sw.js',
        language: 'javascript',
        content: `self.addEventListener('install', () => self.skipWaiting());`
      }
    ]
  }
];
