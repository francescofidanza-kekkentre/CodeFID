import React, { useRef, useState } from 'react';
import {
  FileCode2,
  FileJson,
  FileText,
  Plus,
  Sparkles,
  Cpu,
  Wand2,
  Check,
  Copy
} from 'lucide-react';
import { ProjectFile } from '../types/ide';

interface TouchCodeEditorProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, newContent: string) => void;
  onCreateFile: (path: string) => void;
  onAskAgentAboutFile: (agent: 'claude' | 'antigravity', file: ProjectFile) => void;
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
  onAskAgentAboutFile
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

  const getFileIcon = (path: string) => {
    if (path.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-400" />;
    if (path.endsWith('.html')) return <FileCode2 className="w-3.5 h-3.5 text-orange-400" />;
    if (path.endsWith('.css')) return <FileCode2 className="w-3.5 h-3.5 text-sky-400" />;
    return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b101d] border-r border-slate-800/80 overflow-hidden">
      {/* File Tabs Bar (Touch Scrollable) */}
      <div className="flex items-center justify-between bg-[#0e1526] border-b border-slate-800/80 px-2 py-1.5 gap-2 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {files.map((file) => {
            const isActive = file.path === activeFile?.path;
            return (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border border-transparent'
                }`}
              >
                {getFileIcon(file.path)}
                <span>{file.path}</span>
                {file.modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Modificato" />
                )}
              </button>
            );
          })}
          <button
            onClick={handleNewFilePrompt}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
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
      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#11182b] border-b border-slate-800/80 overflow-x-auto shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
          Touch Keys
        </span>
        {TOUCH_KEYS.map((k) => (
          <button
            key={k.label}
            onClick={() => handleInsertSymbol(k.insert)}
            className="px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-indigo-600/30 active:scale-95 border border-slate-700/70 text-slate-200 font-mono text-xs transition shrink-0"
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Code Editor Area */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-xs leading-6">
        {/* Line Numbers Gutter */}
        <div
          aria-hidden="true"
          className="w-11 py-3 bg-[#090d18] text-slate-600 text-right pr-2.5 select-none border-r border-slate-800/60 overflow-hidden shrink-0"
        >
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Editable Textarea */}
        <textarea
          ref={textareaRef}
          value={activeFile?.content || ''}
          onChange={(e) => activeFile && onUpdateFileContent(activeFile.path, e.target.value)}
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
          className="flex-1 w-full h-full p-3 bg-[#0b101d] text-slate-100 font-mono text-xs leading-6 resize-none focus:outline-none overflow-auto selection:bg-indigo-500/30"
          placeholder="Scrivi codice qui o chiedi a Claude / Antigravity..."
        />
      </div>

      {/* Editor Footer Status */}
      <div className="h-7 px-3 bg-[#090d18] border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span>
            File: <strong className="text-slate-200">{activeFile?.path}</strong>
          </span>
          <span>Righe: {lines.length}</span>
          <span>Caratteri: {activeFile?.content.length || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            {activeFile?.language}
          </span>
          <span className="text-emerald-400">● Auto-Saved Local</span>
        </div>
      </div>
    </div>
  );
};
