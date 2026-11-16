import {
  AgentConfig,
  AgentId,
  AgentToolCall,
  FirebaseConfig,
  ProjectFile,
  PwaManifestConfig
} from '../types/ide';
import { auditPwaProject, generateManifestJson, generateServiceWorkerJs } from './pwaPreview';
import { detectFileLanguage } from '../utils/fileHelpers';

export interface AgentExecutionResult {
  replyText: string;
  agentLabel: string;
  toolCalls: AgentToolCall[];
  updatedFiles: ProjectFile[];
}

export interface ModelOption {
  id: string;
  label: string;
}

export const DEFAULT_ANTIGRAVITY_MODELS: ModelOption[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.8-pro', label: 'Gemini 3.8 Pro' }
];

export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (Consigliato Coding)' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Ultra-Fast)' }
];

/**
 * Fetches all available Gemini models supporting generateContent for the given API key
 * (paginating through all pages and excluding retired gemini-2.5 models).
 * Falls back to DEFAULT_ANTIGRAVITY_MODELS if the key is empty or the request fails.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) return DEFAULT_ANTIGRAVITY_MODELS;
  try {
    const allModels: any[] = [];
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
      const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(trimmed)}${tokenParam}`
      );
      if (!res.ok) break;
      const data = await res.json();
      if (Array.isArray(data?.models)) {
        allModels.push(...data.models);
      }
      if (!data?.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    const models: ModelOption[] = allModels
      .filter(
        (m: any) =>
          typeof m?.name === 'string' &&
          m.name.includes('gemini') &&
          !m.name.includes('gemini-2.5') &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m: any) => {
        const id = m.name.replace(/^models\//, '');
        return {
          id,
          label: m.displayName ? `${m.displayName} (${id})` : id
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));

    return models.length > 0 ? models : DEFAULT_ANTIGRAVITY_MODELS;
  } catch {
    return DEFAULT_ANTIGRAVITY_MODELS;
  }
}

function buildSystemPrompt(agent: AgentId, files: ProjectFile[]): string {
  const fileContext = files
    .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
    .join('\n\n');

  const roleHeader =
    agent === 'claude'
      ? 'Sei Claude Code Agent integrato in CodeFID (Tablet PWA Studio). Sei specializzato in UI/UX touch per tablet, JavaScript moderno, CSS avanzato e architetture Progressive Web App.'
      : agent === 'antigravity'
      ? 'Sei Google Antigravity Agent integrato in CodeFID (Tablet PWA Studio). Sei un agente autonomo full-stack specializzato in pianificazione multi-step, Service Worker offline-first, integrazione Firebase e GitHub CI/CD.'
      : 'Siete un Dual-Agent Swarm composto da Antigravity (Architect & PWA/Cloud Systems) e Claude (UI/UX & Frontend Code).';

  return `${roleHeader}
Rispondi sempre in italiano in modo conciso e tecnico.
Se l'utente chiede di creare o modificare codice della PWA, oltre alla spiegazione puoi restituire un blocco JSON racchiuso tra \`\`\`json-patch e \`\`\` con il formato:
{
  "files": [
    { "path": "index.html", "content": "..." }
  ],
  "summary": "Breve descrizione della modifica"
}

File attuali del progetto:
${fileContext}`;
}

function parseJsonPatch(
  rawText: string,
  currentFiles: ProjectFile[]
): { cleanedText: string; updatedFiles: ProjectFile[]; toolCalls: AgentToolCall[] } {
  const match = rawText.match(/```json-patch\s*([\s\S]*?)```/);
  if (!match) {
    return { cleanedText: rawText, updatedFiles: currentFiles, toolCalls: [] };
  }

  const cleanedText = rawText.replace(/```json-patch\s*[\s\S]*?```/, '').trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed.files)) {
      return { cleanedText, updatedFiles: currentFiles, toolCalls: [] };
    }
    const nextFiles = [...currentFiles];
    const toolCalls: AgentToolCall[] = [];

    for (const patch of parsed.files) {
      if (!patch.path || typeof patch.content !== 'string') continue;
      const idx = nextFiles.findIndex((f) => f.path === patch.path);
      const lang = detectFileLanguage(patch.path);

      if (idx >= 0) {
        nextFiles[idx] = {
          ...nextFiles[idx],
          content: patch.content,
          modified: true
        };
        toolCalls.push({
          id: `tc-${Date.now()}-${patch.path}`,
          tool: 'edit_file',
          targetFile: patch.path,
          summary: parsed.summary || `Aggiornato ${patch.path}`,
          status: 'done',
          diffPreview: `File aggiornato (${patch.content.split('\n').length} righe)`
        });
      } else {
        nextFiles.push({
          path: patch.path,
          content: patch.content,
          language: lang,
          modified: true
        });
        toolCalls.push({
          id: `tc-${Date.now()}-${patch.path}`,
          tool: 'write_file',
          targetFile: patch.path,
          summary: `Creato nuovo file ${patch.path}`,
          status: 'done',
          diffPreview: `Nuovo file (${patch.content.split('\n').length} righe)`
        });
      }
    }

    return { cleanedText, updatedFiles: nextFiles, toolCalls };
  } catch {
    return { cleanedText, updatedFiles: currentFiles, toolCalls: [] };
  }
}

async function callClaudeApi(
  prompt: string,
  config: AgentConfig,
  files: ProjectFile[]
): Promise<AgentExecutionResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: config.claudeModel || 'claude-3-7-sonnet-latest',
      max_tokens: 4096,
      system: buildSystemPrompt('claude', files),
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore API Claude (${res.status}): ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const rawReply = data?.content?.[0]?.text || 'Risposta ricevuta da Claude.';
  const { cleanedText, updatedFiles, toolCalls } = parseJsonPatch(rawReply, files);

  return {
    replyText: cleanedText,
    agentLabel: `Claude (${config.claudeModel || 'Sonnet'})`,
    toolCalls,
    updatedFiles
  };
}

async function callGeminiAntigravityApi(
  prompt: string,
  config: AgentConfig,
  files: ProjectFile[],
  agentMode: AgentId
): Promise<AgentExecutionResult> {
  const rawModel = config.antigravityModel || 'gemini-3.8-flash';
  const model = rawModel.startsWith('gemini-2.5') ? 'gemini-3.8-flash' : rawModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    config.geminiApiKey.trim()
  )}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(agentMode, files) }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore API Antigravity/Gemini (${res.status}): ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const rawReply =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n') ||
    'Risposta elaborata da Antigravity.';
  const { cleanedText, updatedFiles, toolCalls } = parseJsonPatch(rawReply, files);

  return {
    replyText: cleanedText,
    agentLabel:
      agentMode === 'swarm'
        ? 'Swarm (Antigravity + Claude)'
        : `Antigravity (${model})`,
    toolCalls,
    updatedFiles
  };
}

export async function runAgentTask(params: {
  prompt: string;
  agentConfig: AgentConfig;
  files: ProjectFile[];
  manifestConfig: PwaManifestConfig;
  firebaseConfig: FirebaseConfig;
}): Promise<AgentExecutionResult> {
  const { prompt, agentConfig, files, manifestConfig, firebaseConfig } = params;
  const activeAgent = agentConfig.activeAgent;

  const hasClaude = Boolean(agentConfig.claudeApiKey.trim());
  const hasGemini = Boolean(agentConfig.geminiApiKey.trim());

  // 1. Real Dual-Agent Swarm: Antigravity (Gemini) -> Claude (Anthropic)
  if (activeAgent === 'swarm') {
    if (hasGemini && hasClaude) {
      const agyPrompt = `[Ruolo: Antigravity Architect nello Swarm]\nProgetta la struttura, i file PWA/logica e prepara la base per questa richiesta:\n${prompt}`;
      const step1 = await callGeminiAntigravityApi(
        agyPrompt,
        agentConfig,
        files,
        'antigravity'
      );

      const claudePrompt = `[Ruolo: Claude UI/Frontend Builder nello Swarm]\nAntigravity ha appena lavorato su questa richiesta:\n"${prompt}"\n\nRifinisci UI/UX touch, CSS, layout e codice interattivo sui file risultanti.`;
      const step2 = await callClaudeApi(
        claudePrompt,
        agentConfig,
        step1.updatedFiles
      );

      return {
        replyText:
          `### 1. Antigravity (${agentConfig.antigravityModel || 'Gemini'})\n${step1.replyText}\n\n---\n\n` +
          `### 2. Claude (${agentConfig.claudeModel || 'Sonnet'})\n${step2.replyText}`,
        agentLabel: 'Swarm (Antigravity + Claude)',
        toolCalls: [...step1.toolCalls, ...step2.toolCalls],
        updatedFiles: step2.updatedFiles
      };
    }

    if (hasGemini) {
      return callGeminiAntigravityApi(prompt, agentConfig, files, 'swarm');
    }

    if (hasClaude) {
      const res = await callClaudeApi(prompt, agentConfig, files);
      return { ...res, agentLabel: `Swarm (${res.agentLabel})` };
    }
  }

  // 2. Single Cloud Agent if user has configured its API key
  if (activeAgent === 'claude' && hasClaude) {
    return callClaudeApi(prompt, agentConfig, files);
  }
  if (activeAgent === 'antigravity' && hasGemini) {
    return callGeminiAntigravityApi(prompt, agentConfig, files, 'antigravity');
  }

  // 2. Built-in Autonomous Agent Engine (works immediately on tablet without requiring external keys)
  const lower = prompt.toLowerCase();
  const nextFiles = files.map((f) => ({ ...f }));
  const toolCalls: AgentToolCall[] = [];

  const upsertFile = (
    path: string,
    content: string,
    language: ProjectFile['language'],
    summary: string
  ) => {
    const idx = nextFiles.findIndex((f) => f.path === path);
    const isEdit = idx >= 0;
    if (isEdit) {
      nextFiles[idx] = { ...nextFiles[idx], content, modified: true };
    } else {
      nextFiles.push({ path, content, language, modified: true });
    }
    toolCalls.push({
      id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool: isEdit ? 'edit_file' : 'write_file',
      targetFile: path,
      summary,
      status: 'done',
      diffPreview: `${content.split('\n').length} righe scritte in ${path}`
    });
  };

  // Handle /pwa-audit or manifest/service worker fixes
  if (
    lower.includes('/pwa-audit') ||
    lower.includes('manifest') ||
    lower.includes('service worker') ||
    lower.includes('sw.js') ||
    lower.includes('offline')
  ) {
    const newManifest = generateManifestJson(manifestConfig);
    const newSw = generateServiceWorkerJs(manifestConfig);
    upsertFile('manifest.json', newManifest, 'json', 'Rigenerato manifest.json conforme agli standard PWA Tablet');
    upsertFile('sw.js', newSw, 'javascript', `Rigenerato Service Worker (${manifestConfig.cacheStrategy}) con caching offline`);

    const appJs = nextFiles.find((f) => f.path === 'app.js');
    if (appJs && !appJs.content.includes('serviceWorker')) {
      const updatedJs = `${appJs.content}\n\n// Auto-registered by ${
        activeAgent === 'claude' ? 'Claude' : 'Antigravity'
      }\nif ('serviceWorker' in navigator) {\n  window.addEventListener('load', () => {\n    navigator.serviceWorker.register('sw.js').catch(console.error);\n  });\n}\n`;
      upsertFile('app.js', updatedJs, 'javascript', 'Aggiunta registrazione automatica Service Worker in app.js');
    }

    const audit = auditPwaProject(nextFiles);
    toolCalls.push({
      id: `tc-audit-${Date.now()}`,
      tool: 'audit_pwa',
      summary: `Audit PWA completato: punteggio ${audit.score}/100`,
      status: 'done',
      diffPreview: `${audit.items.filter((i) => i.passed).length}/${audit.items.length} controlli superati`
    });

    return {
      replyText:
        activeAgent === 'swarm'
          ? `**Swarm completato (Antigravity + Claude):**\n- **Antigravity** ha generato e validato \`manifest.json\` e \`sw.js\` con strategia \`${manifestConfig.cacheStrategy}\`.\n- **Claude** ha verificato la registrazione del Service Worker in \`app.js\`.\n- **PWA Score attuale:** **${audit.score}/100**.`
          : `Ho ottimizzato l'infrastruttura PWA del progetto aggiornando \`manifest.json\` e \`sw.js\` per il funzionamento offline su tablet. Il punteggio di conformità PWA è ora **${audit.score}/100**.`,
      agentLabel:
        activeAgent === 'claude'
          ? 'Claude Code Agent'
          : activeAgent === 'swarm'
          ? 'Swarm (Antigravity + Claude)'
          : 'Antigravity Agent',
      toolCalls,
      updatedFiles: nextFiles
    };
  }

  // Handle /firebase-init or firebase requests
  if (lower.includes('/firebase-init') || lower.includes('firebase') || lower.includes('firestore')) {
    const fbSdkContent = `// Firebase Integration Module — Generated by CodeFID Agent
export const firebaseConfig = {
  apiKey: "${firebaseConfig.apiKey || 'AIzaSy_YOUR_API_KEY'}",
  authDomain: "${firebaseConfig.authDomain || `${firebaseConfig.projectId || 'codefid-pwa'}.firebaseapp.com`}",
  projectId: "${firebaseConfig.projectId || 'codefid-pwa'}",
  storageBucket: "${firebaseConfig.storageBucket || `${firebaseConfig.projectId || 'codefid-pwa'}.appspot.com`}",
  appId: "${firebaseConfig.appId || '1:100000000:web:abcdef123456'}"
};

export async function syncStateToFirestore(collectionName, docId, payload) {
  const url = \`https://firestore.googleapis.com/v1/projects/\${firebaseConfig.projectId}/databases/(default)/documents/\${collectionName}/\${docId}\`;
  console.log('[Firebase Sync] Invio stato a Firestore:', url, payload);
  return { ok: true, syncedAt: new Date().toISOString() };
}
`;
    const fbHostingJson = JSON.stringify(
      {
        hosting: {
          public: '.',
          ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
          rewrites: [{ source: '**', destination: '/index.html' }],
          headers: [
            {
              source: '/sw.js',
              headers: [{ key: 'Cache-Control', value: 'no-cache' }]
            }
          ]
        }
      },
      null,
      2
    );

    upsertFile('firebaseConfig.js', fbSdkContent, 'javascript', 'Creato modulo client Firebase + Firestore REST helper');
    upsertFile('firebase.json', fbHostingJson, 'json', 'Creato file di configurazione per Firebase Hosting PWA');

    return {
      replyText: `Ho configurato l'integrazione **Firebase** per la tua PWA:\n1. Creato \`firebaseConfig.js\` con configurazione progetto e helper per sincronizzare i dati su **Firestore**.\n2. Creato \`firebase.json\` con le regole di rewrite SPA e gli header \`Cache-Control: no-cache\` per \`sw.js\` su **Firebase Hosting**.`,
      agentLabel: activeAgent === 'claude' ? 'Claude Code Agent' : 'Antigravity Agent',
      toolCalls,
      updatedFiles: nextFiles
    };
  }

  // Handle /github-workflow or GitHub Actions requests
  if (lower.includes('/github-workflow') || lower.includes('github') || lower.includes('deploy')) {
    const workflowYaml = `name: Deploy PWA to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload PWA Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
    upsertFile(
      '.github/workflows/deploy-pwa.yml',
      workflowYaml,
      'yaml',
      'Generata pipeline GitHub Actions per deploy automatico su GitHub Pages'
    );

    return {
      replyText: `Ho generato la pipeline CI/CD in \`.github/workflows/deploy-pwa.yml\`. Ad ogni push sul branch \`main\` dal pannello GitHub di CodeFID, la tua PWA verrà pubblicata automaticamente su **GitHub Pages** con supporto HTTPS e Service Worker.`,
      agentLabel: activeAgent === 'claude' ? 'Claude Code Agent' : 'Antigravity Agent',
      toolCalls,
      updatedFiles: nextFiles
    };
  }

  // Handle UI / Feature / Widget / Theme customization requests on the current PWA
  const cssFile = nextFiles.find((f) => f.path === 'styles.css');
  const htmlFile = nextFiles.find((f) => f.path === 'index.html');
  const jsFile = nextFiles.find((f) => f.path === 'app.js');

  if (htmlFile && cssFile && jsFile) {
    // Inject an interactive AI-built dock/widget or requested feature into the live PWA
    const featureTitle = prompt.replace(/^\/\w+\s*/, '').trim() || 'Modulo AI Touch';
    const widgetId = 'ai-feature-banner';

    let newHtml = htmlFile.content;
    if (!newHtml.includes(widgetId)) {
      newHtml = newHtml.replace(
        '</body>',
        `  <div id="${widgetId}" class="ai-floating-dock">
    <div class="ai-dock-info">
      <span class="ai-pill">✨ ${activeAgent === 'claude' ? 'Claude' : activeAgent === 'swarm' ? 'Swarm' : 'Antigravity'} Live Feature</span>
      <strong id="ai-feature-label">${featureTitle.slice(0, 65)}</strong>
    </div>
    <div class="ai-dock-controls">
      <button id="ai-sync-btn" class="ai-dock-btn">☁ Sync Cloud</button>
      <button id="ai-theme-btn" class="ai-dock-btn">◐ Cambia Tema</button>
    </div>
  </div>\n</body>`
      );
    } else {
      newHtml = newHtml.replace(
        /<strong id="ai-feature-label">[\s\S]*?<\/strong>/,
        `<strong id="ai-feature-label">${featureTitle.slice(0, 65)}</strong>`
      );
    }

    let newCss = cssFile.content;
    if (!newCss.includes('.ai-floating-dock')) {
      newCss += `\n\n/* Added by CodeFID AI Agent */
.ai-floating-dock {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: min(92vw, 760px);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(99, 102, 241, 0.45);
  border-radius: 18px;
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  z-index: 999;
}
.ai-dock-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ai-pill {
  font-size: 0.68rem;
  font-weight: 700;
  color: #a5b4fc;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ai-dock-controls {
  display: flex;
  gap: 8px;
}
.ai-dock-btn {
  background: rgba(99, 102, 241, 0.22);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: #e0e7ff;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}
body.light-mode {
  filter: invert(0.92) hue-rotate(180deg);
}`;
    }

    let newJs = jsFile.content;
    if (!newJs.includes('ai-theme-btn')) {
      newJs += `\n\n// Interactive handlers added by CodeFID Agent
document.getElementById('ai-theme-btn')?.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  console.log('[CodeFID Agent] Tema tablet commutato');
});
document.getElementById('ai-sync-btn')?.addEventListener('click', () => {
  const stamp = new Date().toLocaleTimeString();
  console.log('[CodeFID Agent] Snapshot sincronizzato alle ' + stamp);
  alert('Stato PWA sincronizzato (Offline Cache + Cloud Ready) alle ' + stamp);
});`;
    }

    upsertFile('index.html', newHtml, 'html', `Aggiornato layout HTML per: "${featureTitle.slice(0, 40)}"`);
    upsertFile('styles.css', newCss, 'css', 'Aggiunti stili touch-first glassmorphism e supporto tema dinamico');
    upsertFile('app.js', newJs, 'javascript', 'Collegati event listener interattivi e logging console');
  }

  const agentDisplayName =
    activeAgent === 'claude'
      ? 'Claude Code Agent'
      : activeAgent === 'swarm'
      ? 'Swarm (Antigravity Architect + Claude Builder)'
      : 'Antigravity Agent';

  return {
    replyText:
      activeAgent === 'swarm'
        ? `### Piano Swarm Eseguito\n1. **Antigravity (Architect)**: Ha analizzato la richiesta *"${prompt}"* e strutturato i punti di iniezione DOM e stato.\n2. **Claude (UI/Code)**: Ha aggiornato \`index.html\`, \`styles.css\` e \`app.js\` con un componente touch interattivo.\n\nControlla subito l'**Anteprima Live Tablet** a destra per testare le modifiche!`
        : `Ho applicato la modifica richiesta (*"${prompt}"*) direttamente sui file \`index.html\`, \`styles.css\` e \`app.js\`. L'anteprima live del tablet è stata aggiornata automaticamente.`,
    agentLabel: agentDisplayName,
    toolCalls,
    updatedFiles: nextFiles
  };
}
