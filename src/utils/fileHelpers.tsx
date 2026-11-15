import React from 'react';
import { FileCode2, FileJson, FileText } from 'lucide-react';
import { ProjectFile } from '../types/ide';

const EXTENSION_LANGUAGE_MAP: Record<string, ProjectFile['language']> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml'
};

/**
 * Infers a project file's language from its filename extension.
 */
export function detectFileLanguage(path: string): ProjectFile['language'] {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_LANGUAGE_MAP[ext] || 'javascript';
}

/**
 * Renders the VS Code-style file type icon for a given file path.
 */
export function renderFileIcon(path: string): React.ReactNode {
  if (path.endsWith('.json')) {
    return <FileJson className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (path.endsWith('.html')) {
    return <FileCode2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  }
  if (path.endsWith('.css')) {
    return <FileCode2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-[#519aba] shrink-0" />;
}

/**
 * Executes a shell command via the local/remote CodeFID CLI Bridge.
 */
export async function execBridgeCommand(
  bridgeUrl: string,
  command: string
): Promise<{ ok: boolean; output: string }> {
  const res = await fetch(`${bridgeUrl.replace(/\/$/, '')}/api/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  const data = await res.json();
  const output = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
  return { ok: Boolean(data.ok), output };
}

/**
 * Safely reads and parses a JSON value from localStorage.
 */
export function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch {
    // Ignore corrupted storage entries
  }
  return fallback;
}

/**
 * Safely serializes and stores a value in localStorage.
 */
export function saveStoredJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private mode errors
  }
}
