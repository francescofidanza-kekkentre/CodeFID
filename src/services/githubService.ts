import { ProjectFile } from '../types/ide';
import { detectFileLanguage } from '../utils/fileHelpers';

const GH_API = 'https://api.github.com';

function ghHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export async function verifyGitHubToken(token: string): Promise<{
  login: string;
  avatar_url: string;
  name: string;
}> {
  const res = await fetch(`${GH_API}/user`, {
    headers: ghHeaders(token)
  });
  if (!res.ok) {
    throw new Error(`Token GitHub non valido (${res.status})`);
  }
  return res.json();
}

export interface GitHubRepoSummary {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
  description: string | null;
}

export async function listUserRepos(token: string): Promise<GitHubRepoSummary[]> {
  const res = await fetch(`${GH_API}/user/repos?sort=updated&per_page=100`, {
    headers: ghHeaders(token)
  });
  if (!res.ok) {
    throw new Error(`Impossibile caricare i repository (${res.status})`);
  }
  return res.json();
}

export async function createGitHubRepo(
  token: string,
  name: string,
  description: string,
  isPrivate = false
): Promise<GitHubRepoSummary> {
  const res = await fetch(`${GH_API}/user/repos`, {
    method: 'POST',
    headers: {
      ...ghHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Errore creazione repo (${res.status})`);
  }
  return res.json();
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const cleaned = b64.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function pushProjectToGitHub(params: {
  token: string;
  repoFullName: string;
  branch: string;
  commitMessage: string;
  files: ProjectFile[];
}): Promise<{ committedCount: number; htmlUrl: string }> {
  const { token, repoFullName, branch, commitMessage, files } = params;
  let committedCount = 0;

  for (const file of files) {
    const fileUrl = `${GH_API}/repos/${repoFullName}/contents/${file.path}`;
    let existingSha: string | undefined;

    const getRes = await fetch(`${fileUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: ghHeaders(token)
    });
    if (getRes.ok) {
      const existingData = await getRes.json();
      existingSha = existingData.sha;
    }

    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        ...ghHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `${commitMessage} (${file.path})`,
        content: encodeBase64Utf8(file.content),
        branch,
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(
        `Errore push su ${file.path}: ${err.message || putRes.statusText}`
      );
    }
    committedCount++;
  }

  return {
    committedCount,
    htmlUrl: `https://github.com/${repoFullName}/tree/${branch}`
  };
}

const IGNORED_PATH_SEGMENTS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  'android/',
  'ios/',
  '.next/',
  'coverage/'
];

const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb'
]);

const TEXT_CODE_EXT_RE =
  /\.(html|htm|css|scss|less|js|jsx|ts|tsx|mjs|cjs|json|webmanifest|md|yml|yaml|svg|xml|txt|toml|sh)$/i;

function isSupportedRepoFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (IGNORED_PATH_SEGMENTS.some((seg) => lower.includes(seg))) return false;
  const baseName = lower.split('/').pop() || '';
  if (IGNORED_FILENAMES.has(baseName)) return false;
  return TEXT_CODE_EXT_RE.test(baseName);
}

function repoFilePriority(path: string): number {
  const lower = path.toLowerCase();
  if (lower.startsWith('src/')) return 0;
  if (
    lower === 'index.html' ||
    lower === 'package.json' ||
    lower.startsWith('vite.config.') ||
    lower.startsWith('tsconfig') ||
    lower.startsWith('public/')
  ) {
    return 1;
  }
  if (lower.startsWith('docs/') || lower.endsWith('.md')) return 3;
  return 2;
}

export async function pullRepoFilesFromGitHub(params: {
  token: string;
  repoFullName: string;
  branch: string;
}): Promise<ProjectFile[]> {
  const { token, repoFullName, branch } = params;
  const treeRes = await fetch(
    `${GH_API}/repos/${repoFullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: ghHeaders(token) }
  );
  if (!treeRes.ok) {
    throw new Error(`Impossibile leggere il branch ${branch} (${treeRes.status})`);
  }
  const treeData = await treeRes.json();
  const blobs = (treeData.tree || [])
    .filter(
      (item: any) =>
        item.type === 'blob' &&
        typeof item.path === 'string' &&
        isSupportedRepoFile(item.path) &&
        (item.size || 0) < 250_000
    )
    .sort((a: any, b: any) => {
      const pa = repoFilePriority(a.path);
      const pb = repoFilePriority(b.path);
      if (pa !== pb) return pa - pb;
      return a.path.localeCompare(b.path);
    })
    .slice(0, 120);

  const loadedFiles: ProjectFile[] = [];
  const BATCH_SIZE = 8;

  for (let i = 0; i < blobs.length; i += BATCH_SIZE) {
    const batch = blobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (blob: any): Promise<ProjectFile | null> => {
        try {
          const url = blob.sha
            ? `${GH_API}/repos/${repoFullName}/git/blobs/${blob.sha}`
            : `${GH_API}/repos/${repoFullName}/contents/${blob.path
                .split('/')
                .map(encodeURIComponent)
                .join('/')}?ref=${encodeURIComponent(branch)}`;
          const fileRes = await fetch(url, { headers: ghHeaders(token) });
          if (!fileRes.ok) return null;
          const fileData = await fileRes.json();
          if (!fileData.content) return null;
          return {
            path: blob.path,
            content: decodeBase64Utf8(fileData.content),
            language: detectFileLanguage(blob.path),
            modified: false
          };
        } catch {
          return null;
        }
      })
    );
    for (const file of results) {
      if (file) loadedFiles.push(file);
    }
  }

  loadedFiles.sort((a, b) => a.path.localeCompare(b.path));

  if (!loadedFiles.length) {
    throw new Error('Nessun file di codice compatibile trovato nel repository selezionato.');
  }
  return loadedFiles;
}
