import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  DownloadCloud,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Settings,
  X
} from 'lucide-react';
import { GitHubConfig, ProjectFile, PwaProject } from '../types/ide';
import {
  pullRepoFilesFromGitHub,
  pushProjectToGitHub
} from '../services/githubService';

interface CommitModalProps {
  isOpen: boolean;
  mode?: 'commit' | 'sync';
  onClose: () => void;
  githubConfig: GitHubConfig;
  onUpdateGithubConfig: (cfg: GitHubConfig) => void;
  activeProject: PwaProject;
  onReplaceProjectFiles: (files: ProjectFile[], notice?: string) => void;
  onClearModifiedHighlights?: () => void;
  onOpenGitHubSettings: () => void;
}

/**
 * Focused modal for GitHub Commit (mode="commit") or Sync/Pull (mode="sync").
 */
export const CommitModal: React.FC<CommitModalProps> = ({
  isOpen,
  mode = 'commit',
  onClose,
  githubConfig,
  onUpdateGithubConfig,
  activeProject,
  onReplaceProjectFiles,
  onClearModifiedHighlights,
  onOpenGitHubSettings
}) => {
  const [commitName, setCommitName] = useState('');
  const [loadingAction, setLoadingAction] = useState<'commit' | 'sync' | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCommitName('');
      setStatusMsg(null);
      setErrorMsg(null);
      setLoadingAction(null);
      setSessionCompleted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedCommitName = commitName.trim();
  const hasCommitName = trimmedCommitName.length > 0;
  const isGitHubReady = Boolean(
    githubConfig.token.trim() && githubConfig.selectedRepo.trim()
  );
  const modifiedFiles = activeProject.files.filter((f) => f.modified);

  const handleCommit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasCommitName) {
      setErrorMsg('Inserisci il nome del commit prima di continuare.');
      return;
    }
    if (!isGitHubReady) {
      setErrorMsg('Configura prima Token e Repository GitHub.');
      return;
    }

    setLoadingAction('commit');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await pushProjectToGitHub({
        token: githubConfig.token.trim(),
        repoFullName: githubConfig.selectedRepo.trim(),
        branch: githubConfig.branch.trim() || 'main',
        commitMessage: trimmedCommitName,
        files: activeProject.files
      });
      onUpdateGithubConfig({
        ...githubConfig,
        connected: true,
        lastSync: new Date().toLocaleTimeString()
      });
      onClearModifiedHighlights?.();
      setStatusMsg(
        `Commit "${trimmedCommitName}" completato! ${res.committedCount} file caricati su ${githubConfig.selectedRepo}.`
      );
      setCommitName('');
      setSessionCompleted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante il commit su GitHub.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSync = async () => {
    if (!isGitHubReady) {
      setErrorMsg('Configura prima Token e Repository GitHub.');
      return;
    }

    setLoadingAction('sync');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const files = await pullRepoFilesFromGitHub({
        token: githubConfig.token.trim(),
        repoFullName: githubConfig.selectedRepo.trim(),
        branch: githubConfig.branch.trim() || 'main'
      });
      onReplaceProjectFiles(
        files,
        `Sync completato: ${files.length} file aggiornati da ${githubConfig.selectedRepo}.`
      );
      onUpdateGithubConfig({
        ...githubConfig,
        connected: true,
        lastSync: new Date().toLocaleTimeString()
      });
      onClearModifiedHighlights?.();
      setStatusMsg(
        `Sync completato: ${files.length} file sincronizzati da ${githubConfig.selectedRepo}.`
      );
      setSessionCompleted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante il sync da GitHub.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      style={{ height: 'var(--app-height, 100dvh)' }}
      className="fixed top-0 left-0 right-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-[#181818] border border-[#3c3c3c] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full my-auto">
        {/* Focused Header */}
        <div className="px-4 py-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl border shrink-0 ${
                mode === 'sync'
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {mode === 'sync' ? (
                <DownloadCloud className="w-4 h-4" />
              ) : (
                <GitCommitHorizontal className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                {mode === 'sync' ? 'Sync da GitHub (Pull)' : 'Commit su GitHub'}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-[#969696] truncate">
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {githubConfig.selectedRepo || 'Repository non selezionato'} (
                  {githubConfig.branch || 'main'})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGitHubSettings();
              }}
              title="Impostazioni Repository & Token GitHub"
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

        <div className="p-4 space-y-4 overflow-y-auto">
          {!isGitHubReady && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Collega prima un repository GitHub nelle impostazioni.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGitHubSettings();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold shrink-0 transition"
              >
                Configura
              </button>
            </div>
          )}

          {/* SEZIONE COMMIT SU GITHUB */}
          {mode === 'commit' && (
          <form
            onSubmit={handleCommit}
            className="p-3.5 rounded-xl bg-[#202022] border border-[#333333] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Commit & Push su GitHub
              </span>
              <span className="text-[11px] text-[#969696]">
                {modifiedFiles.length > 0
                  ? `${modifiedFiles.length} file modificati`
                  : `${activeProject.files.length} file totali`}
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="commit-name-input"
                className="block text-xs font-medium text-[#cccccc]"
              >
                Nome del commit <span className="text-rose-400">*</span>
              </label>
              <input
                id="commit-name-input"
                type="text"
                value={commitName}
                onChange={(e) => {
                  setCommitName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                onFocus={(e) => {
                  const target = e.currentTarget;
                  setTimeout(() => {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 250);
                }}
                placeholder="Es: feat: aggiornamento interfaccia chat"
                className={`w-full bg-[#141414] text-white text-xs sm:text-sm rounded-xl px-3 py-2.5 border focus:outline-none transition ${
                  hasCommitName
                    ? 'border-[#3c3c3c] focus:border-emerald-500'
                    : 'border-amber-500/50 focus:border-amber-400'
                }`}
              />
              {!hasCommitName && !sessionCompleted && (
                <p className="text-[11px] text-amber-300/90">
                  Inserisci il nome del commit per abilitare l&apos;invio su GitHub.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                sessionCompleted ||
                !hasCommitName ||
                !isGitHubReady ||
                activeProject.files.length === 0 ||
                loadingAction !== null
              }
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/40 disabled:text-emerald-200/40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              {loadingAction === 'commit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4" />
              )}
              <span>Esegui Commit su GitHub</span>
            </button>
          </form>
          )}

          {/* SEZIONE SYNC CON GITHUB */}
          {mode === 'sync' && (
          <div className="p-3.5 rounded-xl bg-[#202022] border border-[#333333] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Sync (Pull) da GitHub
              </span>
              {githubConfig.lastSync && (
                <span className="text-[10px] text-[#858585]">
                  Ultimo sync: {githubConfig.lastSync}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#969696]">
              Scarica e aggiorna nel workspace i file presenti sul branch remoto.
            </p>
            <button
              type="button"
              onClick={handleSync}
              disabled={sessionCompleted || !isGitHubReady || loadingAction !== null}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition"
            >
              {loadingAction === 'sync' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              <span>Sync (Pull da GitHub)</span>
            </button>
          </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {sessionCompleted && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-[#007acc] hover:bg-[#1f8ad2] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Chiudi sessione git</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
