import React from 'react';
import { Bot, GitBranch, ShieldCheck } from 'lucide-react';
import { AgentId, GitHubConfig, ProjectFile } from '../types/ide';

interface VsCodeStatusBarProps {
  githubConfig: GitHubConfig;
  activeFile?: ProjectFile;
  activeAgent: AgentId;
  pwaScore: number;
  bridgeConnected: boolean;
  onOpenGitHub: () => void;
  onOpenPwaStudio: () => void;
  onOpenAgents: () => void;
}

/**
 * Iconic VS Code bottom status bar displaying branch, PWA score,
 * active AI agent, and current file metadata.
 */
export const VsCodeStatusBar: React.FC<VsCodeStatusBarProps> = ({
  githubConfig,
  activeFile,
  activeAgent,
  pwaScore,
  bridgeConnected,
  onOpenGitHub,
  onOpenPwaStudio,
  onOpenAgents
}) => {
  const lineCount = activeFile ? activeFile.content.split('\n').length : 0;

  return (
    <footer className="h-6 bg-[#007acc] text-white text-[11px] flex items-center justify-between px-2 select-none shrink-0 z-20 overflow-x-auto no-scrollbar">
      {/* Left items */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onOpenGitHub}
          className="flex items-center gap-1.5 px-2 h-6 hover:bg-white/15 transition"
          title="GitHub Sync & Branch"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="font-medium">
            {githubConfig.connected
              ? `${githubConfig.selectedRepo || `@${githubConfig.username}`} (${githubConfig.branch || 'main'})`
              : 'GitHub: Non collegato'}
          </span>
        </button>

        <button
          onClick={onOpenPwaStudio}
          className="flex items-center gap-1 px-2 h-6 hover:bg-white/15 transition"
          title="PWA Audit"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PWA {pwaScore}%</span>
        </button>
      </div>

      {/* Right items */}
      <div className="flex items-center gap-1 shrink-0">
        {activeFile && (
          <>
            <span className="px-2 hidden sm:inline">
              Righe: {lineCount}
            </span>
            <span className="px-2 hidden md:inline">UTF-8</span>
            <span className="px-2 uppercase font-medium">
              {activeFile.language}
            </span>
          </>
        )}

        <button
          onClick={onOpenAgents}
          className="flex items-center gap-1 px-2 h-6 hover:bg-white/15 transition font-medium"
          title="Configura Agente IA e Bridge"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="uppercase">{activeAgent}</span>
          {bridgeConnected && (
            <span className="hidden sm:inline opacity-90">• Bridge</span>
          )}
        </button>
      </div>
    </footer>
  );
};
