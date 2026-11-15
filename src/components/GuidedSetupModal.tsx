import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  DownloadCloud,
  ExternalLink,
  FolderGit2,
  GitBranch,
  KeyRound,
  Loader2,
  Plus,
  Server,
  Sparkles,
  Users,
  Wand2,
  X
} from 'lucide-react';
import {
  AgentConfig,
  AgentId,
  GitHubConfig,
  ProjectFile,
  PwaProject
} from '../types/ide';
import {
  createGitHubRepo,
  GitHubRepoSummary,
  listUserRepos,
  pullRepoFilesFromGitHub,
  verifyGitHubToken
} from '../services/githubService';

export type GuidedStep = 'agent' | 'github' | 'summary';

interface GuidedSetupModalProps {
  isOpen: boolean;
  initialStep?: GuidedStep;
  onClose: () => void;
  agentConfig: AgentConfig;
  onUpdateAgentConfig: (next: AgentConfig) => void;
  githubConfig: GitHubConfig;
  onUpdateGitHub: (next: GitHubConfig) => void;
  activeProject: PwaProject;
  onReplaceProjectFiles: (files: ProjectFile[], statusNotice?: string) => void;
  onTestBridge: () => Promise<void>;
  bridgeToolsStatus: Record<string, any> | null;
}

type AgentConnectionMode = 'byok' | 'bridge' | 'builtin';

const STEPS: { id: GuidedStep; number: number; label: string }[] = [
  { id: 'agent', number: 1, label: 'Agente IA' },
  { id: 'github', number: 2, label: 'GitHub' },
  { id: 'summary', number: 3, label: 'Riepilogo' }
];

/**
 * Step-by-step guided setup wizard for connecting an AI Agent (BYOK, CLI Bridge, or built-in)
 * and a GitHub account/repository.
 */
export const GuidedSetupModal: React.FC<GuidedSetupModalProps> = ({
  isOpen,
  initialStep = 'agent',
  onClose,
  agentConfig,
  onUpdateAgentConfig,
  githubConfig,
  onUpdateGitHub,
  activeProject,
  onReplaceProjectFiles,
  onTestBridge,
  bridgeToolsStatus
}) => {
  const [step, setStep] = useState<GuidedStep>(initialStep);
  const [agentMode, setAgentMode] = useState<AgentConnectionMode>(() => {
    if (agentConfig.bridgeConnected) return 'bridge';
    if (agentConfig.claudeApiKey || agentConfig.geminiApiKey) return 'byok';
    return 'byok';
  });
  const [bridgeTesting, setBridgeTesting] = useState(false);

  const [ghLoading, setGhLoading] = useState(false);
  const [ghStatus, setGhStatus] = useState('');
  const [ghError, setGhError] = useState('');
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [repoAction, setRepoAction] = useState<'existing' | 'new'>('existing');
  const [newRepoName, setNewRepoName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const handleSelectAgent = (agent: AgentId) => {
    onUpdateAgentConfig({ ...agentConfig, activeAgent: agent });
  };

  const handleTestBridge = async () => {
    setBridgeTesting(true);
    try {
      await onTestBridge();
    } finally {
      setBridgeTesting(false);
    }
  };

  const handleVerifyGitHub = async () => {
    if (!githubConfig.token.trim()) {
      setGhError('Incolla prima il Personal Access Token di GitHub.');
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
        `Account @${user.login} verificato (${userRepos.length} repository trovati).`
      );
    } catch (err: any) {
      setGhError(err.message || 'Impossibile verificare il token GitHub.');
    } finally {
      setGhLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim() || !githubConfig.token.trim()) return;
    setGhLoading(true);
    setGhError('');
    setGhStatus('');
    try {
      const created = await createGitHubRepo(
        githubConfig.token,
        newRepoName.trim(),
        activeProject.description || 'PWA creata con VisualFidCodingApp'
      );
      setRepos((prev) => [created, ...prev]);
      onUpdateGitHub({
        ...githubConfig,
        selectedRepo: created.full_name,
        branch: created.default_branch || 'main',
        connected: true
      });
      setNewRepoName('');
      setRepoAction('existing');
      setGhStatus(`Repository ${created.full_name} creato e collegato!`);
    } catch (err: any) {
      setGhError(err.message || 'Errore durante la creazione del repository.');
    } finally {
      setGhLoading(false);
    }
  };

  const handlePullRepo = async () => {
    if (!githubConfig.selectedRepo || !githubConfig.token.trim()) return;
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
        `Importati ${pulled.length} file da ${githubConfig.selectedRepo}`
      );
      setGhStatus(
        `Importati ${pulled.length} file da ${githubConfig.selectedRepo} nel workspace.`
      );
    } catch (err: any) {
      setGhError(err.message || 'Errore durante il pull dei file da GitHub.');
    } finally {
      setGhLoading(false);
    }
  };

  const hasCloudKey = Boolean(
    agentConfig.claudeApiKey.trim() || agentConfig.geminiApiKey.trim()
  );
  const aiStatusText = agentConfig.bridgeConnected
    ? `CLI Bridge attivo (${agentConfig.bridgeUrl})`
    : hasCloudKey
    ? 'API Key Cloud configurata (BYOK)'
    : 'Motore integrato pronto';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1526] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-[#090d18] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Configurazione Guidata
              </h2>
              <p className="text-[11px] text-slate-400">
                Collega Agente IA e GitHub passo dopo passo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi configurazione guidata"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-3 bg-[#0b101d] border-b border-slate-800/80 flex items-center gap-2">
          {STEPS.map((s, idx) => {
            const isActive = s.id === step;
            const isDone = idx < currentStepIndex;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isDone
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-black/25 flex items-center justify-center text-[10px]">
                    {isDone ? '✓' : s.number}
                  </span>
                  <span>{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-slate-800" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* STEP 1: AI AGENT */}
          {step === 'agent' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  1. Scegli l&apos;Agente IA predefinito
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Puoi cambiare agente in qualsiasi momento dalla barra superiore.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => handleSelectAgent('antigravity')}
                  className={`p-3 rounded-xl border text-left transition ${
                    agentConfig.activeAgent === 'antigravity'
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-100'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    <span>Antigravity</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Architettura PWA, Service Worker e cloud.
                  </p>
                </button>

                <button
                  onClick={() => handleSelectAgent('claude')}
                  className={`p-3 rounded-xl border text-left transition ${
                    agentConfig.activeAgent === 'claude'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Claude</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    UI touch, CSS e componenti interattivi.
                  </p>
                </button>

                <button
                  onClick={() => handleSelectAgent('swarm')}
                  className={`p-3 rounded-xl border text-left transition ${
                    agentConfig.activeAgent === 'swarm'
                      ? 'bg-purple-500/15 border-purple-500/50 text-purple-100'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>Swarm</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Antigravity + Claude insieme sui file.
                  </p>
                </button>
              </div>

              <div className="pt-1">
                <h3 className="text-sm font-bold text-white mb-2">
                  2. Modalità di collegamento
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAgentMode('byok')}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                      agentMode === 'byok'
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    API Key Cloud
                  </button>
                  <button
                    onClick={() => setAgentMode('bridge')}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                      agentMode === 'bridge'
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CLI Bridge Locale
                  </button>
                  <button
                    onClick={() => setAgentMode('builtin')}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                      agentMode === 'builtin'
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Motore Integrato
                  </button>
                </div>
              </div>

              {agentMode === 'byok' && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      Chiavi API (salvate solo in locale nel browser)
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400">
                          Gemini / Antigravity API Key
                        </label>
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <span>Ottieni chiave</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input
                        type="password"
                        value={agentConfig.geminiApiKey}
                        onChange={(e) =>
                          onUpdateAgentConfig({
                            ...agentConfig,
                            geminiApiKey: e.target.value
                          })
                        }
                        placeholder="AIzaSy..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400">
                          Anthropic Claude API Key
                        </label>
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <span>Ottieni chiave</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <input
                        type="password"
                        value={agentConfig.claudeApiKey}
                        onChange={(e) =>
                          onUpdateAgentConfig({
                            ...agentConfig,
                            claudeApiKey: e.target.value
                          })
                        }
                        placeholder="sk-ant-api03-..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {agentMode === 'bridge' && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-400" />
                      Collega il Bridge CLI locale
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        agentConfig.bridgeConnected
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {agentConfig.bridgeConnected ? '● Connesso' : '○ Non connesso'}
                    </span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                    <li>
                      Apri un terminale nella cartella del progetto ed esegui{' '}
                      <code className="px-1.5 py-0.5 rounded bg-slate-950 text-sky-300">
                        npm run bridge
                      </code>
                    </li>
                    <li>Verifica l&apos;URL qui sotto e premi Testa Connessione.</li>
                  </ol>
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
                      onClick={handleTestBridge}
                      disabled={bridgeTesting}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5"
                    >
                      {bridgeTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Testa Connessione</span>
                    </button>
                  </div>
                  {bridgeToolsStatus && (
                    <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Bridge attivo — Node {bridgeToolsStatus.nodeVersion || 'OK'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {agentMode === 'builtin' && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span>Motore Integrato (Zero Configurazione)</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Puoi iniziare subito senza chiavi API. Quando vorrai usare i modelli cloud completi di Claude o Gemini, potrai inserire le chiavi da &ldquo;API &amp; Bridge&rdquo;.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: GITHUB */}
          {step === 'github' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  1. Autorizza l&apos;accesso a GitHub
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Crea un Personal Access Token con permesso <code className="text-slate-300">repo</code> e incollalo qui.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FolderGit2 className="w-4 h-4 text-indigo-400" />
                    Personal Access Token
                  </span>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=VisualFidCodingApp"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium flex items-center gap-1 transition"
                  >
                    <span>Genera Token su GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={githubConfig.token}
                    onChange={(e) =>
                      onUpdateGitHub({ ...githubConfig, token: e.target.value })
                    }
                    placeholder="ghp_... oppure github_pat_..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <button
                    onClick={handleVerifyGitHub}
                    disabled={ghLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    {ghLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verifica</span>
                  </button>
                </div>

                {githubConfig.connected && (
                  <div className="flex items-center gap-2 text-emerald-300 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Connesso come @{githubConfig.username}</span>
                  </div>
                )}
              </div>

              {githubConfig.connected && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-white">
                      2. Scegli o crea un Repository
                    </h4>
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setRepoAction('existing')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          repoAction === 'existing'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Esistente
                      </button>
                      <button
                        onClick={() => setRepoAction('new')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          repoAction === 'new'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Crea Nuovo
                      </button>
                    </div>
                  </div>

                  {repoAction === 'existing' ? (
                    <div className="space-y-2.5">
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
                          placeholder="username/repository"
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
                        {githubConfig.selectedRepo && (
                          <button
                            onClick={handlePullRepo}
                            disabled={ghLoading}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 shrink-0"
                          >
                            <DownloadCloud className="w-3.5 h-3.5" />
                            <span>Importa File (Pull)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        placeholder="nome-nuova-app"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                      <button
                        onClick={handleCreateRepo}
                        disabled={ghLoading || !newRepoName.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Crea Repo</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

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

          {/* STEP 3: SUMMARY */}
          {step === 'summary' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Riepilogo Configurazione
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Ecco lo stato attuale dei collegamenti del tuo spazio di lavoro.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-sky-400" />
                      Agente IA
                    </span>
                    <button
                      onClick={() => setStep('agent')}
                      className="text-[11px] text-indigo-300 hover:underline"
                    >
                      Modifica
                    </button>
                  </div>
                  <div className="text-slate-300">
                    Agente attivo:{' '}
                    <strong className="uppercase text-white">
                      {agentConfig.activeAgent}
                    </strong>
                  </div>
                  <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{aiStatusText}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      GitHub
                    </span>
                    <button
                      onClick={() => setStep('github')}
                      className="text-[11px] text-indigo-300 hover:underline"
                    >
                      Modifica
                    </button>
                  </div>
                  {githubConfig.connected ? (
                    <>
                      <div className="text-slate-300">
                        Account:{' '}
                        <strong className="text-white">
                          @{githubConfig.username}
                        </strong>
                      </div>
                      <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {githubConfig.selectedRepo || 'Nessun repo selezionato'} (
                          {githubConfig.branch || 'main'})
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Non ancora collegato. Puoi farlo in qualsiasi momento dal pulsante GitHub.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-3.5 bg-[#090d18] border-t border-slate-800 flex items-center justify-between">
          <div>
            {currentStepIndex > 0 && (
              <button
                onClick={() => setStep(STEPS[currentStepIndex - 1].id)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Indietro</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'summary' ? (
              <>
                <button
                  onClick={() => setStep(STEPS[currentStepIndex + 1].id)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium transition"
                >
                  Salta
                </button>
                <button
                  onClick={() => setStep(STEPS[currentStepIndex + 1].id)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <span>Avanti</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Inizia a Lavorare</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
