import React from 'react';
import {
  Bot,
  ChevronDown,
  Files,
  Flame,
  GitBranch,
  Plus,
  Settings,
  ShieldCheck,
  Tablet,
  TerminalSquare,
  Wand2
} from 'lucide-react';
import { ProjectFile } from '../types/ide';
import { renderFileIcon } from '../utils/fileHelpers';

interface VsCodeActivityBarProps {
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  files: ProjectFile[];
  activeFilePath: string;
  projectName: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onOpenGitHub: () => void;
  onOpenFirebase: () => void;
  onOpenPwaStudio: () => void;
  onOpenSettings: () => void;
  onOpenGuidedSetup: () => void;
  onFocusAgents: () => void;
  onFocusPreview: () => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  githubConnected: boolean;
}

/**
 * VS Code-style left Activity Bar and collapsible File Explorer sidebar,
 * sized with touch-friendly targets for 10"–14" tablets.
 */
export const VsCodeActivityBar: React.FC<VsCodeActivityBarProps> = ({
  explorerOpen,
  onToggleExplorer,
  files,
  activeFilePath,
  projectName,
  onSelectFile,
  onCreateFile,
  onOpenGitHub,
  onOpenFirebase,
  onOpenPwaStudio,
  onOpenSettings,
  onOpenGuidedSetup,
  onFocusAgents,
  onFocusPreview,
  terminalOpen,
  onToggleTerminal,
  githubConnected
}) => {
  const handleNewFilePrompt = () => {
    const name = window.prompt(
      'Nome del nuovo file (es. index.html, styles.css, app.js):',
      'index.html'
    );
    if (!name || !name.trim()) return;
    onCreateFile(name.trim());
  };

  return (
    <div className="flex h-full shrink-0 select-none">
      {/* Iconic VS Code Activity Bar */}
      <aside className="w-12 bg-[#181818] border-r border-[#2b2b2b] flex flex-col items-center justify-between py-1.5 shrink-0">
        <div className="flex flex-col items-center w-full gap-1">
          <button
            onClick={onToggleExplorer}
            title="Explorer File"
            className={`w-full h-11 flex items-center justify-center relative transition ${
              explorerOpen
                ? 'text-white border-l-2 border-[#007acc]'
                : 'text-[#858585] hover:text-white border-l-2 border-transparent'
            }`}
          >
            <Files className="w-5 h-5" />
          </button>

          <button
            onClick={onFocusAgents}
            title="AI Agent Chat"
            className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-white border-l-2 border-transparent transition"
          >
            <Bot className="w-5 h-5" />
          </button>

          <button
            onClick={onFocusPreview}
            title="Anteprima Tablet Live"
            className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-white border-l-2 border-transparent transition"
          >
            <Tablet className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenGitHub}
            title="Controllo Sorgente (GitHub)"
            className="w-full h-11 flex items-center justify-center relative text-[#858585] hover:text-white border-l-2 border-transparent transition"
          >
            <GitBranch className="w-5 h-5" />
            {githubConnected && (
              <span className="absolute bottom-2 right-2.5 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={onOpenFirebase}
            title="Firebase & Firestore"
            className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-white border-l-2 border-transparent transition"
          >
            <Flame className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenPwaStudio}
            title="PWA Studio & Audit"
            className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-white border-l-2 border-transparent transition"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleTerminal}
            title="Terminale Integrato"
            className={`w-full h-11 flex items-center justify-center relative transition ${
              terminalOpen
                ? 'text-white border-l-2 border-[#007acc]'
                : 'text-[#858585] hover:text-white border-l-2 border-transparent'
            }`}
          >
            <TerminalSquare className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center w-full gap-1">
          <button
            onClick={onOpenGuidedSetup}
            title="Configurazione Guidata IA & GitHub"
            className="w-full h-11 flex items-center justify-center text-[#3794ff] hover:text-white transition"
          >
            <Wand2 className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Impostazioni API & Bridge"
            className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-white transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Collapsible Explorer Sidebar */}
      {explorerOpen && (
        <div className="w-52 lg:w-56 bg-[#181818] border-r border-[#2b2b2b] flex flex-col h-full overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between text-[11px] font-semibold tracking-wider text-[#bbbbbb] uppercase border-b border-[#2b2b2b] shrink-0">
            <span>Explorer</span>
            <button
              onClick={handleNewFilePrompt}
              title="Nuovo File"
              className="p-1 rounded hover:bg-[#2a2d2e] text-[#cccccc] hover:text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-2 py-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#cccccc] bg-[#1f1f1f] border-b border-[#2b2b2b] shrink-0">
            <ChevronDown className="w-3.5 h-3.5 text-[#858585] shrink-0" />
            <span className="truncate">{projectName}</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 ? (
              <div className="p-3 text-center space-y-2.5">
                <p className="text-[11px] text-[#858585]">
                  Nessun file nel workspace.
                </p>
                <button
                  onClick={handleNewFilePrompt}
                  className="w-full py-1.5 px-2.5 rounded bg-[#007acc] hover:bg-[#1f8ad2] text-white text-[11px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuovo File</span>
                </button>
              </div>
            ) : (
              files.map((file) => {
                const isActive = file.path === activeFilePath;
                return (
                  <button
                    key={file.path}
                    onClick={() => onSelectFile(file.path)}
                    className={`w-full px-3 py-1.5 min-h-[34px] flex items-center justify-between gap-2 text-xs text-left transition ${
                      isActive
                        ? 'bg-[#04395e] text-white'
                        : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderFileIcon(file.path)}
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.modified && (
                      <span
                        className="text-[10px] font-bold text-[#e2c08d] shrink-0"
                        title="Modificato"
                      >
                        M
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
