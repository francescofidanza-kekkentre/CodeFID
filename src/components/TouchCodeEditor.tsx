import React, { useRef, useState } from 'react';
import {
  FileCode2,
  Plus,
  Sparkles,
  Cpu,
  Wand2,
  Check,
  Copy
} from 'lucide-react';
import { ProjectFile } from '../types/ide';
import { renderFileIcon } from '../utils/fileHelpers';

interface TouchCodeEditorProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, newContent: string) => void;
  onCreateFile: (path: string) => void;
  onAskAgentAboutFile: (agent: 'claude' | 'antigravity', file: ProjectFile) => void;
  agentModifiedFiles?: string[];
}

const TOUCH_KEYS = [
  { label: 'Tab', insert: '  ' },
  { label: '{', insert: '{' },
  { label: '}', insert: '}' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: '[', insert: '[' },
  { label: ']', insert: ']' },
  { label: '=>', insert: ' => ' },
  { label: '</>', insert: '<div></div>' },
  { label: ';', insert: ';' },
  { label: "'", insert: "'" },
  { label: '"', insert: '"' },
  { label: 'async', insert: 'async ' },
  { label: 'await', insert: 'await ' },
  { label: 'const', insert: 'const ' },
  { label: 'console.log', insert: 'console.log()' }
];

export const TouchCodeEditor: React.FC<TouchCodeEditorProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFileContent,
  onCreateFile,
  onAskAgentAboutFile,
  agentModifiedFiles = []
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copied, setCopied] = useState(false);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];
  const lines = (activeFile?.content || '').split('\n');

  const handleInsertSymbol = (snippet: string) => {
    const el = textareaRef.current;
    if (!el || !activeFile) return;
    const start = el.selectionStart ?? activeFile.content.length;
    const end = el.selectionEnd ?? activeFile.content.length;
    const next =
      activeFile.content.slice(0, start) + snippet + activeFile.content.slice(end);
    onUpdateFileContent(activeFile.path, next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleFormatCode = () => {
    if (!activeFile) return;
    if (activeFile.language === 'json') {
      try {
        const formatted = JSON.stringify(JSON.parse(activeFile.content), null, 2);
        onUpdateFileContent(activeFile.path, formatted);
      } catch {
        // ignore invalid json
      }
    } else {
      const cleaned = activeFile.content
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n');
      onUpdateFileContent(activeFile.path, cleaned);
    }
  };

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard?.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleNewFilePrompt = () => {
    const name = window.prompt(
      'Nome del nuovo file (es. components.js, offline.html, manifest.json):',
      'helper.js'
    );
    if (!name || !name.trim()) return;
    onCreateFile(name.trim());
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#2b2b2b] overflow-hidden">
      {/* File Tabs Bar (VS Code style, Touch Scrollable) */}
      <div className="flex items-center justify-between bg-[#252526] border-b border-[#2b2b2b] pr-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {files.map((file) => {
            const isActive = file.path === activeFile?.path;
            const isAgentModified = agentModifiedFiles.includes(file.path);
            return (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-r border-[#2b2b2b] transition ${
                  isActive
                    ? isAgentModified
                      ? 'bg-[#1e1e1e] text-emerald-300 border-t-2 border-t-emerald-400'
                      : 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]'
                    : isAgentModified
                    ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 border-t-2 border-t-emerald-400'
                    : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2d2e] hover:text-[#cccccc] border-t-2 border-t-transparent'
                }`}
              >
                {renderFileIcon(file.path)}
                <span>{file.path}</span>
                {isAgentModified && (
                  <span
                    className="px-1 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-[9px] font-bold text-emerald-300 uppercase leading-none"
                    title="Modificato dall'agente AI"
                  >
                    AI
                  </span>
                )}
                {file.modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e2c08d]" title="Modificato" />
                )}
              </button>
            );
          })}
          <button
            onClick={handleNewFilePrompt}
            className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[#969696] hover:text-white hover:bg-[#2a2d2e] transition shrink-0"
            title="Crea nuovo file"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>File</span>
          </button>
        </div>

        {/* File Quick Actions */}
        {activeFile && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onAskAgentAboutFile('antigravity', activeFile)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-medium transition"
              title="Ottimizza questo file con Antigravity"
            >
              <Cpu className="w-3 h-3" />
              <span className="hidden xl:inline">Antigravity</span>
            </button>
            <button
              onClick={() => onAskAgentAboutFile('claude', activeFile)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition"
              title="Rifinisci UI/Codice con Claude"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden xl:inline">Claude</span>
            </button>
            <button
              onClick={handleFormatCode}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Formatta codice"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Copia contenuto file"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tablet Quick-Keys Touch Bar */}
      {activeFile && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#252526] border-b border-[#2b2b2b] overflow-x-auto shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#858585] mr-1 shrink-0">
            Touch Keys
          </span>
          {TOUCH_KEYS.map((k) => (
            <button
              key={k.label}
              onClick={() => handleInsertSymbol(k.insert)}
              className="px-3 py-1.5 min-h-[34px] rounded bg-[#333333] hover:bg-[#007acc]/40 active:scale-95 border border-[#454545] text-[#cccccc] font-mono text-xs transition shrink-0"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {/* Code Editor Area */}
      {activeFile ? (
        <div className="relative flex-1 flex overflow-hidden font-mono text-xs lg:text-[13px] leading-6">
          {/* Line Numbers Gutter */}
          <div
            aria-hidden="true"
            className="w-11 py-3 bg-[#1e1e1e] text-[#858585] text-right pr-2.5 select-none border-r border-[#2b2b2b] overflow-hidden shrink-0"
          >
            {lines.map((_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>

          {/* Editable Textarea */}
          <textarea
            ref={textareaRef}
            value={activeFile.content}
            onChange={(e) => onUpdateFileContent(activeFile.path, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                handleInsertSymbol('  ');
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 w-full h-full p-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs lg:text-[13px] leading-6 resize-none focus:outline-none overflow-auto selection:bg-[#264f78]"
            placeholder="Scrivi codice qui o chiedi a Claude / Antigravity..."
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#858585]">
          <FileCode2 className="w-10 h-10 text-[#3c3c3c] mb-3" />
          <p className="text-sm font-medium text-[#cccccc]">Nessun file aperto</p>
          <p className="text-xs text-[#858585] mt-1 mb-4 max-w-xs">
            Ambiente vuoto. Crea un nuovo file o usa l&apos;AI Agent Studio per iniziare.
          </p>
          <button
            onClick={handleNewFilePrompt}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#007acc] hover:bg-[#1f8ad2] text-white text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuovo File</span>
          </button>
        </div>
      )}

      {/* Editor Footer Status */}
      <div className="h-6 px-3 bg-[#252526] border-t border-[#2b2b2b] flex items-center justify-between text-[11px] text-[#969696] shrink-0">
        {activeFile ? (
          <>
            <div className="flex items-center gap-3">
              <span>
                File: <strong className="text-slate-200">{activeFile.path}</strong>
              </span>
              <span>Righe: {lines.length}</span>
              <span>Caratteri: {activeFile.content.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {activeFile.language}
              </span>
              <span className="text-emerald-400">● Auto-Saved Local</span>
            </div>
          </>
        ) : (
          <span>Ambiente vuoto</span>
        )}
      </div>
    </div>
  );
};
