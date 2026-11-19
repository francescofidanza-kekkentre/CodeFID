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

/**
 * Computes the number of added and deleted lines between two file contents.
 * Uses LCS for normal-sized files and a fast frequency fallback for very large files.
 */
export function computeLineDiffStats(
  oldText: string,
  newText: string
): { added: number; deleted: number } {
  if (oldText === newText) return { added: 0, deleted: 0 };
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  if (oldLines.length === 0) return { added: newLines.length, deleted: 0 };
  if (newLines.length === 0) return { added: 0, deleted: oldLines.length };

  if (oldLines.length * newLines.length > 400_000) {
    const counts = new Map<string, number>();
    for (const line of oldLines) {
      counts.set(line, (counts.get(line) || 0) + 1);
    }
    let common = 0;
    for (const line of newLines) {
      const c = counts.get(line) || 0;
      if (c > 0) {
        counts.set(line, c - 1);
        common++;
      }
    }
    return {
      deleted: oldLines.length - common,
      added: newLines.length - common
    };
  }

  const m = oldLines.length;
  const n = newLines.length;
  let prev = new Uint32Array(n + 1);
  let curr = new Uint32Array(n + 1);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = prev[j] >= curr[j - 1] ? prev[j] : curr[j - 1];
      }
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
    curr.fill(0);
  }

  const lcs = prev[n];
  return {
    deleted: m - lcs,
    added: n - lcs
  };
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx';
  text: string;
}

/**
 * Generates a compact line-level diff preview showing context and changed lines.
 */
export function computeUnifiedDiffPreview(
  oldText: string,
  newText: string,
  maxLines = 120
): DiffLine[] {
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  if (oldLines.length === 0) {
    return newLines.slice(0, maxLines).map((text) => ({ type: 'add', text }));
  }
  if (newLines.length === 0) {
    return oldLines.slice(0, maxLines).map((text) => ({ type: 'del', text }));
  }

  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const a = oldLines.slice(prefix, oldLines.length - suffix);
  const b = newLines.slice(prefix, newLines.length - suffix);
  const out: DiffLine[] = [];

  if (prefix > 0) {
    const ctxStart = Math.max(0, prefix - 2);
    for (let i = ctxStart; i < prefix; i++) {
      out.push({ type: 'ctx', text: oldLines[i] });
    }
  }

  if (a.length * b.length <= 160_000) {
    const m = a.length;
    const n = b.length;
    const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] =
          a[i] === b[j]
            ? dp[i + 1][j + 1] + 1
            : dp[i + 1][j] >= dp[i][j + 1]
            ? dp[i + 1][j]
            : dp[i][j + 1];
      }
    }
    let i = 0;
    let j = 0;
    while (i < m && j < n && out.length < maxLines) {
      if (a[i] === b[j]) {
        out.push({ type: 'ctx', text: a[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        out.push({ type: 'del', text: a[i++] });
      } else {
        out.push({ type: 'add', text: b[j++] });
      }
    }
    while (i < m && out.length < maxLines) out.push({ type: 'del', text: a[i++] });
    while (j < n && out.length < maxLines) out.push({ type: 'add', text: b[j++] });
  } else {
    for (const line of a.slice(0, Math.floor(maxLines / 2))) {
      out.push({ type: 'del', text: line });
    }
    for (const line of b.slice(0, Math.floor(maxLines / 2))) {
      out.push({ type: 'add', text: line });
    }
  }

  if (suffix > 0 && out.length < maxLines) {
    const endStart = newLines.length - suffix;
    const ctxEnd = Math.min(newLines.length, endStart + 2);
    for (let i = endStart; i < ctxEnd && out.length < maxLines; i++) {
      out.push({ type: 'ctx', text: newLines[i] });
    }
  }

  return out;
}
