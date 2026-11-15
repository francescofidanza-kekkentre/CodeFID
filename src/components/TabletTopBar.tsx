import React from 'react';
import {
  Code2,
  Cpu,
  Download,
  Flame,
  FolderKanban,
  GitBranch,
  Columns3,
  Smartphone,
  Sparkles,
  ShieldCheck,
  SplitSquareVertical,
  Bot
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
  activeAgent: AgentId;
  onChangeAgent: (agent: AgentId) => void;
  pwaScore: number;
  onOpenPwaStudio: () => void;
  onOpenIntegrations: (tab: 'github' | 'firebase' | 'agents') => void;
  githubConfig: GitHubConfig;
  firebaseConfig: FirebaseConfig;
  bridgeConnected: boolean;
  onExportProject: () => void;
}

export const TabletTopBar: React.FC<TabletTopBarProps> = ({
  projects,
  activeProject,
  onSelectProject,
  layoutMode,
  onChangeLayout,
  activeAgent,
  onChangeAgent,
  pwaScore,
  onOpenPwaStudio,
  onOpenIntegrations,
  githubConfig,
  firebaseConfig,
  bridgeConnected,
  onExportProject
}) => {
  return (
    <header className="h-14 bg-[#0d1322]/95 border-b border-slate-800/80 px-3 flex items-center justify-between gap-2 select-none shrink-0 z-20">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600/20 to-sky-500/10 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl">
          <img
            src="./icon-192.png"
            alt="VisualFidCodingApp"
            className="w-7 h-7 rounded-lg shadow-md shadow-indigo-600/30"
          />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">
                VisualFidCodingApp
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Tablet PWA
              </span>
            </div>
          </div>
        </div>

        {/* Template / Project Switcher */}
        <div className="relative flex items-center">
          <FolderKanban className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <select
            aria-label="Seleziona Progetto PWA"
            value={activeProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 text-xs font-medium pl-8 pr-7 py-2 rounded-xl border border-slate-700/70 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center: Tablet Layout Mode Switcher */}
      <div className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => onChangeLayout('split-3')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            layoutMode === 'split-3'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Vista 3 Pannelli (Agent + Codice + Live PWA)"
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span>Studio 3-Vie</span>
        </button>
        <button
          onClick={() => onChangeLayout('code-preview')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            layoutMode === 'code-preview'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Editor Codice + Anteprima Tablet"
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>Codice + PWA</span>
        </button>
        <button
          onClick={() => onChangeLayout('agent-preview')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            layoutMode === 'agent-preview'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Agenti AI + Anteprima Live"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Agent + PWA</span>
        </button>
        <button
          onClick={() => onChangeLayout('preview-only')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
            layoutMode === 'preview-only'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Simulatore Tablet Schermo Intero"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Simulatore</span>
        </button>
      </div>

      {/* Right: Quick Agent Selector, PWA Score, GitHub & Firebase */}
      <div className="flex items-center gap-1.5">
        {/* Agent Quick Pill */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-800">
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

        {/* Export JSON Bundle */}
        <button
          onClick={onExportProject}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition"
          title="Esporta Progetto PWA (.json)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
