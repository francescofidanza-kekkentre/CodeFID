import React, { useEffect, useMemo, useState } from 'react';
import {
  AgentConfig,
  AgentId,
  AgentMessage,
  FirebaseConfig,
  GitHubConfig,
  PendingAgentChanges,
  PendingFileChange,
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
import {
  computeLineDiffStats,
  detectFileLanguage,
  execBridgeCommand,
  loadStoredJson,
  saveStoredJson
} from './utils/fileHelpers';
import { TabletTopBar } from './components/TabletTopBar';
import { TouchCodeEditor } from './components/TouchCodeEditor';
import { AgentStudioPanel } from './components/AgentStudioPanel';
import { LivePwaPreview } from './components/LivePwaPreview';
import { PwaBuilderModal } from './components/PwaBuilderModal';
import { CommitModal } from './components/CommitModal';
import { IntegrationsDrawer } from './components/IntegrationsDrawer';
import { GuidedSetupModal, GuidedStep } from './components/GuidedSetupModal';
import { VsCodeActivityBar } from './components/VsCodeActivityBar';
import { VsCodeStatusBar } from './components/VsCodeStatusBar';
import { VsCodeTerminalPanel } from './components/VsCodeTerminalPanel';

const STORAGE_KEYS = {
  PROJECTS: 'codefid_projects_v1',
  ACTIVE_ID: 'codefid_active_project_v1',
  AGENT_CFG: 'codefid_agent_cfg_v1',
  GITHUB_CFG: 'codefid_github_cfg_v1',
  FIREBASE_CFG: 'codefid_firebase_cfg_v1',
  CHAT_MESSAGES: 'codefid_chat_messages_v1'
};

function serializeMessagesForStorage(msgs: AgentMessage[]): AgentMessage[] {
  const recent = msgs.slice(-100);
  const snapshotCutoff = Math.max(0, recent.length - 3);
  return recent.map((m, idx) =>
    idx < snapshotCutoff && m.snapshotFiles
      ? { ...m, snapshotFiles: undefined }
      : m
  );
}

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
    const saved = loadStoredJson<PwaProject[] | null>(STORAGE_KEYS.PROJECTS, null);
    return Array.isArray(saved) && saved.length > 0 ? saved : [createEmptyProject()];
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
  const [layoutMode, setLayoutMode] = useState<TabletLayoutMode>('code-agent');

  // Agent Config
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(() => {
    const loaded = loadStoredJson<AgentConfig>(STORAGE_KEYS.AGENT_CFG, {
      activeAgent: 'antigravity',
      claudeApiKey: '',
      claudeModel: 'claude-sonnet-5-5',
      geminiApiKey: '',
      antigravityModel: 'gemini-4-hydrogen',
      bridgeUrl: 'http://localhost:8787',
      bridgeConnected: false,
      autoApplyChanges: true
    });
    if (
      !loaded.antigravityModel ||
      loaded.antigravityModel.startsWith('gemini-2.5') ||
      loaded.antigravityModel === 'gemini-3.8-pro'
    ) {
      loaded.antigravityModel = 'gemini-4-hydrogen';
    }
    return loaded;
  });

  // GitHub Config
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>(() =>
    loadStoredJson<GitHubConfig>(STORAGE_KEYS.GITHUB_CFG, {
      token: '',
      username: '',
      selectedRepo: '',
      branch: 'main',
      connected: false
    })
  );

  // Firebase Config
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(() =>
    loadStoredJson<FirebaseConfig>(STORAGE_KEYS.FIREBASE_CFG, {
      projectId: '',
      apiKey: '',
      appId: '',
      authDomain: '',
      storageBucket: '',
      connected: false
    })
  );

  // Modals & Drawers
  const [pwaStudioOpen, setPwaStudioOpen] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [guidedSetupOpen, setGuidedSetupOpen] = useState(false);
  const [guidedSetupStep, setGuidedSetupStep] = useState<GuidedStep>('agent');
  const [explorerOpen, setExplorerOpen] = useState<boolean>(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [integrationsTab, setIntegrationsTab] = useState<
    'github' | 'firebase' | 'agents'
  >('github');
  const [bridgeToolsStatus, setBridgeToolsStatus] = useState<Record<
    string,
    any
  > | null>(null);

  // Agent Conversation History (persisted locally across restarts)
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    loadStoredJson<AgentMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, [])
  );
  const [agentModifiedFiles, setAgentModifiedFiles] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingAgentChanges | null>(null);

  // Keep keyboard inset & visualViewport synced without resizing the fullscreen surface
  useEffect(() => {
    const vv = window.visualViewport;

    const syncViewportMetrics = () => {
      const visibleHeight = Math.round(vv ? vv.height : window.innerHeight);
      const keyboardInset = vv
        ? Math.max(0, Math.round(window.innerHeight - vv.height))
        : 0;
      document.documentElement.style.setProperty('--app-height', `${visibleHeight}px`);
      document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
    };

    syncViewportMetrics();
    vv?.addEventListener('resize', syncViewportMetrics);
    window.addEventListener('resize', syncViewportMetrics);
    document.addEventListener('fullscreenchange', syncViewportMetrics);
    document.addEventListener('webkitfullscreenchange', syncViewportMetrics);
    return () => {
      vv?.removeEventListener('resize', syncViewportMetrics);
      window.removeEventListener('resize', syncViewportMetrics);
      document.removeEventListener('fullscreenchange', syncViewportMetrics);
      document.removeEventListener('webkitfullscreenchange', syncViewportMetrics);
    };
  }, []);

  // Save states to localStorage
  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.PROJECTS, projects);
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeProjectId);
    } catch {}
  }, [activeProjectId]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.AGENT_CFG, agentConfig);
  }, [agentConfig]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.GITHUB_CFG, githubConfig);
  }, [githubConfig]);

  useEffect(() => {
    saveStoredJson(STORAGE_KEYS.FIREBASE_CFG, firebaseConfig);
  }, [firebaseConfig]);

  const persistChatMessages = (msgs: AgentMessage[]) => {
    const withSnapshots = serializeMessagesForStorage(msgs);
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(withSnapshots));
    } catch {
      // Fallback: strip file snapshots if storage quota is tight so prompts & replies are still saved
      try {
        const textOnly = msgs.slice(-100).map((m) => ({ ...m, snapshotFiles: undefined }));
        localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(textOnly));
      } catch {
        // Ignore storage errors in private mode
      }
    }
  };

  useEffect(() => {
    persistChatMessages(messages);
  }, [messages]);

  useEffect(() => {
    const persistChatOnExit = () => persistChatMessages(messages);
    window.addEventListener('pagehide', persistChatOnExit);
    window.addEventListener('beforeunload', persistChatOnExit);
    return () => {
      window.removeEventListener('pagehide', persistChatOnExit);
      window.removeEventListener('beforeunload', persistChatOnExit);
    };
  }, [messages]);

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
    const language = detectFileLanguage(path);

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

  const handleDeleteFile = (path: string) => {
    const nextFiles = activeProject.files.filter((f) => f.path !== path);
    updateActiveProjectFiles(nextFiles);
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
        firebaseConfig,
        history: messages
      });

      const changedFiles: PendingFileChange[] = [];
      for (const nextFile of result.updatedFiles) {
        const prevFile = snapshot.find((f) => f.path === nextFile.path);
        if (!prevFile || prevFile.content !== nextFile.content) {
          const stats = computeLineDiffStats(prevFile?.content || '', nextFile.content);
          changedFiles.push({
            path: nextFile.path,
            addedLines: stats.added,
            deletedLines: stats.deleted,
            isNew: !prevFile
          });
        }
      }

      const modifiedByAgent = changedFiles.map((f) => f.path);

      if (changedFiles.length > 0) {
        setAgentModifiedFiles(modifiedByAgent);
        if (!modifiedByAgent.includes(activeFilePath)) {
          setActiveFilePath(modifiedByAgent[0]);
        }
        setPendingChanges({
          id: `pending-${Date.now()}`,
          agentLabel: result.agentLabel,
          files: changedFiles,
          updatedFiles: result.updatedFiles,
          totalDeletedLines: changedFiles.reduce((acc, f) => acc + f.deletedLines, 0),
          totalAddedLines: changedFiles.reduce((acc, f) => acc + f.addedLines, 0)
        });
      }

      const assistantMsg: AgentMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        agent: agentConfig.activeAgent,
        agentLabel: result.agentLabel,
        content: result.replyText,
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: result.toolCalls,
        snapshotFiles: snapshot,
        modifiedFiles: modifiedByAgent
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

  const handleAcceptPendingChanges = () => {
    if (!pendingChanges) return;
    updateActiveProjectFiles(pendingChanges.updatedFiles);
    setPendingChanges(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.modifiedFiles || m.toolCalls
          ? { ...m, modifiedFiles: undefined, toolCalls: undefined }
          : m
      )
    );
  };

  const handleRejectPendingChanges = () => {
    if (!pendingChanges) return;
    setPendingChanges(null);
    setAgentModifiedFiles([]);
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
      const data = await execBridgeCommand(agentConfig.bridgeUrl, cmd);
      setMessages((prev) => [
        ...prev,
        {
          id: `bridge-${Date.now()}`,
          role: 'assistant',
          agent: agentConfig.activeAgent,
          agentLabel: 'CodeFID CLI Bridge',
          content: data.output || '(Comando eseguito senza output)',
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

  const handleMarkProjectSynced = () => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              files: p.files.map((f) => ({ ...f, modified: false })),
              updatedAt: new Date().toISOString()
            }
          : p
      )
    );
    setAgentModifiedFiles([]);
    setPendingChanges(null);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPendingChanges(null);
    setAgentModifiedFiles([]);
    saveStoredJson(STORAGE_KEYS.CHAT_MESSAGES, []);
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
              files: files.map((f) => ({ ...f, modified: false })),
              updatedAt: new Date().toISOString()
            }
          : p
      )
    );
    setAgentModifiedFiles([]);
    setPendingChanges(null);
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
    <div
      style={{ paddingBottom: 'var(--keyboard-inset, 0px)' }}
      className="flex flex-col h-full w-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
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
        onChangeLayout={(mode) => {
          setLayoutMode(mode);
          if (mode === 'code-agent') {
            setExplorerOpen(true);
          }
        }}
        onTogglePreview={() => {
          if (layoutMode === 'code-agent') {
            setLayoutMode('split-3');
          } else {
            setLayoutMode('code-agent');
            setExplorerOpen(true);
          }
        }}
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
        onOpenCommitModal={() => setCommitModalOpen(true)}
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
            if (layoutMode === 'preview-only') {
              setLayoutMode('code-agent');
            }
          }}
          onCreateFile={handleCreateFile}
          onOpenGitHub={() => {
            if (githubConfig.connected) {
              setCommitModalOpen(true);
            } else {
              setIntegrationsTab('github');
              setIntegrationsOpen(true);
            }
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
          onFocusAgents={() => {
            setExplorerOpen(true);
            setLayoutMode('code-agent');
          }}
          onFocusPreview={() =>
            setLayoutMode((prev) => (prev === 'preview-only' ? 'code-agent' : 'preview-only'))
          }
          terminalOpen={terminalOpen}
          onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
          githubConnected={githubConfig.connected}
          isAgentVisible={
            layoutMode === 'code-agent' ||
            layoutMode === 'split-3' ||
            layoutMode === 'agent-preview'
          }
          isPreviewVisible={
            layoutMode === 'split-3' ||
            layoutMode === 'code-preview' ||
            layoutMode === 'agent-preview' ||
            layoutMode === 'preview-only'
          }
          agentModifiedFiles={agentModifiedFiles}
        />

        {/* Right Column: Workspace + Collapsible Bottom Terminal */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Main Tablet Workspace Grid */}
          <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {layoutMode === 'code-agent' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full overflow-hidden">
            {/* Codice (Editor) */}
            <div className="lg:col-span-7 h-1/2 lg:h-full min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-[#2b2b2b]">
              <TouchCodeEditor
                files={activeProject.files}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onAskAgentAboutFile={handleAskAgentAboutFile}
                agentModifiedFiles={agentModifiedFiles}
                pendingFileChange={
                  pendingChanges?.files.find((f) => f.path === activeFile?.path) || null
                }
              />
            </div>

            {/* Agente (Agent Studio) */}
            <div className="lg:col-span-5 h-1/2 lg:h-full min-h-0 overflow-hidden">
              <AgentStudioPanel
                messages={messages}
                agentConfig={agentConfig}
                isRunning={isAgentRunning}
                onChangeAgent={(agent) =>
                  setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
                }
                onUpdateAgentConfig={setAgentConfig}
                onSendPrompt={handleSendAgentPrompt}
                onRunBridgeCommand={handleRunBridgeCommand}
                onSelectFile={(path) => setActiveFilePath(path)}
                onRestoreSnapshot={(files) => updateActiveProjectFiles(files)}
                onOpenSettings={() => {
                  setIntegrationsTab('agents');
                  setIntegrationsOpen(true);
                }}
                onOpenGuidedSetup={() => openGuidedSetup('agent')}
                pendingChanges={pendingChanges}
                onAcceptPendingChanges={handleAcceptPendingChanges}
                onRejectPendingChanges={handleRejectPendingChanges}
                onClearChat={handleClearChat}
              />
            </div>
          </div>
        )}

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
                onUpdateAgentConfig={setAgentConfig}
                onSendPrompt={handleSendAgentPrompt}
                onRunBridgeCommand={handleRunBridgeCommand}
                onSelectFile={(path) => setActiveFilePath(path)}
                onRestoreSnapshot={(files) => updateActiveProjectFiles(files)}
                onOpenSettings={() => {
                  setIntegrationsTab('agents');
                  setIntegrationsOpen(true);
                }}
                onOpenGuidedSetup={() => openGuidedSetup('agent')}
                pendingChanges={pendingChanges}
                onAcceptPendingChanges={handleAcceptPendingChanges}
                onRejectPendingChanges={handleRejectPendingChanges}
                onClearChat={handleClearChat}
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
                agentModifiedFiles={agentModifiedFiles}
                pendingFileChange={
                  pendingChanges?.files.find((f) => f.path === activeFile?.path) || null
                }
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
                agentModifiedFiles={agentModifiedFiles}
                pendingFileChange={
                  pendingChanges?.files.find((f) => f.path === activeFile?.path) || null
                }
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
                onUpdateAgentConfig={setAgentConfig}
                onSendPrompt={handleSendAgentPrompt}
                onRunBridgeCommand={handleRunBridgeCommand}
                onSelectFile={(path) => {
                  setActiveFilePath(path);
                  setLayoutMode('code-agent');
                }}
                onRestoreSnapshot={(files) => updateActiveProjectFiles(files)}
                onOpenSettings={() => {
                  setIntegrationsTab('agents');
                  setIntegrationsOpen(true);
                }}
                onOpenGuidedSetup={() => openGuidedSetup('agent')}
                pendingChanges={pendingChanges}
                onAcceptPendingChanges={handleAcceptPendingChanges}
                onRejectPendingChanges={handleRejectPendingChanges}
                onClearChat={handleClearChat}
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

          <VsCodeTerminalPanel
            isOpen={terminalOpen}
            onClose={() => setTerminalOpen(false)}
            projectId={activeProject.id}
            projectName={activeProject.name}
            files={activeProject.files}
            agentConfig={agentConfig}
            githubConfig={githubConfig}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
          />
        </div>
      </div>

      {/* VS Code Bottom Status Bar */}
      <VsCodeStatusBar
        githubConfig={githubConfig}
        activeFile={activeFile}
        activeAgent={agentConfig.activeAgent}
        pwaScore={pwaAudit.score}
        bridgeConnected={agentConfig.bridgeConnected}
        terminalOpen={terminalOpen}
        onToggleTerminal={() => setTerminalOpen((prev) => !prev)}
        onOpenGitHub={() => {
          if (githubConfig.connected) {
            setCommitModalOpen(true);
          } else {
            setIntegrationsTab('github');
            setIntegrationsOpen(true);
          }
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

      {/* Focused GitHub Commit & Sync Modal */}
      <CommitModal
        isOpen={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        githubConfig={githubConfig}
        onUpdateGithubConfig={setGithubConfig}
        activeProject={activeProject}
        onReplaceProjectFiles={handleReplaceProjectFiles}
        onClearModifiedHighlights={handleMarkProjectSynced}
        onOpenGitHubSettings={() => {
          setIntegrationsTab('github');
          setIntegrationsOpen(true);
        }}
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
        onClearModifiedHighlights={handleMarkProjectSynced}
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
