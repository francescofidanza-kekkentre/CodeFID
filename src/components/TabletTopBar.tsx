import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Code2,
  Cpu,
  Download,
  DownloadCloud,
  Eye,
  EyeOff,
  Flame,
  FolderCode,
  FolderKanban,
  GitBranch,
  GitCommitHorizontal,
  Columns3,
  Maximize2,
  Minimize2,
  Smartphone,
  Sparkles,
  ShieldCheck,
  SplitSquareVertical,
  Bot,
  Wand2
} from 'lucide-react';
import {
  AgentId,
  FirebaseConfig,
  GitHubConfig,
  PwaProject,
  TabletLayoutMode
} from '../types/ide';

interface TabletTopBarProps {
  projects: PwaProject[];
  activeProject: PwaProject;
  onSelectProject: (id: string) => void;
  layoutMode: TabletLayoutMode;
  onChangeLayout: (mode: TabletLayoutMode) => void;
  onTogglePreview?: () => void;
  activeAgent: AgentId;
  onChangeAgent: (agent: AgentId) => void;
  pwaScore: number;
  onOpenPwaStudio: () => void;
  onOpenIntegrations: (tab: 'github' | 'firebase' | 'agents') => void;
  onOpenCommitModal: () => void;
  onOpenSyncModal: () => void;
  githubConfig: GitHubConfig;
  firebaseConfig: FirebaseConfig;
  bridgeConnected: boolean;
  onExportProject: () => void;
  onOpenGuidedSetup: () => void;
}

export const TabletTopBar: React.FC<TabletTopBarProps> = ({
  projects,
  activeProject,
  onSelectProject,
  layoutMode,
  onChangeLayout,
  onTogglePreview,
  activeAgent,
  onChangeAgent,
  pwaScore,
  onOpenPwaStudio,
  onOpenIntegrations,
  onOpenCommitModal,
  onOpenSyncModal,
  githubConfig,
  firebaseConfig,
  bridgeConnected,
  onExportProject,
  onOpenGuidedSetup
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        if (root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: 'hide' });
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignore if fullscreen is blocked by the browser
    }
  };

  return (
    <header className="min-h-[48px] bg-[#181818] border-b border-[#2b2b2b] px-2.5 lg:px-3 py-1 flex items-center justify-between gap-2 select-none shrink-0 z-20 overflow-x-auto no-scrollbar">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#252526] border border-[#3c3c3c] px-2.5 py-1 rounded-md">
          <img
            src="./icon-192.png"
            alt="VisualFidCodingApp"
            className="w-6 h-6 rounded shrink-0"
          />
          <div className="leading-tight hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs tracking-tight text-[#cccccc]">
                VisualFidCodingApp
              </span>
              <span className="hidden 2xl:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#007acc]/20 text-[#3794ff] border border-[#007acc]/40">
                VS Code IDE
              </span>
            </div>
          </div>
        </div>

        {/* Template / Project Switcher */}
        <div className="flex items-center gap-1.5 bg-[#252526] hover:bg-[#2a2d2e] px-2.5 min-h-[36px] rounded-md border border-[#3c3c3c] focus-within:border-[#007acc] transition">
          <FolderKanban className="w-3.5 h-3.5 text-[#858585] shrink-0 pointer-events-none" />
          <select
            aria-label="Seleziona Progetto PWA"
            value={activeProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="max-w-[120px] lg:max-w-[170px] truncate appearance-none bg-transparent text-[#cccccc] text-xs font-medium py-1.5 pr-1 focus:outline-none cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#252526] text-[#cccccc]">
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#858585] shrink-0 pointer-events-none" />
        </div>
      </div>

      {/* Center: Tablet Layout Mode Switcher */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center bg-[#252526] p-0.5 rounded-md border border-[#3c3c3c]">
          <button
            onClick={() => onChangeLayout('code-agent')}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded text-xs font-medium transition ${
              layoutMode === 'code-agent'
                ? 'bg-[#007acc] text-white shadow-sm'
                : 'text-[#969696] hover:text-[#cccccc]'
            }`}
            title="Vista Cartelle + Codice + Agente (Senza Anteprima App)"
          >
            <FolderCode className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Cartelle + Codice + Agente</span>
            <span className="hidden md:inline xl:hidden">Codice + Agente</span>
          </button>
          <button
            onClick={() => onChangeLayout('split-3')}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded text-xs font-medium transition ${
              layoutMode === 'split-3'
                ? 'bg-[#007acc] text-white'
                : 'text-[#969696] hover:text-[#cccccc]'
            }`}
            title="Studio 3-Vie con Anteprima (Agente + Codice + Live PWA)"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Studio + PWA</span>
          </button>
          <button
            onClick={() => onChangeLayout('code-preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded text-xs font-medium transition ${
              layoutMode === 'code-preview'
                ? 'bg-[#007acc] text-white'
                : 'text-[#969696] hover:text-[#cccccc]'
            }`}
            title="Editor Codice + Anteprima Tablet"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Codice + PWA</span>
          </button>
          <button
            onClick={() => onChangeLayout('agent-preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded text-xs font-medium transition ${
              layoutMode === 'agent-preview'
                ? 'bg-[#007acc] text-white'
                : 'text-[#969696] hover:text-[#cccccc]'
            }`}
            title="Agenti AI + Anteprima Live"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Agent + PWA</span>
          </button>
          <button
            onClick={() => onChangeLayout('preview-only')}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded text-xs font-medium transition ${
              layoutMode === 'preview-only'
                ? 'bg-[#007acc] text-white'
                : 'text-[#969696] hover:text-[#cccccc]'
            }`}
            title="Simulatore Tablet Schermo Intero"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Simulatore</span>
          </button>
        </div>

        {/* Quick Toggle Anteprima App */}
        {onTogglePreview && (
          <button
            onClick={onTogglePreview}
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-md text-xs font-medium border transition ${
              layoutMode === 'code-agent'
                ? 'bg-[#252526] hover:bg-[#2a2d2e] text-[#969696] hover:text-white border-[#3c3c3c]'
                : 'bg-[#007acc]/20 text-[#3794ff] border-[#007acc]/40 hover:bg-[#007acc]/30'
            }`}
            title={
              layoutMode === 'code-agent'
                ? 'Mostra Anteprima App (Passa a Studio + PWA)'
                : "Nascondi Anteprima App (Mostra Cartelle, Codice e Agente)"
            }
          >
            {layoutMode === 'code-agent' ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline">Mostra Anteprima</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span className="hidden 2xl:inline">Nascondi Anteprima</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Right: Quick Agent Selector, PWA Score, GitHub & Firebase */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Agent Quick Pill (shown on 12"-14" landscape xl+, AgentStudioPanel has cards on smaller widths) */}
        <div className="hidden xl:flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-800">
          <button
            onClick={() => onChangeAgent('antigravity')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              activeAgent === 'antigravity'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Antigravity</span>
          </button>
          <button
            onClick={() => onChangeAgent('claude')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              activeAgent === 'claude'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Claude</span>
          </button>
          <button
            onClick={() => onChangeAgent('swarm')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              activeAgent === 'swarm'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Swarm</span>
          </button>
        </div>

        {/* PWA Audit & Manifest Builder Button */}
        <button
          onClick={onOpenPwaStudio}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
          title="Apri PWA Manifest, Service Worker & Audit Studio"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>PWA {pwaScore}%</span>
        </button>

        {/* Dedicated Commit Button */}
        <button
          onClick={onOpenCommitModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition"
          title="Esegui Commit & Push su GitHub"
        >
          <GitCommitHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Commit</span>
        </button>

        {/* Dedicated Sync (Pull) Button */}
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-semibold transition"
          title="Sync (Pull) da GitHub"
        >
          <DownloadCloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sync</span>
        </button>

        {/* GitHub Integration Button */}
        <button
          onClick={() => onOpenIntegrations('github')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
            githubConfig.connected
              ? 'bg-slate-800 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
          }`}
          title="Integrazione GitHub (Clone, Commit, Push, Pages)"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">GitHub</span>
          <span
            className={`w-2 h-2 rounded-full ${
              githubConfig.connected ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          />
        </button>

        {/* Firebase Integration Button */}
        <button
          onClick={() => onOpenIntegrations('firebase')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
            firebaseConfig.connected
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
          }`}
          title="Integrazione Firebase (Firestore Cloud Sync & Hosting)"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Firebase</span>
          <span
            className={`w-2 h-2 rounded-full ${
              firebaseConfig.connected ? 'bg-amber-400' : 'bg-slate-600'
            }`}
          />
        </button>

        {/* API Keys / CLI Bridge Config */}
        <button
          onClick={() => onOpenIntegrations('agents')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-medium transition"
          title="Configura API Keys Claude / Antigravity e CLI Bridge"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              bridgeConnected ? 'bg-sky-400 animate-pulse' : 'bg-indigo-400'
            }`}
          />
          <span className="hidden lg:inline">API & Bridge</span>
        </button>

        {/* Guided Setup Wizard */}
        <button
          onClick={onOpenGuidedSetup}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#007acc] hover:bg-[#1f8ad2] text-white text-xs font-medium transition"
          title="Modalità guidata per collegare Agente IA e GitHub"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Setup Guidato</span>
        </button>

        {/* Android / Tablet Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className={`p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md border transition ${
            isFullscreen
              ? 'bg-[#007acc] border-[#007acc] text-white'
              : 'bg-[#252526] hover:bg-[#2a2d2e] border-[#3c3c3c] text-[#cccccc]'
          }`}
          title={isFullscreen ? 'Esci da Tutto Schermo' : 'Modalità Tutto Schermo (Android)'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Export JSON Bundle */}
        <button
          onClick={onExportProject}
          className="p-2 rounded-md bg-[#252526] hover:bg-[#2a2d2e] border border-[#3c3c3c] text-[#cccccc] transition"
          title="Esporta Progetto PWA (.json)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
