import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Cpu,
  DownloadCloud,
  ExternalLink,
  Flame,
  FolderGit2,
  GitBranch,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import {
  AgentConfig,
  FirebaseConfig,
  GitHubConfig,
  ProjectFile,
  PwaProject
} from '../types/ide';
import {
  createGitHubRepo,
  GitHubRepoSummary,
  listUserRepos,
  pullRepoFilesFromGitHub,
  pushProjectToGitHub,
  verifyGitHubToken
} from '../services/githubService';
import {
  injectFirebaseHostingFiles,
  loadProjectFromFirestore,
  saveProjectToFirestore
} from '../services/firebaseService';
import {
  CLAUDE_MODELS,
  DEFAULT_ANTIGRAVITY_MODELS
} from '../services/agentEngine';

interface IntegrationsDrawerProps {
  isOpen: boolean;
  activeTab: 'github' | 'firebase' | 'agents';
  onChangeTab: (tab: 'github' | 'firebase' | 'agents') => void;
  onClose: () => void;
  githubConfig: GitHubConfig;
  onUpdateGitHub: (next: GitHubConfig) => void;
  firebaseConfig: FirebaseConfig;
  onUpdateFirebase: (next: FirebaseConfig) => void;
  agentConfig: AgentConfig;
  onUpdateAgentConfig: (next: AgentConfig) => void;
  activeProject: PwaProject;
  onReplaceProjectFiles: (files: ProjectFile[], statusNotice?: string) => void;
  onTestBridge: () => Promise<void>;
  bridgeToolsStatus: Record<string, any> | null;
  onOpenGuidedSetup?: (step: 'agent' | 'github') => void;
}

export const IntegrationsDrawer: React.FC<IntegrationsDrawerProps> = ({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  githubConfig,
  onUpdateGitHub,
  firebaseConfig,
  onUpdateFirebase,
  agentConfig,
  onUpdateAgentConfig,
  activeProject,
  onReplaceProjectFiles,
  onTestBridge,
  bridgeToolsStatus,
  onOpenGuidedSetup
}) => {
  const [ghLoading, setGhLoading] = useState(false);
  const [ghStatus, setGhStatus] = useState<string>('');
  const [ghError, setGhError] = useState<string>('');
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [commitMessage, setCommitMessage] = useState(
    'feat(pwa): update PWA from CodeFID Tablet IDE'
  );
  const [newRepoName, setNewRepoName] = useState('');

  const [fbLoading, setFbLoading] = useState(false);
  const [fbStatus, setFbStatus] = useState<string>('');
  const [fbError, setFbError] = useState<string>('');

  if (!isOpen) return null;

  // GitHub handlers
  const handleConnectGitHub = async () => {
    if (!githubConfig.token.trim()) {
      setGhError('Inserisci un Personal Access Token di GitHub.');
      return;
    }
    setGhLoading(true);
    setGhError('');
    setGhStatus('');
    try {
      const user = await verifyGitHubToken(githubConfig.token);
      const userRepos = await listUserRepos(githubConfig.token);
      setRepos(userRepos);
      onUpdateGitHub({
        ...githubConfig,
        username: user.login,
        avatarUrl: user.avatar_url,
        selectedRepo:
          githubConfig.selectedRepo || userRepos[0]?.full_name || '',
        branch:
          githubConfig.branch || userRepos[0]?.default_branch || 'main',
        connected: true
      });
      setGhStatus(
        `Connesso come @${user.login} (${userRepos.length} repository trovati).`
      );
    } catch (err: any) {
      setGhError(err.message || 'Errore di connessione a GitHub');
    } finally {
      setGhLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setGhLoading(true);
    setGhError('');
    try {
      const created = await createGitHubRepo(
        githubConfig.token,
        newRepoName.trim(),
        activeProject.description || 'PWA creata con CodeFID Tablet Studio'
      );
      setRepos((prev) => [created, ...prev]);
      onUpdateGitHub({
        ...githubConfig,
        selectedRepo: created.full_name,
        branch: created.default_branch || 'main'
      });
      setNewRepoName('');
      setGhStatus(`Repository ${created.full_name} creato con successo!`);
    } catch (err: any) {
      setGhError(err.message || 'Impossibile creare il repository');
    } finally {
      setGhLoading(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (!githubConfig.selectedRepo) {
      setGhError('Seleziona o inserisci il nome completo del repository (es. user/repo).');
      return;
    }
    setGhLoading(true);
    setGhError('');
    setGhStatus('');
    try {
      const res = await pushProjectToGitHub({
        token: githubConfig.token,
        repoFullName: githubConfig.selectedRepo,
        branch: githubConfig.branch || 'main',
        commitMessage: commitMessage || 'Update PWA files',
        files: activeProject.files
      });
      onUpdateGitHub({
        ...githubConfig,
        lastSync: new Date().toLocaleTimeString()
      });
      setGhStatus(
        `Push completato! ${res.committedCount} file inviati a ${githubConfig.selectedRepo} (${githubConfig.branch}).`
      );
    } catch (err: any) {
      setGhError(err.message || 'Errore durante il push su GitHub');
    } finally {
      setGhLoading(false);
    }
  };

  const handlePullFromGitHub = async () => {
    if (!githubConfig.selectedRepo) {
      setGhError('Seleziona un repository da cui importare i file.');
      return;
    }
    setGhLoading(true);
    setGhError('');
    setGhStatus('');
    try {
      const pulled = await pullRepoFilesFromGitHub({
        token: githubConfig.token,
        repoFullName: githubConfig.selectedRepo,
        branch: githubConfig.branch || 'main'
      });
      onReplaceProjectFiles(
        pulled,
        `Importati ${pulled.length} file da GitHub (${githubConfig.selectedRepo})`
      );
      setGhStatus(`Importati ${pulled.length} file nel workspace del tablet!`);
    } catch (err: any) {
      setGhError(err.message || 'Errore durante il pull da GitHub');
    } finally {
      setGhLoading(false);
    }
  };

  // Firebase handlers
  const handleSaveToFirestore = async () => {
    setFbLoading(true);
    setFbError('');
    setFbStatus('');
    try {
      const res = await saveProjectToFirestore(firebaseConfig, activeProject);
      onUpdateFirebase({
        ...firebaseConfig,
        connected: true,
        lastCloudSave: res.savedAt
      });
      setFbStatus(
        `Progetto "${activeProject.name}" salvato su Cloud Firestore alle ${res.savedAt}!`
      );
    } catch (err: any) {
      setFbError(err.message || 'Errore salvataggio su Firestore');
    } finally {
      setFbLoading(false);
    }
  };

  const handleLoadFromFirestore = async () => {
    setFbLoading(true);
    setFbError('');
    setFbStatus('');
    try {
      const loaded = await loadProjectFromFirestore(
        firebaseConfig,
        activeProject.id
      );
      if (loaded && loaded.files.length > 0) {
        onReplaceProjectFiles(
          loaded.files,
          `Progetto ripristinato da Cloud Firestore`
        );
        setFbStatus(
          `Caricati ${loaded.files.length} file da Cloud Firestore!`
        );
      }
    } catch (err: any) {
      setFbError(err.message || 'Impossibile caricare da Firestore');
    } finally {
      setFbLoading(false);
    }
  };

  const handleInjectFirebaseFiles = () => {
    const updated = injectFirebaseHostingFiles(
      activeProject.files,
      firebaseConfig
    );
    onUpdateFirebase({
      ...firebaseConfig,
      connected: Boolean(firebaseConfig.projectId.trim())
    });
    onReplaceProjectFiles(
      updated,
      'Aggiunti firebase.json, .firebaserc e firebaseConfig.js al progetto'
    );
    setFbStatus(
      'File firebase.json, .firebaserc e firebaseConfig.js generati ed aggiunti al progetto!'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1526] border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header with Tabs */}
        <div className="px-5 py-3.5 bg-[#090d18] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeTab('github')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'github'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>GitHub Sync & Pages</span>
            </button>
            <button
              onClick={() => onChangeTab('firebase')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'firebase'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Firebase & Firestore</span>
            </button>
            <button
              onClick={() => onChangeTab('agents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'agents'
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Claude & Antigravity Config</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGuidedSetup && activeTab !== 'firebase' && (
              <button
                onClick={() =>
                  onOpenGuidedSetup(activeTab === 'github' ? 'github' : 'agent')
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Modalità Guidata</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* TAB 1: GITHUB */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-sm text-white">
                      Autenticazione GitHub REST API v3
                    </span>
                  </div>
                  {githubConfig.connected && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                      ● Connesso come @{githubConfig.username}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={githubConfig.token}
                    onChange={(e) =>
                      onUpdateGitHub({ ...githubConfig, token: e.target.value })
                    }
                    placeholder="Personal Access Token (ghp_... oppure github_pat_... con permessi repo)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <button
                    onClick={handleConnectGitHub}
                    disabled={ghLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    {ghLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Verifica & Carica Repo</span>
                  </button>
                </div>
              </div>

              {/* Repo Selection & Creation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="font-semibold text-slate-200">
                    Repository & Branch Destinazione
                  </div>

                  {repos.length > 0 ? (
                    <select
                      value={githubConfig.selectedRepo}
                      onChange={(e) =>
                        onUpdateGitHub({
                          ...githubConfig,
                          selectedRepo: e.target.value
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {repos.map((r) => (
                        <option key={r.id} value={r.full_name}>
                          {r.full_name} ({r.default_branch})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={githubConfig.selectedRepo}
                      onChange={(e) =>
                        onUpdateGitHub({
                          ...githubConfig,
                          selectedRepo: e.target.value
                        })
                      }
                      placeholder="username/nome-repository"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Branch:</span>
                    <input
                      type="text"
                      value={githubConfig.branch}
                      onChange={(e) =>
                        onUpdateGitHub({
                          ...githubConfig,
                          branch: e.target.value
                        })
                      }
                      placeholder="main"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Create New Repo */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="font-semibold text-slate-200">
                    Oppure Crea Nuovo Repository PWA
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      placeholder="nome-nuova-pwa-tablet"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    <button
                      onClick={handleCreateRepo}
                      disabled={ghLoading || !githubConfig.token.trim()}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crea</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inizializza automaticamente il repository su GitHub pronto per GitHub Pages.
                  </p>
                </div>
              </div>

              {/* Commit & Push / Pull Actions */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="font-semibold text-slate-200">
                  Commit & Push / Importa File ({activeProject.files.length} file nel progetto)
                </div>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Messaggio di commit..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePushToGitHub}
                    disabled={ghLoading || !githubConfig.token.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>Commit & Push Tutti i File su GitHub</span>
                  </button>
                  <button
                    onClick={handlePullFromGitHub}
                    disabled={ghLoading || !githubConfig.token.trim()}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold flex items-center justify-center gap-2"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>Pull / Clona nel Tablet</span>
                  </button>
                </div>
              </div>

              {ghStatus && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{ghStatus}</span>
                </div>
              )}
              {ghError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200">
                  {ghError}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FIREBASE */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm text-white">
                      Configurazione Progetto Firebase (Firestore + Hosting)
                    </span>
                  </div>
                  {firebaseConfig.lastCloudSave && (
                    <span className="text-[11px] text-amber-300">
                      Ultimo salvataggio Cloud: {firebaseConfig.lastCloudSave}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Firebase Project ID *
                    </label>
                    <input
                      type="text"
                      value={firebaseConfig.projectId}
                      onChange={(e) =>
                        onUpdateFirebase({
                          ...firebaseConfig,
                          projectId: e.target.value,
                          connected: Boolean(e.target.value.trim())
                        })
                      }
                      placeholder="es. codefid-tablet-pwa"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Web API Key (AIza...)
                    </label>
                    <input
                      type="password"
                      value={firebaseConfig.apiKey}
                      onChange={(e) =>
                        onUpdateFirebase({
                          ...firebaseConfig,
                          apiKey: e.target.value
                        })
                      }
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={firebaseConfig.appId}
                      onChange={(e) =>
                        onUpdateFirebase({
                          ...firebaseConfig,
                          appId: e.target.value
                        })
                      }
                      placeholder="1:123456789:web:abcdef"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Auth Domain
                    </label>
                    <input
                      type="text"
                      value={firebaseConfig.authDomain}
                      onChange={(e) =>
                        onUpdateFirebase({
                          ...firebaseConfig,
                          authDomain: e.target.value
                        })
                      }
                      placeholder="progetto.firebaseapp.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <button
                  onClick={handleSaveToFirestore}
                  disabled={fbLoading}
                  className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-2 transition"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Salva PWA su Firestore</span>
                </button>
                <button
                  onClick={handleLoadFromFirestore}
                  disabled={fbLoading}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold flex items-center justify-center gap-2 transition"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Carica da Firestore</span>
                </button>
                <button
                  onClick={handleInjectFirebaseFiles}
                  className="p-3 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/35 border border-indigo-500/40 text-indigo-200 font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Inietta firebase.json + SDK</span>
                </button>
              </div>

              {fbStatus && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{fbStatus}</span>
                </div>
              )}
              {fbError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200">
                  {fbError}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLAUDE & ANTIGRAVITY AGENTS + CLI BRIDGE */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              {/* Claude Config */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm text-white">
                    Anthropic Claude Agent (BYOK Browser-Direct o Motore Integrato)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Anthropic API Key (Opzionale)
                    </label>
                    <input
                      type="password"
                      value={agentConfig.claudeApiKey}
                      onChange={(e) =>
                        onUpdateAgentConfig({
                          ...agentConfig,
                          claudeApiKey: e.target.value
                        })
                      }
                      placeholder="sk-ant-api03-... (lascia vuoto per motore istantaneo)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Modello Claude
                    </label>
                    <select
                      value={agentConfig.claudeModel}
                      onChange={(e) =>
                        onUpdateAgentConfig({
                          ...agentConfig,
                          claudeModel: e.target.value
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {CLAUDE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Antigravity / Gemini Config */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-sm text-white">
                    Google Antigravity / Gemini Agent
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Gemini / Antigravity API Key (Opzionale)
                    </label>
                    <input
                      type="password"
                      value={agentConfig.geminiApiKey}
                      onChange={(e) =>
                        onUpdateAgentConfig({
                          ...agentConfig,
                          geminiApiKey: e.target.value
                        })
                      }
                      placeholder="AIzaSy... (lascia vuoto per motore integrato)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Modello Antigravity
                    </label>
                    <select
                      value={agentConfig.antigravityModel}
                      onChange={(e) =>
                        onUpdateAgentConfig({
                          ...agentConfig,
                          antigravityModel: e.target.value
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {DEFAULT_ANTIGRAVITY_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          Antigravity {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Local / Remote CLI Bridge */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-sm text-white">
                      Bridge Terminale CLI (Antigravity `agy` & `claude` CLI)
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      agentConfig.bridgeConnected
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {agentConfig.bridgeConnected
                      ? '● Bridge Connesso'
                      : '○ Bridge Non Connesso'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agentConfig.bridgeUrl}
                    onChange={(e) =>
                      onUpdateAgentConfig({
                        ...agentConfig,
                        bridgeUrl: e.target.value
                      })
                    }
                    placeholder="http://localhost:8787"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <button
                    onClick={onTestBridge}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    Testa Bridge
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Avvia il bridge con <code>npm run bridge</code> per eseguire comandi terminali reali dal tablet (prefissa con <code>!comando</code> nella chat Agenti, es. <code>!git status</code>).
                </p>

                {bridgeToolsStatus && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Antigravity CLI</div>
                      <div className="font-semibold text-emerald-400">
                        {bridgeToolsStatus.antigravityCli ? 'Rilevato' : 'Non presente'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Claude CLI</div>
                      <div className="font-semibold text-amber-300">
                        {bridgeToolsStatus.claudeCli ? 'Rilevato' : 'Standby'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Git CLI</div>
                      <div className="font-semibold text-indigo-300">
                        {bridgeToolsStatus.gitCli ? 'Attivo' : 'Assente'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Runtime Node</div>
                      <div className="font-semibold text-slate-200">
                        {bridgeToolsStatus.nodeVersion || 'v24'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
