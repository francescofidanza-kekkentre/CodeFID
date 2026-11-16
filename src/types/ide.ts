export type FileLanguage = 'html' | 'css' | 'javascript' | 'json' | 'markdown' | 'yaml';

export interface ProjectFile {
  path: string;
  content: string;
  language: FileLanguage;
  modified?: boolean;
}

export interface PwaManifestConfig {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'any' | 'portrait' | 'landscape';
  start_url: string;
  cacheStrategy: 'StaleWhileRevalidate' | 'CacheFirst' | 'NetworkFirst';
  offlineFallback: boolean;
}

export interface PwaProject {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  files: ProjectFile[];
  manifestConfig: PwaManifestConfig;
}

export type AgentId = 'antigravity' | 'claude' | 'swarm';

export interface AgentToolCall {
  id: string;
  tool: 'write_file' | 'edit_file' | 'audit_pwa' | 'generate_sw' | 'firebase_sync' | 'github_workflow' | 'bridge_exec';
  targetFile?: string;
  summary: string;
  status: 'running' | 'done' | 'error';
  diffPreview?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agent: AgentId;
  agentLabel?: string;
  content: string;
  timestamp: string;
  toolCalls?: AgentToolCall[];
  snapshotFiles?: ProjectFile[];
  modifiedFiles?: string[];
}

export interface PendingFileChange {
  path: string;
  addedLines: number;
  deletedLines: number;
  isNew: boolean;
}

export interface PendingAgentChanges {
  id: string;
  agentLabel: string;
  files: PendingFileChange[];
  updatedFiles: ProjectFile[];
  totalDeletedLines: number;
  totalAddedLines: number;
}

export interface AgentConfig {
  activeAgent: AgentId;
  claudeApiKey: string;
  claudeModel: string;
  geminiApiKey: string;
  antigravityModel: string;
  bridgeUrl: string;
  bridgeConnected: boolean;
  autoApplyChanges: boolean;
}

export interface GitHubConfig {
  token: string;
  username: string;
  avatarUrl?: string;
  selectedRepo: string; // e.g., "username/repo"
  branch: string;
  connected: boolean;
  lastSync?: string;
}

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  appId: string;
  authDomain: string;
  storageBucket: string;
  connected: boolean;
  lastCloudSave?: string;
}

export type TabletLayoutMode =
  | 'code-agent'
  | 'split-3'
  | 'code-preview'
  | 'agent-preview'
  | 'preview-only';

export type DeviceFrame = 'ipad-pro' | 'galaxy-tab' | 'iphone-16' | 'responsive';

export interface PwaAuditItem {
  id: string;
  title: string;
  category: 'manifest' | 'service-worker' | 'responsive' | 'offline' | 'security';
  passed: boolean;
  detail: string;
  fixPrompt: string;
}
