# CodeFID — Tablet AI PWA Studio (Claude + Antigravity + GitHub + Firebase)

**CodeFID** è un IDE touch-first installabile come PWA su **iPadOS e tablet Android**, progettato per programmare **Progressive Web App (PWA)** con il supporto combinato degli agenti **Claude** e **Google Antigravity**, e con integrazione diretta verso **GitHub** e **Firebase**.

## Funzionalità Principali

1. **Workspace Touch-First per Tablet (4 Modalità Layout)**:
   - **Studio 3-Vie**: AI Agent Studio + Touch Code Editor + Simulatore Tablet Live.
   - **Codice + PWA**: Editor a schermo diviso con anteprima istantanea.
   - **Agent + PWA**: Programmazione conversazionale con anteprima real-time.
   - **Simulatore**: Test full-screen con cornici **iPad Pro**, **Galaxy Tab**, **Mobile** e rotazione Portrait/Landscape.
   - **Touch Keys Bar**: Barra rapida sopra l'editor con i simboli di programmazione (`Tab`, `{`, `}`, `(`, `)`, `[`, `]`, `=>`, `</>`, `;`, `async`, `await`, `const`) pensata per tastiere touch.

2. **Multi-Agent Studio (Antigravity, Claude & Swarm)**:
   - **Antigravity Agent**: Architettura PWA, generazione `manifest.json`, Service Worker offline (`sw.js`), configurazione Firebase e GitHub Actions. Supporta **Gemini API Key** e **Antigravity CLI Bridge (`agy`)**.
   - **Claude Code Agent**: Creazione e refactoring di UI touch, CSS avanzato e logica JavaScript. Supporta **Anthropic API Key** diretta dal browser (`claude-3-7-sonnet-latest`).
   - **Dual-Agent Swarm**: Coordina Antigravity + Claude in parallelo con log dettagliato delle tool-call (`write_file`, `edit_file`, `audit_pwa`) e ripristino snapshot in 1 tap.

3. **PWA Studio & Audit Live**:
   - Configuratore visuale per `manifest.json` e strategie di caching del Service Worker (`StaleWhileRevalidate`, `CacheFirst`, `NetworkFirst`).
   - **Checklist di Conformità PWA (Score 0–100%)** con pulsante **Ripara AI** per correggere automaticamente icone, manifest o Service Worker.
   - Simulatore **Modalità Offline** e **Test Installazione Home Screen** integrati.

4. **Integrazione GitHub (REST API v3) & Firebase (Firestore + Hosting)**:
   - **GitHub**: Connessione tramite Personal Access Token, esplorazione e creazione repository, **Pull / Clone** dei file nel tablet, **Commit & Push** multi-file su branch e generatore `.github/workflows/deploy-pwa.yml` per GitHub Pages.
   - **Firebase**: Salvataggio e caricamento cloud dell'intero progetto PWA su **Cloud Firestore** e iniezione automatica di `firebase.json`, `.firebaserc` e `firebaseConfig.js`.

## Avvio Rapido

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo Vite (accessibile anche da tablet sulla rete locale)
npm run dev

# (Opzionale) Avvia il Bridge CLI locale su porta 8787 per connettere `agy`, `claude` e `git` CLI
npm run bridge
```
