import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { AgentCancelledError, runAgentTask } from './services/agentEngine';
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
import { CloneRepoModal } from './components/CloneRepoModal';
import { GitHubRepoSummary } from './services/githubService';
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
    files: [],
    chatHistory: []
  };
}

export function App() {
  // Projects State (each project stores its own files and chatHistory)
  const [projects, setProjects] = useState<PwaProject[]>(() => {
    const saved = loadStoredJson<PwaProject[] | null>(STORAGE_KEYS.PROJECTS, null);
    const list = Array.isArray(saved) && saved.length > 0 ? saved : [createEmptyProject()];
    const hasAnyProjectHistory = list.some((p) => Array.isArray(p.chatHistory));
    if (!hasAnyProjectHistory) {
      const legacyChat = loadStoredJson<AgentMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []);
      if (legacyChat.length > 0) {
        try {
          localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES);
        } catch {}
        const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || list[0].id;
        return list.map((p, idx) =>
          p.id === storedActiveId || (idx === 0 && !list.some((x) => x.id === storedActiveId))
            ? { ...p, chatHistory: serializeMessagesForStorage(legacyChat) }
            : { ...p, chatHistory: [] }
        );
      }
    }
    return list;
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
      agentLevel: 'medium',
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
    if (!loaded.agentLevel) {
      loaded.agentLevel = 'medium';
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
  const [commitModalMode, setCommitModalMode] = useState<'commit' | 'sync'>('commit');
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
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

  // Agent Conversation History (persisted per-project inside each PwaProject)
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const agentAbortRef = useRef<AbortController | null>(null);
  const agentRunLockRef = useRef(false);
  const messages: AgentMessage[] = activeProject.chatHistory ?? [];

  const setMessagesForProject = (
    projectId: string,
    updater: React.SetStateAction<AgentMessage[]>
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const current = p.chatHistory ?? [];
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { ...p, chatHistory: serializeMessagesForStorage(next) };
      })
    );
  };

  const setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>> = (updater) => {
    setMessagesForProject(activeProject.id, updater);
  };
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

  // Prevent tablet screen standby (Screen Wake Lock API) while the AI agent is running
  useEffect(() => {
    if (!isAgentRunning) return;
    const wakeLockApi = (
      navigator as Navigator & {
        wakeLock?: {
          request: (type: 'screen') => Promise<{ release: () => Promise<void> }>;
        };
      }
    ).wakeLock;
    if (!wakeLockApi) return;

    let cancelled = false;
    let sentinel: { release: () => Promise<void> } | null = null;

    const acquireWakeLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await wakeLockApi.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => undefined);
          sentinel = null;
        }
      } catch {
        // Ignore if battery saver or browser policy denies wake lock
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquireWakeLock();
      }
    };

    void acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinel) {
        void sentinel.release().catch(() => undefined);
        sentinel = null;
      }
    };
  }, [isAgentRunning]);

  const persistProjectsToStorage = (projectList: PwaProject[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projectList));
    } catch {
      // Fallback: strip file snapshots from chat histories if storage quota is tight
      try {
        const compact = projectList.map((p) => ({
          ...p,
          chatHistory: (p.chatHistory || [])
            .slice(-100)
            .map((m) => ({ ...m, snapshotFiles: undefined }))
        }));
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(compact));
      } catch {
        // Ignore storage errors in private mode
      }
    }
  };

  // Save states to localStorage
  useEffect(() => {
    persistProjectsToStorage(projects);
  }, [projects]);

  useEffect(() => {
    const persistOnExit = () => persistProjectsToStorage(projects);
    window.addEventListener('pagehide', persistOnExit);
    window.addEventListener('beforeunload', persistOnExit);
    return () => {
      window.removeEventListener('pagehide', persistOnExit);
      window.removeEventListener('beforeunload', persistOnExit);
    };
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
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || agentRunLockRef.current) return;
    agentRunLockRef.current = true;

    const controller = new AbortController();
    agentAbortRef.current = controller;

    // Baseline for diffs = real saved files; working set = files incl. not-yet-accepted changes,
    // so consecutive prompts build on top of pending modifications instead of discarding them.
    const targetProjectId = activeProject.id;
    const snapshot = activeProject.files.map((f) => ({ ...f }));
    const workingFiles = pendingChanges ? pendingChanges.updatedFiles : activeProject.files;
    const now = Date.now();
    const userMsg: AgentMessage = {
      id: `user-${now}`,
      role: 'user',
      agent: agentConfig.activeAgent,
      content: trimmedPrompt,
      timestamp: new Date().toLocaleTimeString()
    };
    const streamingMsgId = `ai-${now}`;
    let lastPartial = '';
    setMessagesForProject(targetProjectId, (prev) => [...prev, userMsg]);
    setIsAgentRunning(true);

    const upsertStreamingMessage = (partialText: string) => {
      if (controller.signal.aborted) return;
      lastPartial = partialText;
      setMessagesForProject(targetProjectId, (prev) => {
        const exists = prev.some((m) => m.id === streamingMsgId);
        if (exists) {
          return prev.map((m) =>
            m.id === streamingMsgId ? { ...m, content: partialText } : m
          );
        }
        return [
          ...prev,
          {
            id: streamingMsgId,
            role: 'assistant',
            agent: agentConfig.activeAgent,
            agentLabel:
              agentConfig.activeAgent === 'antigravity'
                ? `Antigravity (${agentConfig.antigravityModel})`
                : agentConfig.activeAgent === 'claude'
                ? `Claude (${agentConfig.claudeModel})`
                : 'Swarm (Antigravity + Claude)',
            content: partialText,
            timestamp: new Date().toLocaleTimeString()
          }
        ];
      });
    };

    try {
      const result = await runAgentTask({
        prompt: trimmedPrompt,
        agentConfig,
        files: workingFiles,
        manifestConfig: activeProject.manifestConfig,
        firebaseConfig,
        history: messages,
        activeFilePath: activeFile?.path,
        onPartialText: upsertStreamingMessage,
        signal: controller.signal
      });

      if (controller.signal.aborted) throw new AgentCancelledError();

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

      const finalMsg: AgentMessage = {
        id: streamingMsgId,
        role: 'assistant',
        agent: agentConfig.activeAgent,
        agentLabel: result.agentLabel,
        content: result.replyText,
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: result.toolCalls,
        snapshotFiles: snapshot,
        modifiedFiles: modifiedByAgent
      };
      setMessagesForProject(targetProjectId, (prev) => {
        const exists = prev.some((m) => m.id === streamingMsgId);
        return exists
          ? prev.map((m) => (m.id === streamingMsgId ? finalMsg : m))
          : [...prev, finalMsg];
      });
    } catch (err: any) {
      const cancelled = err instanceof AgentCancelledError || controller.signal.aborted;
      const partialText = lastPartial.replace(/\n*⏳.*$/s, '').trim();
      const rawErrMsg = err?.message || 'Errore durante l’esecuzione del task AI.';
      const errMsg: AgentMessage = {
        id: streamingMsgId,
        role: 'assistant',
        agent: agentConfig.activeAgent,
        agentLabel: cancelled ? 'Interrotto' : 'Errore Agente',
        content: cancelled
          ? `${partialText ? `${partialText}\n\n` : ''}⏹ Generazione interrotta. Nessun file è stato modificato.`
          : `${partialText ? `${partialText}\n\n` : ''}⚠️ ${rawErrMsg}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessagesForProject(targetProjectId, (prev) => {
        const exists = prev.some((m) => m.id === streamingMsgId);
        return exists
          ? prev.map((m) => (m.id === streamingMsgId ? errMsg : m))
          : [...prev, errMsg];
      });
    } finally {
      if (agentAbortRef.current === controller) agentAbortRef.current = null;
      agentRunLockRef.current = false;
      setIsAgentRunning(false);
    }
  };

  const handleStopAgent = () => {
    agentAbortRef.current?.abort();
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

  const handleAcceptSingleFile = (path: string) => {
    if (!pendingChanges) return;
    const targetFile = pendingChanges.updatedFiles.find((f) => f.path === path);
    if (!targetFile) return;

    const existingIdx = activeProject.files.findIndex((f) => f.path === path);
    const nextProjectFiles = [...activeProject.files];
    if (existingIdx >= 0) {
      nextProjectFiles[existingIdx] = targetFile;
    } else {
      nextProjectFiles.push(targetFile);
    }
    updateActiveProjectFiles(nextProjectFiles);

    const remainingFiles = pendingChanges.files.filter((f) => f.path !== path);
    if (remainingFiles.length === 0) {
      setPendingChanges(null);
      setAgentModifiedFiles([]);
    } else {
      setAgentModifiedFiles(remainingFiles.map((f) => f.path));
      setPendingChanges({
        ...pendingChanges,
        files: remainingFiles,
        totalDeletedLines: remainingFiles.reduce((acc, f) => acc + f.deletedLines, 0),
        totalAddedLines: remainingFiles.reduce((acc, f) => acc + f.addedLines, 0)
      });
    }
  };

  const handleRejectSingleFile = (path: string) => {
    if (!pendingChanges) return;
    const remainingFiles = pendingChanges.files.filter((f) => f.path !== path);
    if (remainingFiles.length === 0) {
      setPendingChanges(null);
      setAgentModifiedFiles([]);
    } else {
      const originalFile = activeProject.files.find((f) => f.path === path);
      const nextUpdatedFiles = originalFile
        ? pendingChanges.updatedFiles.map((f) => (f.path === path ? originalFile : f))
        : pendingChanges.updatedFiles.filter((f) => f.path !== path);
      setAgentModifiedFiles(remainingFiles.map((f) => f.path));
      setPendingChanges({
        ...pendingChanges,
        files: remainingFiles,
        updatedFiles: nextUpdatedFiles,
        totalDeletedLines: remainingFiles.reduce((acc, f) => acc + f.deletedLines, 0),
        totalAddedLines: remainingFiles.reduce((acc, f) => acc + f.addedLines, 0)
      });
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
    const cleanFiles = files.map((f) => ({ ...f, modified: false }));
    const isGitHubCloneOfDifferentRepo =
      Boolean(notice?.startsWith('Importati')) &&
      Boolean(githubConfig.selectedRepo) &&
      activeProject.name !== githubConfig.selectedRepo &&
      activeProject.id !== 'empty-workspace' &&
      !activeProject.id.startsWith('empty-');

    if (isGitHubCloneOfDifferentRepo) {
      agentAbortRef.current?.abort();
      const clonedProj: PwaProject = {
        ...createEmptyProject(),
        id: `gh-import-${Date.now()}`,
        name: githubConfig.selectedRepo,
        description: `Clonato da ${githubConfig.selectedRepo}`,
        files: cleanFiles,
        chatHistory: []
      };
      setProjects((prev) => [clonedProj, ...prev]);
      setActiveProjectId(clonedProj.id);
      setActiveFilePath(cleanFiles[0]?.path || '');
      setAgentModifiedFiles([]);
      setPendingChanges(null);
      return;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              name:
                (p.id === 'empty-workspace' || p.id.startsWith('empty-')) &&
                githubConfig.selectedRepo
                  ? githubConfig.selectedRepo
                  : p.name,
              files: cleanFiles,
              chatHistory:
                notice?.startsWith('Importati') &&
                (p.id === 'empty-workspace' || p.id.startsWith('empty-'))
                  ? []
                  : p.chatHistory,
              updatedAt: new Date().toISOString()
            }
          : p
      )
    );
    setAgentModifiedFiles([]);
    setPendingChanges(null);
    if (cleanFiles.length > 0 && !cleanFiles.some((f) => f.path === activeFilePath)) {
      setActiveFilePath(cleanFiles[0].path);
    } else if (cleanFiles.length === 0) {
      setActiveFilePath('');
    }
    if (notice && !notice.startsWith('Importati')) {
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

  const handleNewFileInEmptyWorkspace = (fileName?: string) => {
    const rawName =
      fileName ??
      window.prompt(
        'Nome del nuovo file (es. index.html, app.js, styles.css):',
        'index.html'
      );
    if (!rawName || !rawName.trim()) return;
    agentAbortRef.current?.abort();
    const trimmed = rawName.trim();
    const newFile: ProjectFile = {
      path: trimmed,
      content: '',
      language: detectFileLanguage(trimmed),
      modified: true
    };
    const newProj: PwaProject = {
      ...createEmptyProject(),
      id: `workspace-${Date.now()}`,
      name: trimmed,
      files: [newFile],
      chatHistory: []
    };
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setActiveFilePath(trimmed);
    setPendingChanges(null);
    setAgentModifiedFiles([]);
    setExplorerOpen(true);
    setLayoutMode('code-agent');
  };

  const handleOpenNewEmptyProject = () => {
    agentAbortRef.current?.abort();
    const emptyProj: PwaProject = {
      ...createEmptyProject(),
      id: `empty-${Date.now()}`,
      name: 'Ambiente Vuoto',
      files: [],
      chatHistory: []
    };
    setProjects((prev) => [emptyProj, ...prev]);
    setActiveProjectId(emptyProj.id);
    setActiveFilePath('');
    setPendingChanges(null);
    setAgentModifiedFiles([]);
    setExplorerOpen(true);
    setLayoutMode('code-agent');
  };

  const handleCloneNewGitRepo = () => {
    setCloneModalOpen(true);
  };

  const handleClonedRepo = (repo: GitHubRepoSummary, files: ProjectFile[]) => {
    agentAbortRef.current?.abort();
    const cleanFiles = files.map((f) => ({ ...f, modified: false }));
    const existing = projects.find((p) => p.name === repo.full_name);
    if (existing) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                files: cleanFiles,
                chatHistory: [],
                updatedAt: new Date().toISOString()
              }
            : p
        )
      );
      setActiveProjectId(existing.id);
    } else {
      const clonedProj: PwaProject = {
        ...createEmptyProject(),
        id: `gh-${repo.id}-${Date.now()}`,
        name: repo.full_name,
        description: repo.description || `Clonato da ${repo.full_name}`,
        files: cleanFiles,
        chatHistory: []
      };
      setProjects((prev) => [clonedProj, ...prev]);
      setActiveProjectId(clonedProj.id);
    }

    setActiveFilePath(cleanFiles[0]?.path || '');
    setPendingChanges(null);
    setAgentModifiedFiles([]);
    setExplorerOpen(true);
    setLayoutMode('code-agent');
    setGithubConfig((prev) => ({
      ...prev,
      selectedRepo: repo.full_name,
      branch: repo.default_branch || 'main',
      connected: true,
      lastSync: new Date().toLocaleTimeString()
    }));
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
          if (id === activeProject.id) return;
          agentAbortRef.current?.abort();
          setActiveProjectId(id);
          const target = projects.find((p) => p.id === id);
          setActiveFilePath(target?.files[0]?.path || '');
          setPendingChanges(null);
          setAgentModifiedFiles([]);
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
        onOpenCommitModal={() => {
          setCommitModalMode('commit');
          setCommitModalOpen(true);
        }}
        onOpenSyncModal={() => {
          setCommitModalMode('sync');
          setCommitModalOpen(true);
        }}
        githubConfig={githubConfig}
        firebaseConfig={firebaseConfig}
        bridgeConnected={agentConfig.bridgeConnected}
        onExportProject={handleExportProject}
        onOpenGuidedSetup={() => openGuidedSetup('agent')}
        onNewFileInEmptyWorkspace={handleNewFileInEmptyWorkspace}
        onOpenNewEmptyProject={handleOpenNewEmptyProject}
        onCloneNewGitRepo={handleCloneNewGitRepo}
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
          onCloneGitHub={() => {
            setCloneModalOpen(true);
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
                activeProjectFiles={activeProject.files}
                onChangeAgent={(agent) =>
                  setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
                }
                onUpdateAgentConfig={setAgentConfig}
                onSendPrompt={handleSendAgentPrompt}
                onStopAgent={handleStopAgent}
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
                onAcceptSingleFile={handleAcceptSingleFile}
                onRejectSingleFile={handleRejectSingleFile}
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
                activeProjectFiles={activeProject.files}
                onChangeAgent={(agent) =>
                  setAgentConfig((prev) => ({ ...prev, activeAgent: agent }))
                }
                onUpdateAgentConfig={setAgentConfig}
                onSendPrompt={handleSendAgentPrompt}
                onStopAgent={handleStopAgent}
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
                onAcceptSingleFile={handleAcceptSingleFile}
                onRejectSingleFile={handleRejectSingleFile}
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

      {/* Focused GitHub Commit / Sync Modal */}
      <CommitModal
        isOpen={commitModalOpen}
        mode={commitModalMode}
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

      {/* Dedicated GitHub Repo Picker & Clone Modal */}
      <CloneRepoModal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        githubConfig={githubConfig}
        onClonedRepo={handleClonedRepo}
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
