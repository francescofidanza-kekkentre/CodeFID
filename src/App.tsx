import React, { useEffect, useMemo, useState } from 'react';
import {
  AgentConfig,
  AgentId,
  AgentMessage,
  FirebaseConfig,
  GitHubConfig,
  ProjectFile,
  PwaManifestConfig,
  PwaProject,
  TabletLayoutMode
} from './types/ide';
import {
  auditPwaProject,
  generateManifestJson,
  generateServiceWorkerJs
} from './services/pwaPreview';
import { runAgentTask } from './services/agentEngine';
import { TabletTopBar } from './components/TabletTopBar';
import { TouchCodeEditor } from './components/TouchCodeEditor';
import { AgentStudioPanel } from './components/AgentStudioPanel';
import { LivePwaPreview } from './components/LivePwaPreview';
import { PwaBuilderModal } from './components/PwaBuilderModal';
import { IntegrationsDrawer } from './components/IntegrationsDrawer';
import { GuidedSetupModal, GuidedStep } from './components/GuidedSetupModal';
import { VsCodeActivityBar } from './components/VsCodeActivityBar';
import { VsCodeStatusBar } from './components/VsCodeStatusBar';

const STORAGE_KEYS = {
  PROJECTS: 'codefid_projects_v1',
  ACTIVE_ID: 'codefid_active_project_v1',
  AGENT_CFG: 'codefid_agent_cfg_v1',
  GITHUB_CFG: 'codefid_github_cfg_v1',
  FIREBASE_CFG: 'codefid_firebase_cfg_v1'
};

function createEmptyProject(): PwaProject {
  return {
    id: 'empty-workspace',
    name: 'Ambiente Vuoto',
    description: 'Spazio di lavoro vuoto',
    updatedAt: new Date().toISOString(),
    manifestConfig: {
      name: 'Nuova PWA',
      short_name: 'App',
      description: '',
      theme_color: '#6366f1',
      background_color: '#0f172a',
      display: 'standalone',
      orientation: 'any',
      start_url: '/index.html',
      cacheStrategy: 'StaleWhileRevalidate',
      offlineFallback: true
    },
    files: []
  };
}

export function App() {
  // Projects State
  const [projects, setProjects] = useState<PwaProject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [createEmptyProject()];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || 'empty-workspace';
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const [activeFilePath, setActiveFilePath] = useState<string>(
    () => activeProject.files[0]?.path || ''
  );
  const [layoutMode, setLayoutMode] = useState<TabletLayoutMode>('split-3');

  // Agent Config
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AGENT_CFG);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      activeAgent: 'antigravity',
      claudeApiKey: '',
      claudeModel: 'claude-3-7-sonnet-latest',
      geminiApiKey: '',
      antigravityModel: 'gemini-2.5-flash',
      bridgeUrl: 'http://localhost:8787',
      bridgeConnected: false,
      autoApplyChanges: true
    };
  });

  // GitHub Config
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GITHUB_CFG);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      token: '',
      username: '',
      selectedRepo: '',
      branch: 'main',
      connected: false
    };
  });

  // Firebase Config
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIREBASE_CFG);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      projectId: '',
      apiKey: '',
      appId: '',
      authDomain: '',
      storageBucket: '',
      connected: false
    };
  });

  // Modals & Drawers
  const [pwaStudioOpen, setPwaStudioOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [guidedSetupOpen, setGuidedSetupOpen] = useState(false);
  const [guidedSetupStep, setGuidedSetupStep] = useState<GuidedStep>('agent');
  const [explorerOpen, setExplorerOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false
  );
  const [integrationsTab, setIntegrationsTab] = useState<
    'github' | 'firebase' | 'agents'
  >('github');
  const [bridgeToolsStatus, setBridgeToolsStatus] = useState<Record<
    string,
    any
  > | null>(null);

  // Agent Conversation History
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  // Save states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeProjectId);
    } catch {}
  }, [activeProjectId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AGENT_CFG, JSON.stringify(agentConfig));
    } catch {}
  }, [agentConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GITHUB_CFG, JSON.stringify(githubConfig));
    } catch {}
  }, [githubConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.FIREBASE_CFG,
        JSON.stringify(firebaseConfig)
      );
    } catch {}
  }, [firebaseConfig]);

  // Auto-detect local CLI bridge on mount
  const checkBridgeHealth = async () => {
    try {
      const res = await fetch(`${agentConfig.bridgeUrl.replace(/\/$/, '')}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBridgeToolsStatus(data.tools || null);
        setAgentConfig((prev) => ({ ...prev, bridgeConnected: true }));
      } else {
        setAgentConfig((prev) => ({ ...prev, bridgeConnected: false }));
      }
    } catch {
      setAgentConfig((prev) => ({ ...prev, bridgeConnected: false }));
    }
  };

  useEffect(() => {
    checkBridgeHealth();
  }, []);

  // Audit current PWA project
  const pwaAudit = useMemo(
    () => auditPwaProject(activeProject.files),
    [activeProject.files]
  );

  // Project file mutation helpers
  const updateActiveProjectFiles = (nextFiles: ProjectFile[]) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, files: nextFiles, updatedAt: new Date().toISOString() }
          : p
      )
    );
    if (nextFiles.length > 0 && !nextFiles.some((f) => f.path === activeFilePath)) {
      setActiveFilePath(nextFiles[0].path);
    } else if (nextFiles.length === 0) {
      setActiveFilePath('');
    }
  };

  const handleUpdateFileContent = (path: string, newContent: string) => {
    const nextFiles = activeProject.files.map((f) =>
      f.path === path ? { ...f, content: newContent, modified: true } : f
    );
    updateActiveProjectFiles(nextFiles);
  };

  const handleCreateFile = (path: string) => {
    if (activeProject.files.some((f) => f.path === path)) {
      setActiveFilePath(path);
      return;
    }
    const ext = path.split('.').pop()?.toLowerCase() || 'js';
    const language: ProjectFile['language'] =
      ext === 'html'
        ? 'html'
        : ext === 'css'
        ? 'css'
        : ext === 'json'
        ? 'json'
        : ext === 'md'
        ? 'markdown'
        : ext === 'yml' || ext === 'yaml'
        ? 'yaml'
        : 'javascript';

    const nextFiles: ProjectFile[] = [
      ...activeProject.files,
      {
        path,
        language,
        content: `// ${path} — Created in CodeFID Tablet IDE\n`,
        modified: true
      }
    ];
    updateActiveProjectFiles(nextFiles);
    setActiveFilePath(path);
  };

  const handleUpdateManifestConfig = (nextManifestConfig: PwaManifestConfig) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, manifestConfig: nextManifestConfig }
          : p
      )
    );
  };

  const handleApplyManifestAndSwToFiles = () => {
    const manifestContent = generateManifestJson(activeProject.manifestConfig);
    const swContent = generateServiceWorkerJs(activeProject.manifestConfig);
    const nextFiles = [...activeProject.files];

    const upsert = (path: string, content: string, language: ProjectFile['language']) => {
      const idx = nextFiles.findIndex((f) => f.path === path);
      if (idx >= 0) {
        nextFiles[idx] = { ...nextFiles[idx], content, modified: true };
      } else {
        nextFiles.push({ path, content, language, modified: true });
      }
    };

    upsert('manifest.json', manifestContent, 'json');
    upsert('sw.js', swContent, 'javascript');
    updateActiveProjectFiles(nextFiles);
  };

  // Send Prompt to Active AI Agent
  const handleSendAgentPrompt = async (prompt: string) => {
    const snapshot = activeProject.files.map((f) => ({ ...f }));
    const userMsg: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      agent: agentConfig.activeAgent,
      content: prompt,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAgentRunning(true);

    try {
      const result = await runAgentTask({
        prompt,
        agentConfig,
        files: activeProject.files,
        manifestConfig: activeProject.manifestConfig,
        firebaseConfig
      });

      updateActiveProjectFiles(result.updatedFiles);

      const assistantMsg: AgentMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        agent: agentConfig.activeAgent,
        agentLabel: result.agentLabel,
        content: result.replyText,
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: result.toolCalls,
        snapshotFiles: snapshot
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          agent: agentConfig.activeAgent,
          agentLabel: 'Errore Agente',
          content: err.message || 'Errore durante l’esecuzione del task AI.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Execute command via CLI Bridge (!command)
  const handleRunBridgeCommand = async (cmd: string) => {
    const userMsg: AgentMessage = {
      id: `cmd-${Date.now()}`,
      role: 'user',
      agent: agentConfig.activeAgent,
      content: `!${cmd}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAgentRunning(true);

    try {
      const res = await fetch(`${agentConfig.bridgeUrl.replace(/\/$/, '')}/api/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      const output = (data.stdout || '') + (data.stderr ? `\n${data.stderr}` : '');
      setMessages((prev) => [
        ...prev,
        {
          id: `bridge-${Date.now()}`,
          role: 'assistant',
          agent: agentConfig.activeAgent,
          agentLabel: 'CodeFID CLI Bridge',
          content: output.trim() || '(Comando eseguito senza output)',
          timestamp: new Date().toLocaleTimeString(),
          toolCalls: [
            {
              id: `tc-bridge-${Date.now()}`,
              tool: 'bridge_exec',
              summary: `Eseguito: ${cmd}`,
              status: data.ok ? 'done' : 'error'
            }
          ]
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bridge-err-${Date.now()}`,
          role: 'assistant',
          agent: agentConfig.activeAgent,
          agentLabel: 'CodeFID CLI Bridge',
          content:
            'Bridge CLI non raggiungibile su ' +
            agentConfig.bridgeUrl +
            '. Avvia `npm run bridge` nel terminale per abilitare l’esecuzione di comandi locali.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleAskAgentAboutFile = (
    agent: 'claude' | 'antigravity',
    file: ProjectFile
  ) => {
    setAgentConfig((prev) => ({ ...prev, activeAgent: agent }));
    handleSendAgentPrompt(
      `Analizza e migliora il file ${file.path} per ottimizzare l'esperienza PWA su tablet.`
    );
  };

  const handleExportProject = () => {
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.id}-pwa-bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openGuidedSetup = (step: GuidedStep = 'agent') => {
    setIntegrationsOpen(false);
    setGuidedSetupStep(step);
    setGuidedSetupOpen(true);
  };

  const handleReplaceProjectFiles = (files: ProjectFile[], notice?: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              name:
                p.id === 'empty-workspace' && githubConfig.selectedRepo
                  ? githubConfig.selectedRepo
                  : p.name,
              files,
              updatedAt: new Date().toISOString()
            }
          : p
      )
    );
    if (files.length > 0 && !files.some((f) => f.path === activeFilePath)) {
      setActiveFilePath(files[0].path);
    } else if (files.length === 0) {
      setActiveFilePath('');
    }
    if (notice) {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          agent: agentConfig.activeAgent,
          agentLabel: 'Cloud Sync',
          content: `✅ ${notice}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
  };

  const activeFile = useMemo(
    () =>
      activeProject.files.find((f) => f.path === activeFilePath) ||
      activeProject.files[0],
    [activeProject.files, activeFilePath]
  );

  return (
    <div className="flex flex-col h-dvh w-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Top Bar */}
      <TabletTopBar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          const target = projects.find((p) => p.id === id);
          setActiveFilePath(target?.files[0]?.path || '');
        }}
        layoutMode={layoutMode}
        onChangeLayout={setLayoutMode}
        activeAgent={agentConfig.activeAgent}
        onChangeAgent={(agent: AgentId) =>
          setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
        }
        pwaScore={pwaAudit.score}
        onOpenPwaStudio={() => setPwaStudioOpen(true)}
        onOpenIntegrations={(tab) => {
          setIntegrationsTab(tab);
          setIntegrationsOpen(true);
        }}
        githubConfig={githubConfig}
        firebaseConfig={firebaseConfig}
        bridgeConnected={agentConfig.bridgeConnected}
        onExportProject={handleExportProject}
        onOpenGuidedSetup={() => openGuidedSetup('agent')}
      />

      {/* VS Code Body: Activity Bar + Explorer Sidebar + Main Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VsCodeActivityBar
          explorerOpen={explorerOpen}
          onToggleExplorer={() => setExplorerOpen((prev) => !prev)}
          files={activeProject.files}
          activeFilePath={activeFile?.path || ''}
          projectName={activeProject.name}
          onSelectFile={(path) => {
            setActiveFilePath(path);
            if (layoutMode === 'agent-preview' || layoutMode === 'preview-only') {
              setLayoutMode('split-3');
            }
          }}
          onCreateFile={handleCreateFile}
          onOpenGitHub={() => {
            setIntegrationsTab('github');
            setIntegrationsOpen(true);
          }}
          onOpenFirebase={() => {
            setIntegrationsTab('firebase');
            setIntegrationsOpen(true);
          }}
          onOpenPwaStudio={() => setPwaStudioOpen(true)}
          onOpenSettings={() => {
            setIntegrationsTab('agents');
            setIntegrationsOpen(true);
          }}
          onOpenGuidedSetup={() => openGuidedSetup('agent')}
          onFocusAgents={() => setLayoutMode('agent-preview')}
          onFocusPreview={() => setLayoutMode('preview-only')}
          githubConnected={githubConfig.connected}
        />

        {/* Main Tablet Workspace Grid */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {layoutMode === 'split-3' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 h-full overflow-hidden">
            <div className="md:col-span-1 lg:col-span-4 xl:col-span-3 h-full min-h-0 overflow-hidden border-b md:border-b-0 border-slate-800/80">
              <AgentStudioPanel
                messages={messages}
                agentConfig={agentConfig}
                isRunning={isAgentRunning}
                onChangeAgent={(agent) =>
                  setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
                }
                onSendPrompt={handleSendAgentPrompt}
                onRunBridgeCommand={handleRunBridgeCommand}
                onSelectFile={(path) => setActiveFilePath(path)}
                onRestoreSnapshot={(files) => updateActiveProjectFiles(files)}
                onOpenSettings={() => {
                  setIntegrationsTab('agents');
                  setIntegrationsOpen(true);
                }}
                onOpenGuidedSetup={() => openGuidedSetup('agent')}
              />
            </div>

            <div className="md:col-span-1 lg:col-span-4 xl:col-span-5 h-full min-h-0 overflow-hidden border-b lg:border-b-0 border-slate-800/80">
              <TouchCodeEditor
                files={activeProject.files}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onAskAgentAboutFile={handleAskAgentAboutFile}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 xl:col-span-4 h-full min-h-0 overflow-hidden">
              <LivePwaPreview
                files={activeProject.files}
                manifestConfig={activeProject.manifestConfig}
              />
            </div>
          </div>
        )}

        {layoutMode === 'code-preview' && (
          <div className="grid grid-cols-1 md:grid-cols-12 h-full overflow-hidden">
            <div className="md:col-span-6 h-full min-h-0 overflow-hidden">
              <TouchCodeEditor
                files={activeProject.files}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onAskAgentAboutFile={handleAskAgentAboutFile}
              />
            </div>
            <div className="md:col-span-6 h-full min-h-0 overflow-hidden">
              <LivePwaPreview
                files={activeProject.files}
                manifestConfig={activeProject.manifestConfig}
              />
            </div>
          </div>
        )}

        {layoutMode === 'agent-preview' && (
          <div className="grid grid-cols-1 md:grid-cols-12 h-full overflow-hidden">
            <div className="md:col-span-5 h-full min-h-0 overflow-hidden">
              <AgentStudioPanel
                messages={messages}
                agentConfig={agentConfig}
                isRunning={isAgentRunning}
                onChangeAgent={(agent) =>
                  setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
                }
                onSendPrompt={handleSendAgentPrompt}
                onRunBridgeCommand={handleRunBridgeCommand}
                onSelectFile={(path) => {
                  setActiveFilePath(path);
                  setLayoutMode('split-3');
                }}
                onRestoreSnapshot={(files) => updateActiveProjectFiles(files)}
                onOpenSettings={() => {
                  setIntegrationsTab('agents');
                  setIntegrationsOpen(true);
                }}
                onOpenGuidedSetup={() => openGuidedSetup('agent')}
              />
            </div>
            <div className="md:col-span-7 h-full min-h-0 overflow-hidden">
              <LivePwaPreview
                files={activeProject.files}
                manifestConfig={activeProject.manifestConfig}
              />
            </div>
          </div>
        )}

        {layoutMode === 'preview-only' && (
          <div className="h-full w-full overflow-hidden">
            <LivePwaPreview
              files={activeProject.files}
              manifestConfig={activeProject.manifestConfig}
            />
          </div>
        )}
        </main>
      </div>

      {/* VS Code Bottom Status Bar */}
      <VsCodeStatusBar
        githubConfig={githubConfig}
        activeFile={activeFile}
        activeAgent={agentConfig.activeAgent}
        pwaScore={pwaAudit.score}
        bridgeConnected={agentConfig.bridgeConnected}
        onOpenGitHub={() => {
          setIntegrationsTab('github');
          setIntegrationsOpen(true);
        }}
        onOpenPwaStudio={() => setPwaStudioOpen(true)}
        onOpenAgents={() => {
          setIntegrationsTab('agents');
          setIntegrationsOpen(true);
        }}
      />

      {/* PWA Manifest, Service Worker & Readiness Audit Studio */}
      <PwaBuilderModal
        isOpen={pwaStudioOpen}
        onClose={() => setPwaStudioOpen(false)}
        manifestConfig={activeProject.manifestConfig}
        onChangeConfig={handleUpdateManifestConfig}
        onApplyToProjectFiles={handleApplyManifestAndSwToFiles}
        auditScore={pwaAudit.score}
        auditItems={pwaAudit.items}
        onFixWithAgent={handleSendAgentPrompt}
      />

      {/* GitHub, Firebase & Agent/Bridge Integrations Drawer */}
      <IntegrationsDrawer
        isOpen={integrationsOpen}
        activeTab={integrationsTab}
        onChangeTab={setIntegrationsTab}
        onClose={() => setIntegrationsOpen(false)}
        githubConfig={githubConfig}
        onUpdateGitHub={setGithubConfig}
        firebaseConfig={firebaseConfig}
        onUpdateFirebase={setFirebaseConfig}
        agentConfig={agentConfig}
        onUpdateAgentConfig={setAgentConfig}
        activeProject={activeProject}
        onReplaceProjectFiles={handleReplaceProjectFiles}
        onTestBridge={checkBridgeHealth}
        bridgeToolsStatus={bridgeToolsStatus}
        onOpenGuidedSetup={(step) => openGuidedSetup(step)}
      />

      {/* Guided Setup Wizard for AI Agent & GitHub */}
      <GuidedSetupModal
        isOpen={guidedSetupOpen}
        initialStep={guidedSetupStep}
        onClose={() => setGuidedSetupOpen(false)}
        agentConfig={agentConfig}
        onUpdateAgentConfig={setAgentConfig}
        githubConfig={githubConfig}
        onUpdateGitHub={setGithubConfig}
        activeProject={activeProject}
        onReplaceProjectFiles={handleReplaceProjectFiles}
        onTestBridge={checkBridgeHealth}
        bridgeToolsStatus={bridgeToolsStatus}
      />
    </div>
  );
}
export default App;
