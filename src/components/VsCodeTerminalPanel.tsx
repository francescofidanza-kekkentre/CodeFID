import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Terminal, Trash2, X } from 'lucide-react';
import { AgentConfig, GitHubConfig, ProjectFile } from '../types/ide';
import { auditPwaProject } from '../services/pwaPreview';

interface TerminalLine {
  id: string;
  type: 'cmd' | 'out' | 'err' | 'info';
  text: string;
}

interface VsCodeTerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  agentConfig: AgentConfig;
  githubConfig: GitHubConfig;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

const QUICK_COMMANDS = ['help', 'ls', 'git status', 'pwa audit', 'clear'];

/**
 * VS Code-style integrated bottom terminal supporting built-in workspace commands
 * on iPad/Android and live shell execution via the optional CLI Bridge.
 */
export const VsCodeTerminalPanel: React.FC<VsCodeTerminalPanelProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  files,
  agentConfig,
  githubConfig,
  onCreateFile,
  onDeleteFile
}) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      type: 'info',
      text: 'VisualFidCodingApp Terminal — Digita "help" per i comandi disponibili.'
    }
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [lines, isOpen]);

  if (!isOpen) return null;

  const appendLines = (entries: Omit<TerminalLine, 'id'>[]) => {
    setLines((prev) => [
      ...prev.slice(-200),
      ...entries.map((e, i) => ({ ...e, id: `${Date.now()}-${i}-${Math.random()}` }))
    ]);
  };

  const executeCommand = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    setHistory((prev) => [cmd, ...prev.slice(0, 29)]);
    setHistoryIdx(-1);

    if (cmd === 'clear' || cmd === 'cls') {
      setLines([]);
      return;
    }

    appendLines([{ type: 'cmd', text: `~/workspace/${projectId} $ ${cmd}` }]);

    const [base, ...args] = cmd.split(/\s+/);

    // Built-in browser workspace commands
    if (base === 'help') {
      appendLines([
        {
          type: 'info',
          text:
            'Comandi locali disponibili:\n' +
            '  ls               Elenca i file del progetto\n' +
            '  cat <file>       Mostra il contenuto di un file\n' +
            '  touch <file>     Crea un nuovo file\n' +
            '  rm <file>        Elimina un file\n' +
            '  pwd              Mostra percorso workspace\n' +
            '  git status       Stato repository & GitHub\n' +
            '  pwa audit        Esegue audit PWA sui file\n' +
            '  clear            Pulisce il terminale\n' +
            'Qualsiasi altro comando viene inviato al CLI Bridge se connesso.'
        }
      ]);
      return;
    }

    if (base === 'pwd') {
      appendLines([{ type: 'out', text: `/workspace/${projectId} (${projectName})` }]);
      return;
    }

    if (base === 'ls' || base === 'dir') {
      if (files.length === 0) {
        appendLines([{ type: 'info', text: '(nessun file nel progetto)' }]);
      } else {
        appendLines([
          {
            type: 'out',
            text: files
              .map((f) => `${f.modified ? 'M ' : '  '}${f.path} (${f.content.length} B)`)
              .join('\n')
          }
        ]);
      }
      return;
    }

    if (base === 'cat') {
      const target = args[0];
      if (!target) {
        appendLines([{ type: 'err', text: 'Uso: cat <nome-file>' }]);
        return;
      }
      const found = files.find((f) => f.path === target);
      if (!found) {
        appendLines([{ type: 'err', text: `cat: ${target}: File non trovato` }]);
      } else {
        appendLines([{ type: 'out', text: found.content || '(file vuoto)' }]);
      }
      return;
    }

    if (base === 'touch') {
      const target = args[0];
      if (!target) {
        appendLines([{ type: 'err', text: 'Uso: touch <nome-file>' }]);
        return;
      }
      onCreateFile(target);
      appendLines([{ type: 'info', text: `Creato ${target}` }]);
      return;
    }

    if (base === 'rm') {
      const target = args[0];
      if (!target) {
        appendLines([{ type: 'err', text: 'Uso: rm <nome-file>' }]);
        return;
      }
      if (!files.some((f) => f.path === target)) {
        appendLines([{ type: 'err', text: `rm: ${target}: File non trovato` }]);
        return;
      }
      onDeleteFile(target);
      appendLines([{ type: 'info', text: `Rimosso ${target}` }]);
      return;
    }

    if (cmd === 'git status') {
      const modified = files.filter((f) => f.modified).map((f) => f.path);
      const ghLine = githubConfig.connected
        ? `Remote: ${githubConfig.selectedRepo || `@${githubConfig.username}`} (branch ${githubConfig.branch || 'main'})`
        : 'Remote: GitHub non collegato';
      appendLines([
        {
          type: 'out',
          text:
            `${ghLine}\n` +
            `File totali: ${files.length}\n` +
            (modified.length > 0
              ? `Modificati in locale:\n  ${modified.join('\n  ')}`
              : 'Working tree pulito')
        }
      ]);
      return;
    }

    if (cmd === 'pwa audit') {
      const audit = auditPwaProject(files);
      const summary = audit.items
        .map((it) => `${it.passed ? '[OK]' : '[!!]'} ${it.title}`)
        .join('\n');
      appendLines([
        {
          type: 'out',
          text: `PWA Readiness Score: ${audit.score}%\n${summary}`
        }
      ]);
      return;
    }

    // Forward any other shell command to CLI Bridge
    setIsRunning(true);
    try {
      const res = await fetch(`${agentConfig.bridgeUrl.replace(/\/$/, '')}/api/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      const out = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
      appendLines([
        {
          type: data.ok ? 'out' : 'err',
          text: out || '(comando eseguito senza output)'
        }
      ]);
    } catch {
      appendLines([
        {
          type: 'err',
          text: `Comando "${base}" non disponibile in locale e CLI Bridge non raggiungibile (${agentConfig.bridgeUrl}). Digita "help" per i comandi locali.`
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    const cmd = input;
    setInput('');
    void executeCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    }
  };

  return (
    <section
      aria-label="Terminale Integrato"
      className="h-48 lg:h-56 bg-[#181818] border-t border-[#2b2b2b] flex flex-col shrink-0 select-text"
    >
      {/* Terminal Header */}
      <div className="h-9 px-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar select-none">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 h-9 border-b-2 border-[#007acc] text-[11px] font-semibold uppercase tracking-wider text-white">
            <Terminal className="w-3.5 h-3.5 text-[#3794ff]" />
            <span>Terminal</span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-medium ${
              agentConfig.bridgeConnected
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-[#333333] text-[#969696]'
            }`}
          >
            {agentConfig.bridgeConnected ? '● Bridge Locale' : '○ Shell Locale'}
          </span>
        </div>

        {/* Tablet Quick Command Chips + Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {QUICK_COMMANDS.map((q) => (
            <button
              key={q}
              onClick={() => void executeCommand(q)}
              disabled={isRunning}
              className="hidden sm:inline-flex px-2 py-1 rounded bg-[#333333] hover:bg-[#007acc]/40 border border-[#454545] text-[#cccccc] font-mono text-[11px] transition"
            >
              {q}
            </button>
          ))}
          <button
            onClick={() => setLines([])}
            title="Pulisci terminale"
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-[#969696] hover:text-white transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Chiudi terminale"
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-[#969696] hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Log */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-5 space-y-1 bg-[#181818]"
      >
        {lines.map((line) => (
          <pre
            key={line.id}
            className={`whitespace-pre-wrap break-words font-mono ${
              line.type === 'cmd'
                ? 'text-[#3794ff] font-semibold'
                : line.type === 'err'
                ? 'text-rose-400'
                : line.type === 'info'
                ? 'text-[#9cdcfe]'
                : 'text-[#cccccc]'
            }`}
          >
            {line.text}
          </pre>
        ))}
        {isRunning && (
          <div className="flex items-center gap-1.5 text-[#858585]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Esecuzione comando...</span>
          </div>
        )}
      </div>

      {/* Prompt Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-1.5 bg-[#1e1e1e] border-t border-[#2b2b2b] flex items-center gap-2 shrink-0"
      >
        <span className="font-mono text-xs text-[#3794ff] font-semibold shrink-0">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Scrivi un comando (es. help, ls, git status, touch app.js)..."
          className="flex-1 bg-transparent text-[#cccccc] font-mono text-xs py-1 focus:outline-none"
        />
      </form>
    </section>
  );
};
