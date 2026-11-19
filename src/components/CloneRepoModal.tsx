import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  DownloadCloud,
  GitBranch,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Settings,
  X
} from 'lucide-react';
import { GitHubConfig, ProjectFile } from '../types/ide';
import {
  GitHubRepoSummary,
  listUserRepos,
  pullRepoFilesFromGitHub
} from '../services/githubService';

interface CloneRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubConfig: GitHubConfig;
  onClonedRepo: (repo: GitHubRepoSummary, files: ProjectFile[]) => void;
  onOpenGitHubSettings: () => void;
}

/**
 * Dedicated modal that loads the user's GitHub repositories and lets them
 * pick and clone any repository directly into a workspace on the tablet.
 */
export const CloneRepoModal: React.FC<CloneRepoModalProps> = ({
  isOpen,
  onClose,
  githubConfig,
  onClonedRepo,
  onOpenGitHubSettings
}) => {
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [cloningRepoName, setCloningRepoName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasToken = Boolean(githubConfig.token.trim());

  const loadRepos = async () => {
    if (!githubConfig.token.trim()) return;
    setLoadingRepos(true);
    setErrorMsg(null);
    try {
      const list = await listUserRepos(githubConfig.token.trim());
      setRepos(list);
      if (list.length > 0 && !selectedRepo) {
        const current = list.find((r) => r.full_name === githubConfig.selectedRepo);
        setSelectedRepo(current || list[0]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossibile caricare i repository dal tuo account GitHub.');
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setErrorMsg(null);
      setCloningRepoName(null);
      if (hasToken) {
        void loadRepos();
      }
    }
  }, [isOpen, githubConfig.token]);

  const filteredRepos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [repos, searchQuery]);

  if (!isOpen) return null;

  const handleClone = async (repo: GitHubRepoSummary) => {
    if (!hasToken || cloningRepoName) return;
    setCloningRepoName(repo.full_name);
    setErrorMsg(null);
    try {
      const files = await pullRepoFilesFromGitHub({
        token: githubConfig.token.trim(),
        repoFullName: repo.full_name,
        branch: repo.default_branch || 'main'
      });
      onClonedRepo(repo, files);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || `Errore durante il clone di ${repo.full_name}.`);
    } finally {
      setCloningRepoName(null);
    }
  };

  return (
    <div
      style={{ height: 'var(--app-height, 100dvh)', zIndex: 9998 }}
      className="fixed top-0 left-0 right-0 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#181818] border border-[#3c3c3c] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] my-auto"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
              <GitBranch className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                Clone a Git repo
              </h2>
              <p className="text-[11px] text-[#969696] truncate">
                {githubConfig.username
                  ? `Account GitHub: @${githubConfig.username}`
                  : 'Seleziona un repository dal tuo account GitHub'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasToken && (
              <button
                type="button"
                onClick={loadRepos}
                disabled={loadingRepos || cloningRepoName !== null}
                title="Aggiorna elenco repository"
                className="p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#333333] transition"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRepos ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGitHubSettings();
              }}
              title="Impostazioni Token GitHub"
              className="p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#333333] transition"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Chiudi"
              className="p-2 rounded-lg text-[#969696] hover:text-white hover:bg-[#333333] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {!hasToken ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-center">
              <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
              <div className="text-xs text-amber-100 font-medium">
                Nessun account GitHub collegato. Configura prima il tuo Personal Access Token per vedere e clonare i tuoi repository.
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGitHubSettings();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition"
              >
                Configura Account GitHub
              </button>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-[#858585] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca repository sul tuo account GitHub..."
                  className="w-full bg-[#141414] text-white text-xs rounded-xl pl-9 pr-3 py-2.5 border border-[#3c3c3c] focus:outline-none focus:border-emerald-500"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Repo list */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 min-h-[180px]">
                {loadingRepos ? (
                  <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-[#969696]">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Caricamento repository dal tuo account GitHub...</span>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center gap-1.5 text-xs text-[#858585] text-center">
                    <GitBranch className="w-5 h-5 opacity-50" />
                    <span>
                      {searchQuery
                        ? 'Nessun repository corrisponde alla ricerca.'
                        : 'Nessun repository trovato su questo account.'}
                    </span>
                  </div>
                ) : (
                  filteredRepos.map((repo) => {
                    const isSelected = selectedRepo?.id === repo.id;
                    const isCloning = cloningRepoName === repo.full_name;
                    return (
                      <div
                        key={repo.id}
                        onClick={() => setSelectedRepo(repo)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/50'
                            : 'bg-[#202022] border-[#333333] hover:bg-[#2a2d2e]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">
                              {repo.full_name}
                            </span>
                            {repo.private && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-semibold text-amber-300 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                Privato
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[9px] font-mono text-[#969696] shrink-0">
                              {repo.default_branch || 'main'}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="text-[11px] text-[#969696] truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleClone(repo);
                          }}
                          disabled={cloningRepoName !== null}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition"
                        >
                          {isCloning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <DownloadCloud className="w-3.5 h-3.5" />
                          )}
                          <span>{isCloning ? 'Clonazione...' : 'Clona'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
