import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  AlertTriangle
} from 'lucide-react';
import { PwaAuditItem, PwaManifestConfig } from '../types/ide';

interface PwaBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifestConfig: PwaManifestConfig;
  onChangeConfig: (next: PwaManifestConfig) => void;
  onApplyToProjectFiles: () => void;
  auditScore: number;
  auditItems: PwaAuditItem[];
  onFixWithAgent: (fixPrompt: string) => void;
}

export const PwaBuilderModal: React.FC<PwaBuilderModalProps> = ({
  isOpen,
  onClose,
  manifestConfig,
  onChangeConfig,
  onApplyToProjectFiles,
  auditScore,
  auditItems,
  onFixWithAgent
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1526] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#090d18] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                PWA Studio — Manifest, Service Worker & Audit
              </h2>
              <p className="text-xs text-slate-400">
                Configura l&apos;installazione nativa su iPadOS / Android e la strategia offline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              Score PWA: {auditScore}/100
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Visual Manifest & SW Configurator */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              1. Configurazione Web App Manifest & Service Worker
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nome Completo App</label>
                <input
                  type="text"
                  value={manifestConfig.name}
                  onChange={(e) =>
                    onChangeConfig({ ...manifestConfig, name: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Nome Breve (Icona Home)
                </label>
                <input
                  type="text"
                  value={manifestConfig.short_name}
                  onChange={(e) =>
                    onChangeConfig({ ...manifestConfig, short_name: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={manifestConfig.theme_color}
                    onChange={(e) =>
                      onChangeConfig({ ...manifestConfig, theme_color: e.target.value })
                    }
                    className="w-9 h-9 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={manifestConfig.theme_color}
                    onChange={(e) =>
                      onChangeConfig({ ...manifestConfig, theme_color: e.target.value })
                    }
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Background Splash</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={manifestConfig.background_color}
                    onChange={(e) =>
                      onChangeConfig({
                        ...manifestConfig,
                        background_color: e.target.value
                      })
                    }
                    className="w-9 h-9 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={manifestConfig.background_color}
                    onChange={(e) =>
                      onChangeConfig({
                        ...manifestConfig,
                        background_color: e.target.value
                      })
                    }
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Display Mode</label>
                <select
                  value={manifestConfig.display}
                  onChange={(e) =>
                    onChangeConfig({
                      ...manifestConfig,
                      display: e.target.value as PwaManifestConfig['display']
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="standalone">standalone (Consigliato Tablet)</option>
                  <option value="fullscreen">fullscreen (Kiosk / POS)</option>
                  <option value="minimal-ui">minimal-ui</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Strategia Cache Service Worker
                </label>
                <select
                  value={manifestConfig.cacheStrategy}
                  onChange={(e) =>
                    onChangeConfig({
                      ...manifestConfig,
                      cacheStrategy: e.target.value as PwaManifestConfig['cacheStrategy']
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="StaleWhileRevalidate">Stale-While-Revalidate</option>
                  <option value="CacheFirst">Cache First (Offline Estremo)</option>
                  <option value="NetworkFirst">Network First (Dati Live)</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                onApplyToProjectFiles();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition"
            >
              <Wrench className="w-4 h-4" />
              <span>Rigenera manifest.json e sw.js nel Progetto</span>
            </button>
          </div>

          {/* Right: Live PWA Readiness Audit Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                2. Checklist Conformità PWA Tablet
              </h3>
              <button
                onClick={() => {
                  onFixWithAgent(
                    '/pwa-audit Correggi automaticamente tutti i requisiti PWA mancanti in manifest.json, sw.js e app.js'
                  );
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Fix Totale con AI</span>
              </button>
            </div>

            <div className="space-y-2">
              {auditItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    item.passed
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                      : 'bg-amber-950/25 border-amber-500/40 text-amber-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {item.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.detail}</div>
                    </div>
                  </div>
                  {!item.passed && (
                    <button
                      onClick={() => {
                        onFixWithAgent(item.fixPrompt);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-semibold shrink-0"
                    >
                      Ripara AI
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
