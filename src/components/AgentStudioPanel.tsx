import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  FileCode,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  Users,
  Wand2,
  Wrench,
  X
} from 'lucide-react';
import {
  AgentConfig,
  AgentId,
  AgentMessage,
  PendingAgentChanges,
  ProjectFile
} from '../types/ide';
import {
  CLAUDE_MODELS,
  DEFAULT_ANTIGRAVITY_MODELS,
  fetchAvailableGeminiModels,
  ModelOption
} from '../services/agentEngine';

interface AgentStudioPanelProps {
  messages: AgentMessage[];
  agentConfig: AgentConfig;
  isRunning: boolean;
  onChangeAgent: (agent: AgentId) => void;
  onUpdateAgentConfig: (config: AgentConfig) => void;
  onSendPrompt: (prompt: string) => void;
  onRunBridgeCommand: (cmd: string) => void;
  onSelectFile: (path: string) => void;
  onRestoreSnapshot: (files: ProjectFile[]) => void;
  onOpenSettings: () => void;
  onOpenGuidedSetup?: () => void;
  pendingChanges?: PendingAgentChanges | null;
  onAcceptPendingChanges?: () => void;
  onRejectPendingChanges?: () => void;
}

const QUICK_PROMPTS = [
  {
    label: '/pwa-audit',
    prompt: '/pwa-audit Ottimizza manifest.json e sw.js per 100% PWA Offline su tablet'
  },
  {
    label: '/firebase-init',
    prompt: '/firebase-init Aggiungi configurazione Firebase Firestore e Hosting alla PWA'
  },
  {
    label: '/github-workflow',
    prompt: '/github-workflow Crea GitHub Action per deploy automatico su GitHub Pages'
  },
  {
    label: '+ Barra Touch AI',
    prompt: 'Aggiungi una floating dock touch con switch tema chiaro/scuro e sync cloud'
  }
];

export const AgentStudioPanel: React.FC<AgentStudioPanelProps> = ({
  messages,
  agentConfig,
  isRunning,
  onChangeAgent,
  onUpdateAgentConfig,
  onSendPrompt,
  onRunBridgeCommand,
  onSelectFile,
  onRestoreSnapshot,
  onOpenSettings,
  onOpenGuidedSetup,
  pendingChanges,
  onAcceptPendingChanges,
  onRejectPendingChanges
}) => {
  const [input, setInput] = useState('');
  const [geminiModels, setGeminiModels] = useState<ModelOption[]>(DEFAULT_ANTIGRAVITY_MODELS);
  const [loadingModels, setLoadingModels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isRunning]);

  const loadGeminiModels = async () => {
    setLoadingModels(true);
    try {
      const models = await fetchAvailableGeminiModels(agentConfig.geminiApiKey);
      setGeminiModels(models);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadGeminiModels();
  }, [agentConfig.geminiApiKey]);

  const effectiveGeminiModels = geminiModels.some((m) => m.id === agentConfig.antigravityModel)
    ? geminiModels
    : [{ id: agentConfig.antigravityModel, label: agentConfig.antigravityModel }, ...geminiModels];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    const text = input.trim();
    setInput('');
    if (text.startsWith('!')) {
      onRunBridgeCommand(text.slice(1).trim());
    } else {
      onSendPrompt(text);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#181818] border-r border-[#2b2b2b] overflow-hidden">
      {/* Header: Active Agent Selector */}
      <div className="p-2.5 bg-[#252526] border-b border-[#2b2b2b] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#3794ff]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#cccccc]">
              AI Agent Chat
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-[11px] text-[#3794ff] hover:underline"
          >
            {agentConfig.claudeApiKey || agentConfig.geminiApiKey
              ? 'API Cloud Attiva'
              : 'Motore Integrato + BYOK'}
          </button>
        </div>

        {/* 3 Agent Mode Cards */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onChangeAgent('antigravity')}
            className={`p-2 rounded-xl border text-left transition ${
              agentConfig.activeAgent === 'antigravity'
                ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Antigravity</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              PWA, SW & Cloud
            </p>
          </button>

          <button
            onClick={() => onChangeAgent('claude')}
            className={`p-2 rounded-xl border text-left transition ${
              agentConfig.activeAgent === 'claude'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Claude</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Tablet UI & Codice
            </p>
          </button>

          <button
            onClick={() => onChangeAgent('swarm')}
            className={`p-2 rounded-xl border text-left transition ${
              agentConfig.activeAgent === 'swarm'
                ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Swarm</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              AGY + Claude
            </p>
          </button>
        </div>

        {/* Model Selector Bar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#858585] shrink-0">
            Modello
          </span>

          {(agentConfig.activeAgent === 'antigravity' || agentConfig.activeAgent === 'swarm') && (
            <div className="flex items-center gap-1 flex-1 min-w-[140px]">
              <select
                aria-label="Modello Antigravity / Gemini"
                value={agentConfig.antigravityModel}
                onChange={(e) =>
                  onUpdateAgentConfig({
                    ...agentConfig,
                    antigravityModel: e.target.value
                  })
                }
                className="w-full bg-[#252526] text-[#cccccc] text-[11px] font-medium rounded px-2 py-1 border border-[#3c3c3c] focus:outline-none focus:border-[#007acc] truncate"
              >
                {effectiveGeminiModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#252526] text-[#cccccc]">
                    {m.label}
                  </option>
                ))}
              </select>
              {agentConfig.geminiApiKey.trim() && (
                <button
                  type="button"
                  onClick={loadGeminiModels}
                  disabled={loadingModels}
                  title="Aggiorna modelli disponibili dalla API Key"
                  className="p-1 rounded bg-[#252526] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[#969696] hover:text-white transition shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin text-[#3794ff]' : ''}`} />
                </button>
              )}
            </div>
          )}

          {(agentConfig.activeAgent === 'claude' || agentConfig.activeAgent === 'swarm') && (
            <div className="flex items-center gap-1 flex-1 min-w-[140px]">
              <select
                aria-label="Modello Claude"
                value={agentConfig.claudeModel}
                onChange={(e) =>
                  onUpdateAgentConfig({
                    ...agentConfig,
                    claudeModel: e.target.value
                  })
                }
                className="w-full bg-[#252526] text-[#cccccc] text-[11px] font-medium rounded px-2 py-1 border border-[#3c3c3c] focus:outline-none focus:border-[#007acc] truncate"
              >
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#252526] text-[#cccccc]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isRunning && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <Bot className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs font-medium text-slate-400">Nessun messaggio</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
              Scrivi un prompt qui sotto o usa un comando rapido per iniziare.
            </p>
            {onOpenGuidedSetup && (
              <button
                onClick={onOpenGuidedSetup}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold transition"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Setup Guidato IA &amp; GitHub</span>
              </button>
            )}
          </div>
        )}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`rounded-2xl p-3 border text-xs leading-relaxed ${
                isUser
                  ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-100 ml-4'
                  : 'bg-slate-900/90 border-slate-800/90 text-slate-200 mr-2'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">
                  {isUser ? 'Tu (Tablet)' : msg.agentLabel || msg.agent.toUpperCase()}
                </span>
                <span>{msg.timestamp}</span>
              </div>

              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Modified Files Highlight Banner */}
              {msg.modifiedFiles && msg.modifiedFiles.length > 0 && (
                <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/35 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>File modificati ({msg.modifiedFiles.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.modifiedFiles.map((filePath) => (
                      <button
                        key={filePath}
                        onClick={() => onSelectFile(filePath)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-mono text-[11px] font-semibold transition"
                        title={`Apri ${filePath} nell'editor`}
                      >
                        <FileCode className="w-3 h-3 text-emerald-300 shrink-0" />
                        <span>{filePath}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool Calls List */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-indigo-400" />
                    <span>Operazioni Eseguite sui File ({msg.toolCalls.length})</span>
                  </div>
                  {msg.toolCalls.map((tc) => (
                    <div
                      key={tc.id}
                      className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <span className="font-mono text-[11px] text-indigo-300 mr-1.5">
                            {tc.tool}
                          </span>
                          <span className="text-slate-300 text-[11px]">{tc.summary}</span>
                        </div>
                      </div>
                      {tc.targetFile && (
                        <button
                          onClick={() => onSelectFile(tc.targetFile!)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-mono text-[10px] shrink-0"
                        >
                          <FileCode className="w-3 h-3" />
                          <span>{tc.targetFile}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Restore Snapshot Button */}
              {msg.snapshotFiles && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => onRestoreSnapshot(msg.snapshotFiles!)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ripristina versione precedente</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>
              {agentConfig.activeAgent === 'swarm'
                ? 'Swarm (Antigravity + Claude) sta progettando e aggiornando i file PWA...'
                : `${agentConfig.activeAgent.toUpperCase()} sta modificando il codice...`}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Changes Confirmation Banner (in basso alla chat) */}
      {pendingChanges && pendingChanges.files.length > 0 && (
        <div className="px-3 py-2.5 bg-[#1b222c] border-t border-amber-500/40 space-y-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-amber-200">
              Confermi le modifiche ai {pendingChanges.files.length} file evidenziati?
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300">
                -{pendingChanges.totalDeletedLines} cancellate
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                +{pendingChanges.totalAddedLines} aggiunte
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {pendingChanges.files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelectFile(file.path)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#252526] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[11px] font-mono text-[#cccccc] transition"
                title={`Apri ${file.path} nell'editor`}
              >
                <FileCode className="w-3 h-3 text-[#3794ff] shrink-0" />
                <span className="truncate max-w-[140px]">{file.path}</span>
                <span className="text-rose-400 font-semibold">-{file.deletedLines}</span>
                <span className="text-emerald-400 font-semibold">+{file.addedLines}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            {onRejectPendingChanges && (
              <button
                type="button"
                onClick={onRejectPendingChanges}
                className="px-3 py-1.5 rounded bg-[#2d2d2d] hover:bg-[#3c3c3c] border border-[#3c3c3c] text-[#cccccc] text-xs font-medium flex items-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Rifiuta</span>
              </button>
            )}
            {onAcceptPendingChanges && (
              <button
                type="button"
                onClick={onAcceptPendingChanges}
                className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Slash Prompts Bar */}
      <div className="px-2.5 py-1.5 bg-[#252526] border-t border-[#2b2b2b] flex items-center gap-1.5 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            onClick={() => onSendPrompt(q.prompt)}
            disabled={isRunning}
            className="px-2.5 py-1 rounded bg-[#333333] hover:bg-[#007acc]/30 border border-[#3c3c3c] text-[#cccccc] hover:text-white text-[11px] font-medium whitespace-nowrap transition shrink-0"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Prompt Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 bg-[#181818] border-t border-[#2b2b2b] flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={(e) => {
              const target = e.currentTarget;
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                target.scrollIntoView({ block: 'nearest' });
              }, 250);
            }}
            placeholder="Chiedi a Claude/Antigravity (o usa !cmd per Bridge CLI)..."
            className="w-full bg-[#252526] text-[#cccccc] text-xs lg:text-[13px] rounded pl-3 pr-9 py-2.5 min-h-[42px] border border-[#3c3c3c] focus:outline-none focus:border-[#007acc]"
          />
          <Terminal className="w-3.5 h-3.5 text-[#858585] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          type="submit"
          disabled={isRunning || !input.trim()}
          className="px-4 py-2.5 min-h-[42px] rounded bg-[#007acc] hover:bg-[#1f8ad2] disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1.5 transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Invia</span>
        </button>
      </form>
    </div>
  );
};
