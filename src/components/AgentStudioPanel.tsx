import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Cpu,
  FileCode,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  Users,
  Wand2,
  Wrench
} from 'lucide-react';
import {
  AgentConfig,
  AgentId,
  AgentMessage,
  ProjectFile
} from '../types/ide';

interface AgentStudioPanelProps {
  messages: AgentMessage[];
  agentConfig: AgentConfig;
  isRunning: boolean;
  onChangeAgent: (agent: AgentId) => void;
  onSendPrompt: (prompt: string) => void;
  onRunBridgeCommand: (cmd: string) => void;
  onSelectFile: (path: string) => void;
  onRestoreSnapshot: (files: ProjectFile[]) => void;
  onOpenSettings: () => void;
  onOpenGuidedSetup?: () => void;
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
  onSendPrompt,
  onRunBridgeCommand,
  onSelectFile,
  onRestoreSnapshot,
  onOpenSettings,
  onOpenGuidedSetup
}) => {
  const [input, setInput] = useState('');

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
    <div className="flex flex-col h-full bg-[#0c1221] border-r border-slate-800/80 overflow-hidden">
      {/* Header: Active Agent Selector */}
      <div className="p-2.5 bg-[#0f172a] border-b border-slate-800/80 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              AI Agent Studio
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-[11px] text-indigo-300 hover:text-indigo-200 underline"
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
      </div>

      {/* Quick Slash Prompts Bar */}
      <div className="px-2.5 py-1.5 bg-[#0f172a] border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            onClick={() => onSendPrompt(q.prompt)}
            disabled={isRunning}
            className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-indigo-600/25 border border-slate-700/80 text-slate-300 hover:text-indigo-200 text-[11px] font-medium whitespace-nowrap transition shrink-0"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Prompt Input Form */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 bg-[#090d18] border-t border-slate-800/80 flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chiedi a Claude/Antigravity (o usa !cmd per Bridge CLI)..."
            className="w-full bg-slate-900 text-slate-100 text-xs rounded-xl pl-3 pr-9 py-2.5 border border-slate-700/80 focus:outline-none focus:border-indigo-500"
          />
          <Terminal className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          type="submit"
          disabled={isRunning || !input.trim()}
          className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Invia</span>
        </button>
      </form>
    </div>
  );
};
