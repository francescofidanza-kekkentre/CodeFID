import React, { useEffect, useMemo, useState } from 'react';
import {
  DownloadCloud,
  Laptop,
  RefreshCw,
  RotateCw,
  Smartphone,
  Tablet,
  TerminalSquare,
  Wifi,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { DeviceFrame, ProjectFile, PwaManifestConfig } from '../types/ide';
import { buildPreviewHtml } from '../services/pwaPreview';

interface LivePwaPreviewProps {
  files: ProjectFile[];
  manifestConfig: PwaManifestConfig;
}

interface ConsoleEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  time: string;
}

export const LivePwaPreview: React.FC<LivePwaPreviewProps> = ({
  files,
  manifestConfig
}) => {
  const [device, setDevice] = useState<DeviceFrame>('ipad-pro');
  const [landscape, setLandscape] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installedToast, setInstalledToast] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.source === 'codefid-preview') {
        setLogs((prev) => [
          ...prev.slice(-49),
          {
            id: `${Date.now()}-${Math.random()}`,
            level: event.data.level || 'info',
            message: event.data.message || '',
            time: new Date().toLocaleTimeString()
          }
        ]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const srcDoc = useMemo(
    () => (files.length === 0 ? '' : buildPreviewHtml(files, simulateOffline)),
    [files, simulateOffline, reloadKey]
  );

  const getFrameDimensions = () => {
    if (device === 'responsive') {
      return { width: '100%', height: '100%', borderRadius: '12px' };
    }
    if (device === 'ipad-pro') {
      return {
        width: landscape ? '100%' : '768px',
        maxWidth: landscape ? '1024px' : '680px',
        height: landscape ? '100%' : '96%',
        borderRadius: '26px'
      };
    }
    if (device === 'galaxy-tab') {
      return {
        width: landscape ? '100%' : '712px',
        maxWidth: landscape ? '960px' : '640px',
        height: landscape ? '96%' : '96%',
        borderRadius: '22px'
      };
    }
    // iphone-16
    return {
      width: landscape ? '680px' : '375px',
      height: landscape ? '360px' : '94%',
      borderRadius: '34px'
    };
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
      {/* Simulator Toolbar */}
      <div className="h-10 px-3 bg-[#252526] border-b border-[#2b2b2b] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDevice('ipad-pro')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              device === 'ipad-pro'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>iPad Pro</span>
          </button>
          <button
            onClick={() => setDevice('galaxy-tab')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              device === 'galaxy-tab'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Galaxy Tab</span>
          </button>
          <button
            onClick={() => setDevice('iphone-16')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              device === 'iphone-16'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
          <button
            onClick={() => setDevice('responsive')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              device === 'responsive'
                ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Full</span>
          </button>
        </div>

        {/* Right Controls: Orientation, Offline Toggle, Install Prompt, Reload */}
        <div className="flex items-center gap-1.5">
          {device !== 'responsive' && (
            <button
              onClick={() => setLandscape((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition"
              title="Ruota Tablet (Landscape / Portrait)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {landscape ? 'Landscape' : 'Portrait'}
              </span>
            </button>
          )}

          <button
            onClick={() => setSimulateOffline((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              simulateOffline
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
            title="Testa comportamento Service Worker Offline"
          >
            {simulateOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline SW</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Online</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowInstallBanner((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs transition"
            title="Simula prompt di installazione PWA su tablet"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Test Install</span>
          </button>

          <button
            onClick={() => setShowConsole((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition ${
              showConsole
                ? 'bg-slate-700 border-slate-500 text-white'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
            title="Apri DevTools Console della PWA"
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            <span>{logs.length}</span>
          </button>

          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Ricarica Anteprima PWA"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulated Tablet Frame Canvas */}
      <div className="flex-1 p-3 flex items-center justify-center overflow-hidden relative">
        <div
          style={getFrameDimensions()}
          className="relative bg-slate-950 border-[6px] border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-200"
        >
          {/* Tablet Bezel Status Bar */}
          <div
            style={{ backgroundColor: manifestConfig.theme_color || '#0f172a' }}
            className="h-6 px-4 flex items-center justify-between text-[11px] font-semibold text-white/90 shrink-0"
          >
            <span>{manifestConfig.short_name || 'PWA App'}</span>
            <div className="flex items-center gap-3">
              <span>{manifestConfig.display.toUpperCase()}</span>
              <span>{simulateOffline ? '⚡ OFFLINE CACHE' : '5G / Wi-Fi 6E'}</span>
              <span>100% 🔋</span>
            </div>
          </div>

          {/* Simulated "Add to Home Screen" PWA Prompt */}
          {showInstallBanner && (
            <div className="bg-slate-900/95 border-b border-indigo-500/40 px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: manifestConfig.theme_color }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow"
                >
                  {manifestConfig.short_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white">
                    Installa "{manifestConfig.name}" sulla Home del Tablet
                  </div>
                  <div className="text-[11px] text-slate-400">
                     Avvio standalone full-screen • Funziona anche offline (sw.js)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    setShowInstallBanner(false);
                    setInstalledToast(true);
                    setTimeout(() => setInstalledToast(false), 3000);
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-semibold"
                >
                  Aggiungi a Home
                </button>
              </div>
            </div>
          )}

          {installedToast && (
            <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2 flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                PWA <strong>{manifestConfig.short_name}</strong> installata in modalità{' '}
                <code>{manifestConfig.display}</code> con Service Worker registrato!
              </span>
            </div>
          )}

          {/* Live Sandboxed Iframe or Empty State */}
          {files.length === 0 ? (
            <div className="flex-1 bg-[#1e1e1e] flex flex-col items-center justify-center p-6 text-center text-[#858585]">
              <Tablet className="w-10 h-10 text-[#3c3c3c] mb-3" />
              <p className="text-sm font-medium text-[#cccccc]">Anteprima vuota</p>
              <p className="text-xs text-[#858585] mt-1 max-w-xs">
                Crea <code className="text-[#cccccc]">index.html</code> o genera un progetto con l&apos;AI per vedere l&apos;anteprima live.
              </p>
            </div>
          ) : (
            <iframe
              key={reloadKey}
              title="Live Tablet PWA Preview"
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              className="w-full flex-1 bg-slate-900 border-0"
            />
          )}
        </div>
      </div>

      {/* Collapsible DevTools Console */}
      {showConsole && (
        <div className="h-36 bg-[#080c17] border-t border-slate-800 flex flex-col shrink-0">
          <div className="px-3 py-1.5 bg-[#0e1526] border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">
              PWA Runtime Console ({logs.length} eventi)
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-slate-400 hover:text-white"
            >
              Pulisci
            </button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-500">
                Nessun log emesso. Interagisci con la PWA per vedere i log console in tempo reale.
              </div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className={`flex items-start gap-2 ${
                    l.level === 'error'
                      ? 'text-rose-400'
                      : l.level === 'warn'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 shrink-0">[{l.time}]</span>
                  <span className="break-all">{l.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
