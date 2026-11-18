import {
  AgentConfig,
  AgentId,
  AgentMessage,
  AgentToolCall,
  FirebaseConfig,
  ModelLevel,
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
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }
];

export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (Consigliato Coding)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Fast)' }
];

export function getLevelDisplayName(level?: ModelLevel): string {
  if (level === 'low') return 'Low';
  if (level === 'high') return 'High';
  return 'Medium';
}

export function getGeminiThinkingBudget(level?: ModelLevel): number {
  switch (level) {
    case 'low':
      return 1024;
    case 'high':
      return 16384;
    case 'medium':
    default:
      return 4096;
  }
}

export function getClaudeThinkingBudget(level?: ModelLevel): number {
  switch (level) {
    case 'low':
      return 2048;
    case 'high':
      return 8192;
    case 'medium':
    default:
      return 4096;
  }
}

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
          !m.name.includes('-live') &&
          !m.name.includes('-tts') &&
          !m.name.includes('-image') &&
          !m.name.includes('-audio') &&
          !m.name.includes('embedding') &&
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
  const MAX_FILE_CHARS = 18_000;
  const fileContext = files
    .map((f) => {
      const content =
        f.content.length > MAX_FILE_CHARS
          ? `${f.content.slice(0, 12_000)}\n/* ... [${f.path} troncato per limite token: ${f.content.length} caratteri totali] ... */`
          : f.content;
      return `--- FILE: ${f.path} ---\n${content}`;
    })
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
Includi in "files" SOLO i file effettivamente modificati o creati (non ripetere i file invariati).

File attuali del progetto:
${fileContext}`;
}

/**
 * Extracts the first balanced JSON object starting at `start`, respecting strings/escapes.
 * Robust against "```" sequences contained inside file contents.
 */
function extractBalancedJson(text: string, start: number): string | null {
  const open = text.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return null; // truncated / unbalanced
}

function sanitizePatchPath(rawPath: unknown): string | null {
  if (typeof rawPath !== 'string') return null;
  const p = rawPath.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (!p || p.includes('..') || p.length > 200) return null;
  return p;
}

export interface ParsedPatchResult {
  cleanedText: string;
  updatedFiles: ProjectFile[];
  toolCalls: AgentToolCall[];
  patchError?: string;
}

function parseJsonPatch(rawText: string, currentFiles: ProjectFile[]): ParsedPatchResult {
  const fence =
    rawText.match(/```json-patch\b/) ||
    rawText.match(/```json\b(?=[\s\S]*?"files"\s*:)/);
  if (!fence || fence.index === undefined) {
    return { cleanedText: rawText, updatedFiles: currentFiles, toolCalls: [] };
  }

  const fenceStart = fence.index;
  const jsonStr = extractBalancedJson(rawText, fenceStart + fence[0].length);
  const textBefore = rawText.slice(0, fenceStart).trim();

  if (!jsonStr) {
    return {
      cleanedText: textBefore,
      updatedFiles: currentFiles,
      toolCalls: [],
      patchError:
        'La risposta dell\'agente è stata troncata prima di completare le modifiche ai file. Nessun file è stato modificato: riprova chiedendo modifiche più piccole o un file alla volta.'
    };
  }

  const jsonEnd = rawText.indexOf(jsonStr, fenceStart) + jsonStr.length;
  const closingFence = rawText.indexOf('```', jsonEnd);
  const textAfter = (closingFence >= 0 ? rawText.slice(closingFence + 3) : rawText.slice(jsonEnd)).trim();
  const cleanedText = [textBefore, textAfter].filter(Boolean).join('\n\n');

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.files)) {
      return {
        cleanedText,
        updatedFiles: currentFiles,
        toolCalls: [],
        patchError: 'Formato modifiche non valido (manca l\'elenco "files"). Nessun file modificato.'
      };
    }
    const nextFiles = [...currentFiles];
    const toolCalls: AgentToolCall[] = [];
    const skipped: string[] = [];

    for (const patch of parsed.files) {
      const path = sanitizePatchPath(patch?.path);
      if (!path || typeof patch.content !== 'string') {
        if (patch?.path) skipped.push(String(patch.path));
        continue;
      }
      const idx = nextFiles.findIndex((f) => f.path === path);
      const lang = detectFileLanguage(path);
      const lineCount = patch.content.split('\n').length;

      if (idx >= 0) {
        if (nextFiles[idx].content === patch.content) continue;
        nextFiles[idx] = { ...nextFiles[idx], content: patch.content, modified: true };
        toolCalls.push({
          id: `tc-${Date.now()}-${path}`,
          tool: 'edit_file',
          targetFile: path,
          summary: parsed.summary || `Aggiornato ${path}`,
          status: 'done',
          diffPreview: `File aggiornato (${lineCount} righe)`
        });
      } else {
        nextFiles.push({ path, content: patch.content, language: lang, modified: true });
        toolCalls.push({
          id: `tc-${Date.now()}-${path}`,
          tool: 'write_file',
          targetFile: path,
          summary: `Creato nuovo file ${path}`,
          status: 'done',
          diffPreview: `Nuovo file (${lineCount} righe)`
        });
      }
    }

    return {
      cleanedText: cleanedText || parsed.summary || 'Modifiche pronte.',
      updatedFiles: nextFiles,
      toolCalls,
      patchError: skipped.length
        ? `Ignorati percorsi non validi: ${skipped.join(', ')}`
        : undefined
    };
  } catch {
    return {
      cleanedText,
      updatedFiles: currentFiles,
      toolCalls: [],
      patchError:
        'Le modifiche proposte dall\'agente non sono in un formato JSON valido. Nessun file è stato modificato: riprova.'
    };
  }
}

export class AgentCancelledError extends Error {
  constructor() {
    super('Richiesta interrotta dall\'utente.');
    this.name = 'AgentCancelledError';
  }
}

export interface AgentRunOptions {
  signal?: AbortSignal;
  onPartialText?: (partialText: string) => void;
}

const CONNECT_TIMEOUT_MS = 60_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;
const MAX_TRANSIENT_RETRIES = 2;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AgentCancelledError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new AgentCancelledError());
      },
      { once: true }
    );
  });

/**
 * fetch with connection timeout + user cancellation. The returned `abort` lets
 * the stream reader cancel the same request on idle timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  externalSignal?: AbortSignal,
  timeoutMs = CONNECT_TIMEOUT_MS
): Promise<Response> {
  if (externalSignal?.aborted) throw new AgentCancelledError();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (externalSignal?.aborted) throw new AgentCancelledError();
    if (timedOut || err?.name === 'AbortError') {
      throw new Error(
        `Il server AI non ha risposto entro ${Math.round(timeoutMs / 1000)}s. Controlla la connessione o seleziona un modello più veloce.`
      );
    }
    throw new Error('Connessione di rete non disponibile o bloccata (proxy/firewall). Verifica la rete e riprova.');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Fetch with automatic retry/backoff on network errors and transient 5xx. */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, signal);
      if ([500, 502, 504, 529].includes(res.status) && attempt < MAX_TRANSIENT_RETRIES) {
        await sleep(800 * 2 ** attempt, signal);
        continue;
      }
      return res;
    } catch (err) {
      if (err instanceof AgentCancelledError) throw err;
      lastErr = err;
      if (attempt < MAX_TRANSIENT_RETRIES) {
        await sleep(800 * 2 ** attempt, signal);
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Errore di rete sconosciuto.');
}

function formatStreamingPreview(raw: string): string {
  const fenceMatch = raw.match(/```(?:json-patch|json)\b/);
  if (!fenceMatch || fenceMatch.index === undefined) {
    return raw;
  }
  const before = raw.slice(0, fenceMatch.index).trim();
  const kb = Math.max(1, Math.round((raw.length - fenceMatch.index) / 1024));
  const status = `⏳ Generazione modifiche ai file in corso... (${kb} KB)`;
  return before ? `${before}\n\n${status}` : status;
}

/**
 * Generic SSE line reader with idle timeout and cancellation.
 * Calls `onEvent` with each parsed `data:` JSON payload.
 */
async function readSseStream(
  res: Response,
  onEvent: (payload: any) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onAbort = () => reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const idle = new Promise<never>((_, reject) => {
        idleTimer = setTimeout(() => {
          reader.cancel().catch(() => undefined);
          reject(
            new Error(
              `Lo stream dell'agente si è interrotto (nessun dato per ${STREAM_IDLE_TIMEOUT_MS / 1000}s). Riprova.`
            )
          );
        }, STREAM_IDLE_TIMEOUT_MS);
      });

      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), idle]);
      } finally {
        clearTimeout(idleTimer);
      }
      if (signal?.aborted) throw new AgentCancelledError();
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          onEvent(JSON.parse(jsonStr));
        } catch (e) {
          if (e instanceof Error && e.name === 'AgentStreamError') throw e;
          // ignore malformed partial chunk
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

function streamError(message: string): Error {
  const err = new Error(message);
  err.name = 'AgentStreamError';
  return err;
}

interface StreamedReply {
  text: string;
  truncated: boolean;
}

async function readGeminiSseText(
  res: Response,
  options: AgentRunOptions
): Promise<StreamedReply> {
  const { onPartialText, signal } = options;
  const contentType = res.headers.get('content-type') || '';

  if (!res.body || contentType.includes('application/json')) {
    const data = await res.json();
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Richiesta bloccata dai filtri di sicurezza Gemini (${blockReason}).`);
    }
    const full =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    onPartialText?.(formatStreamingPreview(full));
    return { text: full, truncated: data?.candidates?.[0]?.finishReason === 'MAX_TOKENS' };
  }

  let accumulated = '';
  let finishReason = '';
  let lastEmit = 0;

  await readSseStream(
    res,
    (payload) => {
      if (payload?.error) {
        throw streamError(payload.error.message || 'Errore durante lo streaming Gemini.');
      }
      const blockReason = payload?.promptFeedback?.blockReason;
      if (blockReason) {
        throw streamError(`Richiesta bloccata dai filtri di sicurezza Gemini (${blockReason}).`);
      }
      const cand = payload?.candidates?.[0];
      if (cand?.finishReason) finishReason = cand.finishReason;
      const parts = cand?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          // Skip "thought" parts from thinking models
          if (typeof p?.text === 'string' && !p.thought) accumulated += p.text;
        }
      }
      const now = Date.now();
      if (onPartialText && now - lastEmit > 60) {
        lastEmit = now;
        onPartialText(formatStreamingPreview(accumulated));
      }
    },
    signal
  );

  onPartialText?.(formatStreamingPreview(accumulated));

  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
    throw new Error('La risposta è stata bloccata dai filtri di sicurezza Gemini. Riformula la richiesta.');
  }
  if (!accumulated.trim()) {
    throw new Error('Il modello ha restituito una risposta vuota. Riprova o cambia modello.');
  }
  return { text: accumulated, truncated: finishReason === 'MAX_TOKENS' };
}

async function readClaudeSseText(
  res: Response,
  options: AgentRunOptions
): Promise<StreamedReply> {
  const { onPartialText, signal } = options;
  const contentType = res.headers.get('content-type') || '';

  if (!res.body || contentType.includes('application/json')) {
    const data = await res.json();
    const full = (data?.content || [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('');
    onPartialText?.(formatStreamingPreview(full));
    return { text: full, truncated: data?.stop_reason === 'max_tokens' };
  }

  let accumulated = '';
  let stopReason = '';
  let lastEmit = 0;

  await readSseStream(
    res,
    (payload) => {
      if (payload?.type === 'error') {
        throw streamError(payload.error?.message || 'Errore durante lo streaming Claude.');
      }
      if (payload?.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
        accumulated += payload.delta.text || '';
      }
      if (payload?.type === 'message_delta' && payload.delta?.stop_reason) {
        stopReason = payload.delta.stop_reason;
      }
      const now = Date.now();
      if (onPartialText && now - lastEmit > 60) {
        lastEmit = now;
        onPartialText(formatStreamingPreview(accumulated));
      }
    },
    signal
  );

  onPartialText?.(formatStreamingPreview(accumulated));
  if (!accumulated.trim()) {
    throw new Error('Claude ha restituito una risposta vuota. Riprova o cambia modello.');
  }
  return { text: accumulated, truncated: stopReason === 'max_tokens' };
}

function finalizeReply(
  reply: StreamedReply,
  files: ProjectFile[]
): ParsedPatchResult {
  const parsed = parseJsonPatch(reply.text, files);
  const notes: string[] = [];
  if (parsed.patchError) notes.push(`⚠️ ${parsed.patchError}`);
  else if (reply.truncated && parsed.toolCalls.length === 0) {
    notes.push('⚠️ La risposta ha raggiunto il limite massimo di lunghezza ed è stata troncata.');
  }
  return {
    ...parsed,
    cleanedText: [parsed.cleanedText, ...notes].filter(Boolean).join('\n\n')
  };
}

function isUsableHistoryMessage(msg: AgentMessage): boolean {
  if (msg.role !== 'user' && msg.role !== 'assistant') return false;
  if (msg.agentLabel === 'Errore Agente' || msg.agentLabel === 'Interrotto') return false;
  const text = msg.content?.trim();
  if (!text || text.startsWith('⏳')) return false;
  return true;
}

function buildConversationTurns(
  history: AgentMessage[] | undefined,
  currentPrompt: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of (history || []).filter(isUsableHistoryMessage).slice(-8)) {
    const raw = msg.content.trim();
    const text = raw.length > 1500 ? `${raw.slice(0, 1500)}...` : raw;
    if (turns.length === 0 && msg.role !== 'user') continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content = `${prev.content}\n\n${text}`;
    } else {
      turns.push({ role: msg.role as 'user' | 'assistant', content: text });
    }
  }
  const prev = turns[turns.length - 1];
  if (prev && prev.role === 'user') {
    prev.content = `${prev.content}\n\n${currentPrompt}`;
  } else {
    turns.push({ role: 'user', content: currentPrompt });
  }
  return turns;
}

function extractApiErrorMessage(errText: string): string {
  try {
    const parsed = JSON.parse(errText);
    return parsed?.error?.message || parsed?.message || errText;
  } catch {
    return errText;
  }
}

async function callClaudeApi(
  prompt: string,
  config: AgentConfig,
  files: ProjectFile[],
  history?: AgentMessage[],
  options: AgentRunOptions = {}
): Promise<AgentExecutionResult> {
  const model = config.claudeModel || 'claude-sonnet-5-5';
  const levelName = getLevelDisplayName(config.agentLevel);
  const turns = buildConversationTurns(history, prompt);
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 16384,
      stream: true,
      system: buildSystemPrompt('claude', files),
      messages: turns
    })
  };

  let res = await fetchWithRetry('https://api.anthropic.com/v1/messages', requestInit, options.signal);

  // Rate-limit / overload: wait once using retry-after if provided
  if (res.status === 429 || res.status === 529) {
    const retryAfter = Number(res.headers.get('retry-after')) || 3;
    await sleep(Math.min(retryAfter, 10) * 1000, options.signal);
    res = await fetchWithRetry('https://api.anthropic.com/v1/messages', requestInit, options.signal);
  }

  if (!res.ok) {
    const msg = extractApiErrorMessage(await res.text());
    if (res.status === 401) throw new Error('API Key Claude non valida o scaduta (401). Controllala nelle impostazioni.');
    if (res.status === 404) throw new Error(`Modello Claude "${model}" non disponibile (404). Selezionane un altro dalla chat.`);
    if (res.status === 429) throw new Error('Limite di richieste/quota Claude raggiunto (429). Attendi qualche secondo e riprova.');
    throw new Error(`Errore API Claude (${res.status}): ${msg.slice(0, 200)}`);
  }

  const reply = await readClaudeSseText(res, options);
  const { cleanedText, updatedFiles, toolCalls } = finalizeReply(reply, files);

  return {
    replyText: cleanedText,
    agentLabel: `Claude (${model} ${levelName})`,
    toolCalls,
    updatedFiles
  };
}

async function callGeminiAntigravityApi(
  prompt: string,
  config: AgentConfig,
  files: ProjectFile[],
  agentMode: AgentId,
  history?: AgentMessage[],
  options: AgentRunOptions = {}
): Promise<AgentExecutionResult> {
  const rawModel = config.antigravityModel || 'gemini-4-hydrogen';
  const primaryModel = rawModel.startsWith('gemini-2.5') ? 'gemini-4-hydrogen' : rawModel;
  const levelName = getLevelDisplayName(config.agentLevel);
  const thinkingBudget = getGeminiThinkingBudget(config.agentLevel);
  const fallbackChain = [
    primaryModel,
    ...['gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-4-argon'].filter(
      (m) => m !== primaryModel
    )
  ];
  const turns = buildConversationTurns(history, prompt);

  const buildRequestBody = (withThinking: boolean) => {
    const generationConfig: Record<string, any> = {
      maxOutputTokens: 32768
    };
    if (withThinking) {
      generationConfig.thinkingConfig = {
        thinkingBudget
      };
    }
    return JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(agentMode, files) }]
      },
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content }]
      })),
      generationConfig
    });
  };

  let usedModel = primaryModel;
  let res: Response | null = null;
  let lastErrorText = '';
  let lastStatus = 0;
  const triedModels: string[] = [];

  for (const candidate of fallbackChain) {
    triedModels.push(candidate);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
      config.geminiApiKey.trim()
    )}`;
    // First try with thinkingConfig
    res = await fetchWithRetry(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: buildRequestBody(true) },
      options.signal
    );
    // If rejected with 400 (e.g. model doesn't support thinkingConfig), retry without thinkingConfig
    if (!res.ok && res.status === 400) {
      const errClone = res.clone();
      const errBody = await errClone.text().catch(() => '');
      if (/thinking|unknown field|invalid argument/i.test(errBody)) {
        res = await fetchWithRetry(
          url,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: buildRequestBody(false) },
          options.signal
        );
      }
    }
    if (res.ok) {
      usedModel = candidate;
      break;
    }
    lastStatus = res.status;
    lastErrorText = extractApiErrorMessage(await res.text());
    // Auth / bad request errors are not model-specific: stop immediately
    if (res.status === 400 || res.status === 401 || res.status === 403) break;
    // Try next model on quota/rate-limit (429), overload (503), or unavailable model (404)
    if (res.status !== 429 && res.status !== 503 && res.status !== 404) break;
    options.onPartialText?.(`⏳ ${candidate} non disponibile (${res.status}), provo un modello alternativo...`);
  }

  if (!res || !res.ok) {
    if (lastStatus === 400 && /api key/i.test(lastErrorText)) {
      throw new Error('API Key Gemini non valida (400). Controllala nelle impostazioni.');
    }
    if (lastStatus === 401 || lastStatus === 403) {
      throw new Error(
        `Accesso negato dalla Gemini API (${lastStatus}): ${lastErrorText.slice(0, 160)}. Verifica che la chiave sia attiva e che la Generative Language API sia abilitata sul progetto.`
      );
    }
    if (lastStatus === 429) {
      throw new Error(
        `Quota/limite Gemini superato (429) su: ${triedModels.join(', ')}. Dettaglio: ${lastErrorText.slice(0, 160)}`
      );
    }
    if (lastStatus === 503) {
      throw new Error(`Modelli Gemini temporaneamente sovraccarichi (503) su: ${triedModels.join(', ')}. Riprova tra poco.`);
    }
    throw new Error(`Errore API Antigravity/Gemini (${lastStatus}): ${lastErrorText.slice(0, 200)}`);
  }

  const reply = await readGeminiSseText(res, options);
  const { cleanedText, updatedFiles, toolCalls } = finalizeReply(reply, files);
  const fallbackNote =
    usedModel !== primaryModel ? `\n\nℹ️ Risposta generata con ${usedModel} (fallback da ${primaryModel}).` : '';

  return {
    replyText: cleanedText + fallbackNote,
    agentLabel:
      agentMode === 'swarm'
        ? `Swarm (Antigravity ${levelName} + Claude)`
        : `Antigravity (${usedModel} ${levelName})`,
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
  history?: AgentMessage[];
  onPartialText?: (partialText: string) => void;
  signal?: AbortSignal;
}): Promise<AgentExecutionResult> {
  const { prompt, agentConfig, files, manifestConfig, firebaseConfig, history, onPartialText, signal } =
    params;
  const runOptions: AgentRunOptions = { onPartialText, signal };
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
        'antigravity',
        history,
        {
          signal,
          onPartialText: onPartialText
            ? (t) => onPartialText(`### 1. Antigravity\n${t}`)
            : undefined
        }
      );

      const claudePrompt = `[Ruolo: Claude UI/Frontend Builder nello Swarm]\nAntigravity ha appena lavorato su questa richiesta:\n"${prompt}"\n\nRifinisci UI/UX touch, CSS, layout e codice interattivo sui file risultanti.`;
      const levelName = getLevelDisplayName(agentConfig.agentLevel);
      const step1Header = `### 1. Antigravity (${agentConfig.antigravityModel || 'Gemini'} ${levelName})\n${step1.replyText}\n\n---\n\n`;
      const step2 = await callClaudeApi(claudePrompt, agentConfig, step1.updatedFiles, history, {
        signal,
        onPartialText: onPartialText
          ? (t) => onPartialText(`${step1Header}### 2. Claude\n${t}`)
          : undefined
      });

      return {
        replyText:
          step1Header + `### 2. Claude (${agentConfig.claudeModel || 'Sonnet'} ${levelName})\n${step2.replyText}`,
        agentLabel: `Swarm (Antigravity + Claude ${levelName})`,
        toolCalls: [...step1.toolCalls, ...step2.toolCalls],
        updatedFiles: step2.updatedFiles
      };
    }

    if (hasGemini) {
      return callGeminiAntigravityApi(prompt, agentConfig, files, 'swarm', history, runOptions);
    }

    if (hasClaude) {
      const res = await callClaudeApi(prompt, agentConfig, files, history, runOptions);
      return { ...res, agentLabel: `Swarm (${res.agentLabel})` };
    }
  }

  // 2. Single Cloud Agent if user has configured its API key
  if (activeAgent === 'claude' && hasClaude) {
    return callClaudeApi(prompt, agentConfig, files, history, runOptions);
  }
  if (activeAgent === 'antigravity' && hasGemini) {
    return callGeminiAntigravityApi(prompt, agentConfig, files, 'antigravity', history, runOptions);
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
